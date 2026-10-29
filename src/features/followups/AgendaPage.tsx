import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NativeSelect } from '@/components/ui/native-select'
import { useAuth } from '@/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { useUsers, userName } from '@/hooks/useReference'
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
          {open.isLoading && <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />}
          {open.error && <p className="text-body text-destructive">{errorMessage(open.error)}</p>}
          {open.data && open.data.length === 0 && (
            <Card><CardContent className="py-10 text-center text-body text-muted-foreground">{t('agenda.nothingOpen')}</CardContent></Card>
          )}
          {order.map((b) =>
            groups[b].length ? (
              <Card key={b} className={b === 'overdue' ? 'border-destructive/40' : undefined}>
                <CardHeader>
                  <CardTitle className={b === 'overdue' ? 'text-destructive' : undefined}>
                    {t(`agenda.bucket.${b}`)} ({groups[b].length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {groups[b].map((f) => (
                    <FollowUpItem key={f.id} followUp={f} showEntity onDone={setClosing} onReschedule={setRescheduling} />
                  ))}
                </CardContent>
              </Card>
            ) : null,
          )}
        </TabsContent>

        <TabsContent value="done" className="grid gap-2">
          {done.data?.length === 0 && <p className="py-6 text-center text-body text-muted-foreground">{t('agenda.nothingDone')}</p>}
          {done.data?.map((f) => <FollowUpItem key={f.id} followUp={f} showEntity />)}
        </TabsContent>
      </Tabs>

      <CloseFollowUpDialog followUp={closing} onClose={() => setClosing(null)} />
      <RescheduleFollowUpDialog followUp={rescheduling} onClose={() => setRescheduling(null)} />
    </>
  )
}
