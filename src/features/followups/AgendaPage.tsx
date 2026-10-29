import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NativeSelect } from '@/components/ui/native-select'
import { useAuth } from '@/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { useUsers, userName } from '@/hooks/useReference'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { SubmissionQuickView } from '@/features/submissions/SubmissionQuickView'
import type { SubmissionRow } from '@/features/submissions/api'
import { CloseFollowUpDialog, FollowUpItem, RescheduleFollowUpDialog, type FollowUp } from './FollowUps'

type Bucket = 'overdue' | 'today' | 'week' | 'later'

function bucketOf(due: string): Bucket {
  const d = new Date(due)
  const now = new Date()
  if (d < now) return 'overdue'
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  if (d < endOfToday) return 'today'
  const inAWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8)
  return d < inAWeek ? 'week' : 'later'
}

export function AgendaPage() {
  const { t } = useTranslation()
  const { profile, role } = useAuth()
  const users = useUsers()
  // Admin / management can look at anyone's agenda
  const canSeeOthers = role === 'admin' || role === 'management'
  const [who, setWho] = useState<string>(profile?.id ?? '')
  const [closing, setClosing] = useState<FollowUp | null>(null)
  const [rescheduling, setRescheduling] = useState<FollowUp | null>(null)
  const [peekId, setPeekId] = useState<string | null>(null)

  const peek = useQuery({
    queryKey: ['submission', peekId],
    enabled: Boolean(peekId),
    queryFn: async () => {
      const { data, error } = await supabase.from('submissions_v').select('*').eq('id', peekId!).single()
      if (error) throw error
      return data as SubmissionRow
    },
  })

  const open = useQuery({
    queryKey: ['agenda', 'open', who],
    queryFn: async () => {
      let q = supabase.from('follow_ups_v').select('*').is('done_at', null).order('due_at', { ascending: true }).limit(1000)
      if (who) q = q.eq('assigned_to', who)
      const { data, error } = await q
      if (error) throw error
      return data as FollowUp[]
    },
  })

  const done = useQuery({
    queryKey: ['agenda', 'done', who],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
      let q = supabase.from('follow_ups_v').select('*').not('done_at', 'is', null).gte('done_at', since).order('done_at', { ascending: false }).limit(500)
      if (who) q = q.or(`assigned_to.eq.${who},done_by.eq.${who}`)
      const { data, error } = await q
      if (error) throw error
      return data as FollowUp[]
    },
  })

  // Our gross premium of the submissions on the list, for the amount column (read-only lookup)
  const entityIds = [...new Set((open.data ?? []).filter((f) => f.entity_type === 'submission').map((f) => f.entity_id))]
  const amounts = useQuery({
    queryKey: ['agenda', 'amounts', entityIds],
    enabled: entityIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('submissions_v').select('id, our_gross_premium_usd').in('id', entityIds)
      if (error) throw error
      return new Map((data ?? []).map((r) => [r.id as string, r.our_gross_premium_usd as number | null]))
    },
  })
  const amountOf = (f: FollowUp) => (f.entity_type === 'submission' ? { value: amounts.data?.get(f.entity_id) ?? null, currency: 'USD' } : undefined)

  // Completion moment: the list was emptied in this visit
  const lastCount = useRef<number | null>(null)
  const [justCleared, setJustCleared] = useState(false)
  useEffect(() => {
    const n = open.data?.length
    if (n === undefined) return
    if (lastCount.current !== null && lastCount.current > 0 && n === 0) setJustCleared(true)
    lastCount.current = n
  }, [open.data?.length])

  const groups: Record<Bucket, FollowUp[]> = { overdue: [], today: [], week: [], later: [] }
  for (const f of open.data ?? []) groups[bucketOf(f.due_at)].push(f)
  // Overdue first, most overdue at the top
  const order: Bucket[] = ['overdue', 'today', 'week', 'later']

  return (
    <>
      <PageHeader
        title={t('pages.agenda.title')}
        subtitle={t('pages.agenda.subtitle')}
        actions={
          canSeeOthers && (
            <div className="w-64">
              <NativeSelect value={who} onChange={(e) => setWho(e.target.value)} aria-label={t('fu.assignedTo')}>
                <option value={profile?.id ?? ''}>{t('agenda.mine')}</option>
                <option value="">{t('agenda.everyone')}</option>
                {users.data?.filter((u) => u.role && u.active && u.id !== profile?.id).map((u) => (
                  <option key={u.id} value={u.id}>{userName(u)}</option>
                ))}
              </NativeSelect>
            </div>
          )
        }
      />

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">
            {t('agenda.open')} ({open.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="done">{t('agenda.done30')}</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="grid gap-4">
          {open.isLoading && (
            <Card>
              <CardContent className="grid gap-2">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-md" />)}
              </CardContent>
            </Card>
          )}
          {open.error && <p className="text-body text-destructive">{errorMessage(open.error)}</p>}
          {open.data && open.data.length === 0 && (
            <Card>
              <EmptyState
                pictogram="done"
                title={justCleared ? t('ui.allCaughtUp') : t('agenda.nothingOpen')}
                className={justCleared ? 'duration-(--duration-slow-01) ease-(--ease-expressive-entrance) animate-in fade-in-0 zoom-in-95' : undefined}
              >
                {t('ui.agendaClear')}
              </EmptyState>
            </Card>
          )}
          {order.map((b) =>
            groups[b].length ? (
              <Card key={b} className={b === 'overdue' ? 'border-danger-200' : undefined}>
                <CardHeader>
                  <CardTitle className={b === 'overdue' ? 'text-destructive' : undefined}>
                    {t(`agenda.bucket.${b}`)} ({groups[b].length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {groups[b].map((f) => (
                    <FollowUpItem key={f.id} followUp={f} showEntity amount={amountOf(f)} onDone={setClosing} onReschedule={setRescheduling} onPeek={(x) => setPeekId(x.entity_id)} />
                  ))}
                </CardContent>
              </Card>
            ) : null,
          )}
        </TabsContent>

        <TabsContent value="done" className="grid gap-2">
          {done.data?.length === 0 && <Card><EmptyState pictogram="inbox" title={t('agenda.nothingDone')} /></Card>}
          {done.data?.map((f) => <FollowUpItem key={f.id} followUp={f} showEntity onPeek={(x) => setPeekId(x.entity_id)} />)}
        </TabsContent>
      </Tabs>

      <CloseFollowUpDialog followUp={closing} onClose={() => setClosing(null)} />
      <RescheduleFollowUpDialog followUp={rescheduling} onClose={() => setRescheduling(null)} />
      <SubmissionQuickView row={peekId ? (peek.data ?? null) : null} onClose={() => setPeekId(null)} />
    </>
  )
}
