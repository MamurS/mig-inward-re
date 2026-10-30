import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, AlarmClock, CircleCheckBig, FileSearch, Hourglass, Inbox } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { KPI_GRID_5, KPI_SPAN_5, KpiCard } from '@/components/KpiCard'
import { registerLink } from '@/features/submissions/filters'
import { Skeleton } from '@/components/Skeleton'
import { Amount } from '@/components/Amount'
import { AgingBadge } from '@/components/AgingBadge'
import { EmptyState } from '@/components/EmptyState'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'
import { StatusBadge } from '@/components/StatusBadge'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { formatAmount, formatDate, formatHuman, formatLongDate, formatMonthShort, isoDate, locale } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import { STATUS_SOLID, type SubmissionStatus } from '@/lib/status'
import { PremiumDashboard } from '@/features/premium/PremiumDashboard'
import { ClaimsDashboard } from '@/features/claims/ClaimsDashboard'
import { BindersDashboard } from '@/features/binders/BindersDashboard'

type Row = {
  id: string
  ref_no: string
  insured_name: string
  status: SubmissionStatus
  received_at: string
  offered_at: string | null
  bound_at: string | null
  offer_valid_until: string | null
  mga_id: string
  mga_name: string
  lob_name: string | null
  our_gross_premium_usd: number | null
  follow_up_overdue: boolean
  offer_expired: boolean
}

const partOfDay = () => {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
}

const COLUMNS =
  'id, ref_no, insured_name, status, received_at, offered_at, bound_at, offer_valid_until, mga_id, mga_name, lob_name, our_gross_premium_usd, follow_up_overdue, offer_expired'

const BAR = 'var(--color-brand-500)'
/** Axis text: slate-600 reads at 6.5 : 1 on white. */
const TICK = { fontSize: 12, fill: 'var(--color-slate-600)' }

function useDashboardRows() {
  return useQuery({
    queryKey: ['submissions', 'dashboard'],
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      // Paginate so the dashboard is always complete, whatever the volume
      const all: Row[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('submissions_v').select(COLUMNS).order('received_at').range(from, from + 999)
        if (error) throw error
        all.push(...((data ?? []) as unknown as Row[]))
        if (!data || data.length < 1000) break
      }
      return all
    },
  })
}

export function DashboardPage() {
  const { t } = useTranslation()
  const { profile, role } = useAuth()
  const { data, isLoading, error } = useDashboardRows()
  const seesPremium = role === 'admin' || role === 'management' || role === 'finance'
  const seesClaims = role === 'admin' || role === 'management' || role === 'finance' || role === 'claims'
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState<string>(String(thisYear))

  const years = useMemo(() => {
    const ys = new Set<number>([thisYear])
    for (const r of data ?? []) ys.add(Number(r.received_at.slice(0, 4)))
    return [...ys].sort((a, b) => b - a)
  }, [data, thisYear])

  const m = useMemo(() => {
    const rows = data ?? []
    const now = new Date()
    const monthStart = isoDate(new Date(now.getFullYear(), now.getMonth(), 1))
    const yearStart = `${thisYear}-01-01`
    const inYear = (d: string | null) => Boolean(d) && (year === 'all' || d!.slice(0, 4) === year)

    // Tiles (fixed definitions)
    const receivedThisMonth = rows.filter((r) => r.received_at >= monthStart).length
    const underReview = rows.filter((r) => r.status === 'under_review').length
    const notReviewed = rows.filter((r) => r.status === 'received').length
    const awaiting = rows.filter((r) => r.status === 'offered' || r.status === 'no_response')
    const overdue = rows.filter((r) => r.follow_up_overdue).length
    const boundYtd = rows.filter((r) => r.status === 'bound' && r.bound_at && r.bound_at >= yearStart)
    const boundYtdUsd = boundYtd.reduce((s, r) => s + (r.our_gross_premium_usd ?? 0), 0)

    // KPI trends: the same stretch of the previous month / year, and the last 12 months
    const day = now.getDate()
    const prevMonthStart = isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1))
    const prevMonthSameDay = isoDate(new Date(now.getFullYear(), now.getMonth() - 1, Math.min(day, new Date(now.getFullYear(), now.getMonth(), 0).getDate()) + 1))
    const receivedPrevMonth = rows.filter((r) => r.received_at >= prevMonthStart && r.received_at < prevMonthSameDay).length
    const lastYearStart = `${thisYear - 1}-01-01`
    const lastYearToday = isoDate(new Date(thisYear - 1, now.getMonth(), day + 1))
    const boundLastYtd = rows.filter((r) => r.status === 'bound' && r.bound_at && r.bound_at >= lastYearStart && r.bound_at < lastYearToday).length
    const change = (now_: number, before: number) => (before > 0 ? (now_ - before) / before : null)
    const months12 = Array.from({ length: 12 }, (_, i) => isoDate(new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)).slice(0, 7))
    const receivedTrend = months12.map((mo) => rows.filter((r) => r.received_at.startsWith(mo)).length)
    const boundTrend = months12.map((mo) => rows.filter((r) => r.status === 'bound' && r.bound_at?.startsWith(mo)).length)

    // Period-based analytics
    const received = rows.filter((r) => inYear(r.received_at))
    const reviewed = received.filter((r) => r.status !== 'received')
    const offered = rows.filter((r) => inYear(r.offered_at))
    const bound = rows.filter((r) => r.status === 'bound' && inYear(r.bound_at))
    const boundFromOffered = offered.filter((r) => r.status === 'bound')
    const hitRatio = offered.length ? boundFromOffered.length / offered.length : null
    const decided = offered.filter((r) => ['bound', 'ntu', 'no_response'].includes(r.status))
    const hitRatioDecided = decided.length ? boundFromOffered.length / decided.length : null

    const funnel: { name: string; value: number; status: SubmissionStatus }[] = [
      { name: t('dash.funnel.received'), value: received.length, status: 'received' },
      { name: t('dash.funnel.reviewed'), value: reviewed.length, status: 'under_review' },
      { name: t('dash.funnel.offered'), value: received.filter((r) => r.offered_at).length, status: 'offered' },
      { name: t('dash.funnel.bound'), value: received.filter((r) => r.status === 'bound').length, status: 'bound' },
    ]

    const sumBy = (key: (r: Row) => string) => {
      const map = new Map<string, number>()
      for (const r of bound) map.set(key(r), (map.get(key(r)) ?? 0) + (r.our_gross_premium_usd ?? 0))
      return [...map.entries()].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value)
    }
    const byMga = sumBy((r) => r.mga_name)
    const byLob = sumBy((r) => r.lob_name ?? '—')

    const byMonth =
      year === 'all'
        ? years.slice().reverse().map((y) => ({
            name: String(y),
            value: bound.filter((r) => r.bound_at!.startsWith(String(y))).reduce((s, r) => s + (r.our_gross_premium_usd ?? 0), 0),
          }))
        : Array.from({ length: 12 }, (_, i) => ({
            name: formatMonthShort(Number(year), i),
            value: bound.filter((r) => Number(r.bound_at!.slice(5, 7)) === i + 1).reduce((s, r) => s + (r.our_gross_premium_usd ?? 0), 0),
          }))

    const oldestOffers = awaiting
      .slice()
      .sort((a, b) => (a.offered_at ?? '').localeCompare(b.offered_at ?? ''))
      .slice(0, 10)

    return {
      receivedDelta: change(receivedThisMonth, receivedPrevMonth), boundDelta: change(boundYtd.length, boundLastYtd), receivedTrend, boundTrend,
      monthStart, yearStart, receivedThisMonth, underReview, notReviewed, awaiting: awaiting.length, overdue,
      boundYtd: boundYtd.length, boundYtdUsd, funnel, byMga, byLob, byMonth, hitRatio, hitRatioDecided,
      offeredCount: offered.length, boundFromOffered: boundFromOffered.length, boundUsd: bound.reduce((s, r) => s + (r.our_gross_premium_usd ?? 0), 0),
      oldestOffers,
    }
  }, [data, year, years, thisYear, t])

  const greeting = `${t(`ui.greeting.${partOfDay()}`, { name: profile?.full_name?.split(' ')[0] ?? '' })} · ${formatLongDate()}`

  if (isLoading)
    return (
      <>
        <PageHeader title={t('pages.dashboard.title')} subtitle={greeting} />
        <div className={`mb-4 ${KPI_GRID_5}`}>
          {KPI_SPAN_5.map((span, i) => <Skeleton key={i} className={`h-36 rounded-xl ${span}`} />)}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </>
    )
  if (error) return <p className="p-6 text-body text-destructive">{errorMessage(error)}</p>

  const pct = (v: number | null) => (v === null ? '—' : `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(v * 100)} %`)
  const daysSince = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null)

  return (
    <>
      <PageHeader
        title={t('pages.dashboard.title')}
        subtitle={greeting}
        actions={
          <div className="flex items-center gap-2 text-body text-muted-foreground">
            {t('dash.period')}
            <div className="w-32">
              <NativeSelect value={year} onChange={(e) => setYear(e.target.value)} aria-label={t('dash.period')}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
                <option value="all">{t('dash.allYears')}</option>
              </NativeSelect>
            </div>
          </div>
        }
      />

      {/* KPIs — each opens the register with the matching filter */}
      <div className={`mb-4 ${KPI_GRID_5}`}>
        <KpiCard
          className={KPI_SPAN_5[0]}
          label={t('dash.tiles.receivedMonth')}
          icon={Inbox}
          value={m.receivedThisMonth}
          delta={m.receivedDelta}
          deltaLabel={t('ui.kpi.vsLastMonth')}
          series={m.receivedTrend}
          to={registerLink('thismonth')}
        />
        <KpiCard className={KPI_SPAN_5[1]} icon={FileSearch} label={t('dash.tiles.underReview')} value={m.underReview} sub={t('dash.tiles.notReviewed', { count: m.notReviewed })} to={registerLink('status:under_review')} />
        <KpiCard className={KPI_SPAN_5[2]} icon={Hourglass} label={t('dash.tiles.awaiting')} value={m.awaiting} sub={t('ui.kpi.offeredOrNoResponse')} to={registerLink('status:offered|no_response', { sort: 'next_follow_up_at', dir: 'asc' })} />
        <KpiCard className={KPI_SPAN_5[3]} icon={AlarmClock} label={t('dash.tiles.overdue')} value={m.overdue} sub={t('ui.kpi.followUpsPastDue')} to={registerLink('overdue')} alert={m.overdue > 0} />
        <KpiCard
          className={KPI_SPAN_5[4]}
          label={t('dash.tiles.boundYtd', { year: thisYear })}
          icon={CircleCheckBig}
          value={m.boundYtd}
          delta={m.boundDelta}
          deltaLabel={t('ui.kpi.vsLastYear')}
          sub={<><Amount value={m.boundYtdUsd} currency="USD" human /> {t('dash.tiles.ourGross')}</>}
          series={m.boundTrend}
          to={registerLink(`status:bound, bound>=${m.yearStart}`)}
        />
      </div>

      {seesPremium && <PremiumDashboard />}
      {seesClaims && <ClaimsDashboard />}
      <BindersDashboard />

      {/* What needs an answer first, then how we are doing */}
      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <Card className="gap-0 py-0 xl:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-4">
            <CardTitle>{t('dash.oldestOffers')}</CardTitle>
            <Link to={registerLink('status:offered|no_response', { sort: 'received_at', dir: 'asc' })} className="text-body text-link hover:underline">{t('dash.openInRegister')}</Link>
          </CardHeader>
          {m.oldestOffers.length === 0 ? (
            <EmptyState pictogram="done" title={t('dash.noOpenOffers')} compact />
          ) : (
            // one grid for the whole list: the ref column is as wide as the longest ref (DEMO-SUB-…), never fixed
            <ul className="grid grid-cols-[max-content_minmax(8rem,1fr)_auto] border-t md:grid-cols-[max-content_minmax(8rem,1fr)_auto_auto] 2xl:grid-cols-[max-content_minmax(8rem,1fr)_auto_auto_auto]" data-ref-list>
              {m.oldestOffers.map((r) => {
                const days = daysSince(r.offered_at) ?? 0
                return (
                  <li key={r.id} className="col-span-full grid grid-cols-subgrid">
                    <Link to={`/submissions/${r.id}`} className="col-span-full grid grid-cols-subgrid items-baseline gap-x-3 border-b px-5 py-2 text-body transition-colors hover:bg-slate-50">
                      <span className="font-medium whitespace-nowrap text-link num" data-ref>{r.ref_no}</span>
                      <span className="min-w-0">
                        <span className="block truncate" title={r.insured_name}>{r.insured_name}</span>
                        <span className="block truncate text-caption text-muted-foreground">{r.mga_name}</span>
                      </span>
                      <StatusBadge status={r.status} className="hidden 2xl:inline-flex" />
                      <span className="hidden items-center justify-end gap-2 md:inline-flex">
                        {r.offer_expired && (
                          <span title={t('sub.offerExpiredOn', { date: formatDate(r.offer_valid_until) })}><AlertTriangle className="size-4 text-warning-600" /></span>
                        )}
                        <AgingBadge days={Math.max(days, 1)} label={t('ui.daysWaiting', { count: days })} />
                      </span>
                      <span className="text-right"><Amount value={r.our_gross_premium_usd} human /></span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('dash.awaitingByAge')}</CardTitle></CardHeader>
          <CardContent>
            <AgeBuckets rows={(data ?? []).filter((r) => r.status === 'offered' || r.status === 'no_response')} />
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-baseline justify-between gap-2">
            <CardTitle>{t('dash.byMonth')}</CardTitle>
            <Amount value={m.boundUsd} currency="USD" human className="text-body font-semibold" />
          </CardHeader>
          <CardContent>
            {m.boundUsd === 0 ? (
              <EmptyState pictogram="chart" title={t('dash.noBound')} compact />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={m.byMonth} margin={{ top: 8, right: 4, left: 4 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-slate-200)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={TICK} interval={0} />
                  <YAxis tickFormatter={(v) => formatHuman(v as number)} tickLine={false} axisLine={false} tick={TICK} width={48} />
                  <Tooltip formatter={(v) => [formatAmount(v as number), t('dash.ourGrossUsd')]} cursor={{ fill: 'var(--color-slate-50)' }} />
                  <Bar dataKey="value" fill={BAR} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('dash.funnelTitle')}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={m.funnel} layout="vertical" margin={{ left: 8, right: 40 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} tick={TICK} />
                <Tooltip formatter={(v) => [v as number, t('dash.count')]} cursor={{ fill: 'transparent' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {m.funnel.map((f) => <Cell key={f.status} fill={STATUS_SOLID[f.status]} />)}
                  <LabelList dataKey="value" position="right" fontSize={12} fill="var(--color-slate-700)" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Deeper analysis, one click away */}
      <Card>
        <CardContent>
          <Tabs defaultValue="hit">
            <TabsList>
              <TabsTrigger value="hit">{t('dash.hitRatio')}</TabsTrigger>
              <TabsTrigger value="mga">{t('dash.byMga')}</TabsTrigger>
              <TabsTrigger value="lob">{t('dash.byLob')}</TabsTrigger>
            </TabsList>
            <TabsContent value="hit">
              <div className="grid gap-6 pt-2 md:grid-cols-3">
                <div>
                  <div className="font-display-bold text-display num">{pct(m.hitRatio)}</div>
                  <p className="mt-1 text-body text-muted-foreground">{t('dash.hitRatioExplain', { bound: m.boundFromOffered, offered: m.offeredCount })}</p>
                </div>
                <div>
                  <div className="font-display-bold text-headline num">{pct(m.hitRatioDecided)}</div>
                  <p className="mt-1 text-body text-muted-foreground">{t('dash.hitRatioDecided')}</p>
                </div>
                <div>
                  <div className="font-display-bold text-headline"><Amount value={m.boundUsd} currency="USD" human /></div>
                  <p className="mt-1 text-body text-muted-foreground">{t('dash.boundPremiumPeriod')}</p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="mga"><RankChart data={m.byMga} empty={t('dash.noBound')} /></TabsContent>
            <TabsContent value="lob"><RankChart data={m.byLob} empty={t('dash.noBound')} /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  )
}

function RankChart({ data, empty }: { data: { name: string; value: number }[]; empty: string }) {
  const { t } = useTranslation()
  const top = data.slice(0, 8)
  if (top.length === 0) return <EmptyState pictogram="chart" title={empty} compact />
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, top.length * 36 + 20)}>
      <BarChart data={top} layout="vertical" margin={{ left: 8, right: 64 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={200} tickLine={false} axisLine={false} tick={TICK} tickFormatter={(v: string) => (v.length > 30 ? `${v.slice(0, 29)}…` : v)} />
        <Tooltip formatter={(v) => [formatAmount(v as number), t('dash.ourGrossUsd')]} cursor={{ fill: 'var(--color-slate-50)' }} />
        <Bar dataKey="value" fill={BAR} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList dataKey="value" position="right" fontSize={12} fill="var(--color-slate-700)" formatter={(v) => formatHuman(v as number)} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

const AGE_BUCKETS = [
  { key: '0-30', label: '0–30', min: 0, max: 30, colour: 'var(--color-aging-0to30)' },
  { key: '31-60', label: '31–60', min: 31, max: 60, colour: 'var(--color-aging-31to60)' },
  { key: '61-90', label: '61–90', min: 61, max: 90, colour: 'var(--color-aging-61to90)' },
  { key: '90+', label: '90+', min: 91, max: Infinity, colour: 'var(--color-aging-90plus)' },
] as const

/** Open offers by days since offered, on the ageing scale: one stacked bar, then the four buckets. */
function AgeBuckets({ rows }: { rows: Row[] }) {
  const { t } = useTranslation()
  const buckets = AGE_BUCKETS.map((b) => {
    const items = rows.filter((r) => {
      const d = r.offered_at ? Math.floor((Date.now() - new Date(r.offered_at).getTime()) / 86_400_000) : 0
      return d >= b.min && d <= b.max
    })
    return { ...b, name: t('dash.days', { range: b.label }), value: items.length, usd: items.reduce((s, r) => s + (r.our_gross_premium_usd ?? 0), 0) }
  })
  const total = buckets.reduce((s, b) => s + b.value, 0)
  return (
    <div className="grid gap-4">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        {total > 0 && buckets.map((b) => b.value > 0 && <span key={b.key} style={{ width: `${(b.value / total) * 100}%`, background: b.colour }} />)}
      </div>
      <ul className="grid gap-1">
        {buckets.map((b) => (
          <li key={b.key} className="flex items-center gap-3 rounded-md px-2 py-2 text-body">
            <span className="size-3 shrink-0 rounded-sm" style={{ background: b.colour }} />
            <span className="flex-1">{b.name}</span>
            <span className="w-8 text-right font-semibold num">{b.value}</span>
            <span className="w-20 text-right text-caption text-muted-foreground"><Amount value={b.usd} human /></span>
          </li>
        ))}
      </ul>
      <p className="text-caption text-muted-foreground">{t('dash.ageNote')}</p>
    </div>
  )
}
