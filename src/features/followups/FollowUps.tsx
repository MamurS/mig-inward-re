import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CheckCircle2, Circle, Clock, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/Field'
import { StatusBadge } from '@/components/StatusBadge'
import { useAuth } from '@/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { addDays, formatDate, isoDate } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { Enums, Tables } from '@/lib/database.types'
import { useUsers, userName } from '@/hooks/useReference'

export type FollowUp = Tables<'follow_ups'> & Partial<Tables<'follow_ups_v'>>

const FU_TYPES: Enums<'follow_up_type'>[] = ['request_update', 'offer_expiry', 'other']

/** Who may act on a follow-up: writers of the entity type, or the assignee. Mirrors the RLS policy. */
export function useCanActOnFollowUp() {
  const { role, profile } = useAuth()
  return (f: Pick<Tables<'follow_ups'>, 'entity_type' | 'assigned_to'>) => {
    if (!role) return false
    if (f.assigned_to && f.assigned_to === profile?.id) return true
    if (f.entity_type === 'submission' || f.entity_type === 'bordereau') return role === 'admin' || role === 'underwriter'
    if (f.entity_type === 'premium') return role === 'admin' || role === 'finance'
    if (f.entity_type === 'claim') return role === 'admin' || role === 'claims'
    return false
  }
}

function invalidateFollowUps(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['follow_ups'] }),
    qc.invalidateQueries({ queryKey: ['agenda'] }),
    qc.invalidateQueries({ queryKey: ['submissions'] }),
    qc.invalidateQueries({ queryKey: ['my-overdue'] }),
    qc.invalidateQueries({ queryKey: ['audit'] }),
  ])
}

/** Count of the current user's overdue follow-ups (sidebar badge). */
export function useMyOverdueCount() {
  const { profile, role } = useAuth()
  return useQuery({
    queryKey: ['my-overdue', profile?.id],
    enabled: Boolean(profile?.id && role),
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('follow_ups')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', profile!.id)
        .is('done_at', null)
        .lt('due_at', new Date().toISOString())
      if (error) throw error
      return count ?? 0
    },
  })
}

// ---------------------------------------------------------------------------
// Close (outcome required, optional next follow-up)
// ---------------------------------------------------------------------------
export function CloseFollowUpDialog({ followUp, onClose }: { followUp: FollowUp | null; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [outcome, setOutcome] = useState('')
  const [scheduleNext, setScheduleNext] = useState(false)
  const [nextDate, setNextDate] = useState(addDays(isoDate(), 7))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setOutcome('')
    setScheduleNext(false)
    setNextDate(addDays(isoDate(), 7))
    setError(null)
  }, [followUp])

  if (!followUp) return null

  async function save() {
    if (!outcome.trim()) {
      setError(t('fu.outcomeRequired'))
      return
    }
    setBusy(true)
    try {
      const { error: e1 } = await supabase
        .from('follow_ups')
        .update({ done_at: new Date().toISOString(), outcome: outcome.trim() })
        .eq('id', followUp!.id)
      if (e1) throw e1
      if (scheduleNext) {
        const { error: e2 } = await supabase.from('follow_ups').insert({
          entity_type: followUp!.entity_type,
          entity_id: followUp!.entity_id,
          type: followUp!.type,
          title: followUp!.title,
          due_at: new Date(`${nextDate}T09:00:00`).toISOString(),
          assigned_to: followUp!.assigned_to,
        })
        if (e2) throw e2
      }
      await invalidateFollowUps(qc)
      toast.success(t('fu.closed'))
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('fu.closeTitle')}</DialogTitle>
          <DialogDescription>
            {followUp.entity_ref ? `${followUp.entity_ref} · ` : ''}
            {followUp.title || t(`fuType.${followUp.type}`)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label={t('fu.outcome')} required hint={t('fu.outcomeHint')}>
            <Textarea rows={3} value={outcome} onChange={(e) => setOutcome(e.target.value)} autoFocus />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={scheduleNext} onChange={(e) => setScheduleNext(e.target.checked)} />
            {t('fu.scheduleNext')}
          </label>
          {scheduleNext && (
            <Field label={t('fu.nextDue')}>
              <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} min={isoDate()} />
            </Field>
          )}
          {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {t('fu.markDone')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Reschedule / reassign
// ---------------------------------------------------------------------------
export function RescheduleFollowUpDialog({ followUp, onClose }: { followUp: FollowUp | null; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const users = useUsers()
  const [due, setDue] = useState('')
  const [assignee, setAssignee] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (followUp) {
      setDue(isoDate(new Date(followUp.due_at)))
      setAssignee(followUp.assigned_to ?? '')
    }
  }, [followUp])

  if (!followUp) return null

  async function save() {
    setBusy(true)
    const { error } = await supabase
      .from('follow_ups')
      .update({ due_at: new Date(`${due}T09:00:00`).toISOString(), assigned_to: assignee || null })
      .eq('id', followUp!.id)
    setBusy(false)
    if (error) {
      toast.error(errorMessage(error))
      return
    }
    await invalidateFollowUps(qc)
    toast.success(t('fu.rescheduled'))
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('fu.rescheduleTitle')}</DialogTitle>
          <DialogDescription>{followUp.title || t(`fuType.${followUp.type}`)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('fu.due')} required>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label={t('fu.assignedTo')}>
            <NativeSelect value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">—</option>
              {users.data?.filter((u) => u.role && u.active).map((u) => <option key={u.id} value={u.id}>{userName(u)}</option>)}
            </NativeSelect>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button onClick={() => void save()} disabled={busy || !due}>
            {busy && <Loader2 className="animate-spin" />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Add a follow-up to an entity
// ---------------------------------------------------------------------------
export function AddFollowUpButton({
  entityType,
  entityId,
  defaultAssignee,
}: {
  entityType: Enums<'entity_type'>
  entityId: string
  defaultAssignee?: string | null
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const users = useUsers()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<Enums<'follow_up_type'>>('other')
  const [title, setTitle] = useState('')
  const [due, setDue] = useState(addDays(isoDate(), 7))
  const [assignee, setAssignee] = useState('')
  const [busy, setBusy] = useState(false)

  function start() {
    setType('other')
    setTitle('')
    setDue(addDays(isoDate(), 7))
    setAssignee(defaultAssignee ?? profile?.id ?? '')
    setOpen(true)
  }

  async function save() {
    setBusy(true)
    const { error } = await supabase.from('follow_ups').insert({
      entity_type: entityType,
      entity_id: entityId,
      type,
      title: title.trim() || null,
      due_at: new Date(`${due}T09:00:00`).toISOString(),
      assigned_to: assignee || null,
    })
    setBusy(false)
    if (error) {
      toast.error(errorMessage(error))
      return
    }
    await invalidateFollowUps(qc)
    toast.success(t('fu.added'))
    setOpen(false)
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={start}>
        <Plus />
        {t('fu.add')}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('fu.addTitle')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('fu.type')}>
              <NativeSelect value={type} onChange={(e) => setType(e.target.value as Enums<'follow_up_type'>)}>
                {FU_TYPES.map((x) => <option key={x} value={x}>{t(`fuType.${x}`)}</option>)}
              </NativeSelect>
            </Field>
            <Field label={t('fu.due')} required>
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
            <Field label={t('fu.titleField')} className="sm:col-span-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('fu.titlePlaceholder')} />
            </Field>
            <Field label={t('fu.assignedTo')} className="sm:col-span-2">
              <NativeSelect value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">—</option>
                {users.data?.filter((u) => u.role && u.active).map((u) => <option key={u.id} value={u.id}>{userName(u)}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>{t('common.cancel')}</Button>
            <Button onClick={() => void save()} disabled={busy || !due}>
              {busy && <Loader2 className="animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// One follow-up row (agenda + detail page)
// ---------------------------------------------------------------------------
export function FollowUpItem({
  followUp: f,
  showEntity,
  onDone,
  onReschedule,
}: {
  followUp: FollowUp
  showEntity?: boolean
  onDone?: (f: FollowUp) => void
  onReschedule?: (f: FollowUp) => void
}) {
  const { t } = useTranslation()
  const users = useUsers()
  const canAct = useCanActOnFollowUp()
  const overdue = !f.done_at && new Date(f.due_at) < new Date()
  const daysOverdue = overdue ? Math.floor((Date.now() - new Date(f.due_at).getTime()) / 86_400_000) : 0
  const assignee = f.assigned_to_name ?? userName(users.data?.find((u) => u.id === f.assigned_to))
  const actionable = !f.done_at && canAct(f)

  return (
    <div className={cn('rounded-md border p-3 text-sm', f.done_at && 'bg-muted/30', overdue && 'border-destructive/40 bg-destructive/5')}>
      <div className="flex flex-wrap items-start gap-2">
        {f.done_at ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        ) : overdue ? (
          <Clock className="mt-0.5 size-4 shrink-0 text-destructive" />
        ) : (
          <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">{f.title || t(`fuType.${f.type}`)}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{t(`fuType.${f.type}`)}</span>
          </div>
          {showEntity && f.entity_ref && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <Link to={`/submissions/${f.entity_id}`} className="font-medium text-primary hover:underline">
                {f.entity_ref}
              </Link>
              <span className="truncate">{f.entity_label}</span>
              {f.mga_name && <span className="text-muted-foreground">· {f.mga_name}</span>}
              <StatusBadge status={f.submission_status ?? null} />
            </div>
          )}
          <div className={cn('mt-1 text-xs', overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
            {t('fu.due')}: {formatDate(f.due_at)}
            {overdue && ` · ${t('fu.daysOverdue', { count: daysOverdue })}`} · {assignee}
          </div>
          {f.done_at && (
            <div className="mt-1 text-xs text-muted-foreground">
              {t('fu.doneOn', { date: formatDate(f.done_at) })}
              {f.done_by_name ? ` (${f.done_by_name})` : ''}: {f.outcome}
            </div>
          )}
        </div>
        {actionable && (onDone || onReschedule) && (
          <div className="flex gap-1.5">
            {onReschedule && (
              <Button size="sm" variant="ghost" onClick={() => onReschedule(f)} title={t('fu.rescheduleTitle')}>
                <CalendarClock />
              </Button>
            )}
            {onDone && (
              <Button size="sm" variant="outline" onClick={() => onDone(f)}>
                <CheckCircle2 />
                {t('fu.markDone')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
