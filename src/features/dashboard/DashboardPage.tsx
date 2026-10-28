import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CalendarClock, FileInput, Hourglass, Loader2, ScanSearch, Trophy } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/StatusBadge'
import { supabase } from '@/lib/supabase'
import { formatAmount, formatCompactUsd, formatDate, isoDate, locale } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { SubmissionStatus } from '@/lib/status'

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

const COLUMNS =
  'id, ref_no, insured_name, status, received_at, offered_at, bound_at, offer_valid_until, mga_id, mga_name, lob_name, our_gross_premium_usd, follow_up_overdue, offer_expired'

const BAR = 'oklch(0.42 0.09 255)'
const BAR_MUTED = 'oklch(0.75 0.05 255)'

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
  const navigate = useNavigate()
  const { data, isLoading, error } = useDashboardRows()
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

    // Period-based analytics
    const received = rows.filter((r) => inYear(r.received_at))
    const reviewed = received.filter((r) => r.status !== 'received')
    const offered = rows.filter((r) => inYear(r.offered_at))
    const bound = rows.filter((r) => r.status === 'bound' && inYear(r.bound_at))
    const boundFromOffered = offered.filter((r) => r.status === 'bound')
    const hitRatio = offered.length ? boundFromOffered.length / offered.length : null
    const decided = offered.filter((r) => ['bound', 'ntu', 'no_response'].includes(r.status))
    const hitRatioDecided = decided.length ? boundFromOffered.length / decided.length : null

    const funnel = [
      { name: t('dash.funnel.received'), value: received.length },
      { name: t('dash.funnel.reviewed'), value: reviewed.length },
      { name: t('dash.funnel.offered'), value: received.filter((r) => r.offered_at).length },
      { name: t('dash.funnel.bound'), value: received.filter((r) => r.status === 'bound').length },
    ]

    const sumBy = (key: (r: Row) => string) => {
      const map = new Map<string, number>()
      for (const r of bound) map.set(key(r), (map.get(key(r)) ?? 0) + (r.our_gross_premium_usd ?? 0))
      return [...map.entries()].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value)
    }
    const byMga = sumBy((r) => r.mga_name)
    const byLob = sumBy((r) => r.lob_name ?? '—')

    const monthFmt = new Intl.DateTimeFormat(locale(), { month: 'short' })
    const byMonth =
      year === 'all'
        ? years.slice().reverse().map((y) => ({
            name: String(y),
            value: bound.filter((r) => r.bound_at!.startsWith(String(y))).reduce((s, r) => s + (r.our_gross_premium_usd ?? 0), 0),
          }))
        : Array.from({ length: 12 }, (_, i) => ({
            name: monthFmt.format(new Date(Number(year), i, 1)),
            value: bound.filter((r) => Number(r.bound_at!.slice(5, 7)) === i + 1).reduce((s, r) => s + (r.our_gross_premium_usd ?? 0), 0),
          }))

    const oldestOffers = awaiting
      .slice()
      .sort((a, b) => (a.offered_at ?? '').localeCompare(b.offered_at ?? ''))
      .slice(0, 10)

    return {
      monthStart, yearStart, receivedThisMonth, underReview, notReviewed, awaiting: awaiting.length, overdue,
      boundYtd: boundYtd.length, boundYtdUsd, funnel, byMga, byLob, byMonth, hitRatio, hitRatioDecided,
      offeredCount: offered.length, boundFromOffered: boundFromOffered.length, boundUsd: bound.reduce((s, r) => s + (r.our_gross_premium_usd ?? 0), 0),
      oldestOffers,
    }
  }, [data, year, years, thisYear, t])

  if (isLoading) return <div className="flex justify-center p-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  if (error) return <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>

  const pct = (v: number | null) => (v === null ? '—' : `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(v * 100)} %`)
  const daysSince = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null)

  return (
    <>
      <PageHeader
        title={t('pages.dashboard.title')}
        subtitle={t('pages.dashboard.subtitle')}
        actions={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {t('dash.period')}
            <div className="w-32">
              <NativeSelect value={year} onChange={(e) => setYear(e.target.value)}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
                <option value="all">{t('dash.allYears')}</option>
              </NativeSelect>
            </div>
          </div>
        }
      />

      {/* Tiles — each opens the register with the matching filter */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Tile icon={FileInput} label={t('dash.tiles.receivedMonth')} value={m.receivedThisMonth} to={`/submissions?from=${m.monthStart}`} />
        <Tile icon={ScanSearch} label={t('dash.tiles.underReview')} value={m.underReview} sub={t('dash.tiles.notReviewed', { count: m.notReviewed })} to="/submissions?status=under_review" />
        <Tile icon={Hourglass} label={t('dash.tiles.awaiting')} value={m.awaiting} to="/submissions?status=offered,no_response&sort=next_follow_up_at&dir=asc" />
        <Tile icon={CalendarClock} label={t('dash.tiles.overdue')} value={m.overdue} to="/submissions?overdue=1" danger={m.overdue > 0} />
        <Tile
          icon={Trophy}
          label={t('dash.tiles.boundYtd', { year: thisYear })}
          value={m.boundYtd}
          sub={`${formatCompactUsd(m.boundYtdUsd)} ${t('dash.tiles.ourGross')}`}
          to={`/submissions?status=bound&boundFrom=${m.yearStart}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>{t('dash.funnelTitle')}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={m.funnel} layout="vertical" margin={{ left: 8, right: 40 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip formatter={(v) => [v as number, t('dash.count')]} cursor={{ fill: 'transparent' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {m.funnel.map((_, i) => <Cell key={i} fill={i === m.funnel.length - 1 ? BAR : BAR_MUTED} />)}
                  <LabelList dataKey="value" position="right" fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('dash.hitRatio')}</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <div className="text-4xl font-semibold tabular-nums">{pct(m.hitRatio)}</div>
              <p className="mt-1 text-sm text-muted-foreground">{t('dash.hitRatioExplain', { bound: m.boundFromOffered, offered: m.offeredCount })}</p>
            </div>
            <div className="border-t pt-3">
              <div className="text-xl font-semibold tabular-nums">{pct(m.hitRatioDecided)}</div>
              <p className="mt-1 text-xs text-muted-foreground">{t('dash.hitRatioDecided')}</p>
            </div>
            <div className="border-t pt-3">
              <div className="text-xl font-semibold tabular-nums">{formatCompactUsd(m.boundUsd)}</div>
              <p className="mt-1 text-xs text-muted-foreground">{t('dash.boundPremiumPeriod')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('dash.byMonth')}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={m.byMonth} margin={{ top: 8, right: 4, left: 4 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="oklch(0.92 0.01 255)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} interval={0} />
                <YAxis tickFormatter={(v) => formatCompactUsd(v as number)} tickLine={false} axisLine={false} fontSize={11} width={56} />
                <Tooltip formatter={(v) => [formatAmount(v as number), t('dash.ourGrossUsd')]} cursor={{ fill: 'oklch(0.96 0.01 255)' }} />
                <Bar dataKey="value" fill={BAR} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <RankChart title={t('dash.byMga')} data={m.byMga} empty={t('dash.noBound')} />
        <RankChart title={t('dash.byLob')} data={m.byLob} empty={t('dash.noBound')} />

        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>{t('dash.awaitingByAge')}</CardTitle></CardHeader>
          <CardContent>
            <AgeBuckets rows={m.oldestOffers.length ? (data ?? []).filter((r) => r.status === 'offered' || r.status === 'no_response') : []} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 gap-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('dash.oldestOffers')}</CardTitle>
          <Link to="/submissions?status=offered,no_response&sort=received_at&dir=asc" className="text-sm text-primary hover:underline">{t('dash.openInRegister')}</Link>
        </CardHeader>
        <CardContent className="px-0">
          {m.oldestOffers.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">{t('dash.noOpenOffers')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">{t('fields.refNo')}</TableHead>
                  <TableHead>{t('fields.insuredName')}</TableHead>
                  <TableHead>{t('fields.mga')}</TableHead>
                  <TableHead>{t('fields.status')}</TableHead>
                  <TableHead>{t('dash.offeredOn')}</TableHead>
                  <TableHead className="text-right">{t('dash.daysWaiting')}</TableHead>
                  <TableHead>{t('fields.offerValidUntil')}</TableHead>
                  <TableHead className="pr-5 text-right">{t('fields.ourGrossUsd')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.oldestOffers.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/submissions/${r.id}`)}>
                    <TableCell className="pl-5 font-medium text-primary">{r.ref_no}</TableCell>
                    <TableCell className="max-w-64 truncate">{r.insured_name}</TableCell>
                    <TableCell className="max-w-48 truncate">{r.mga_name}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell>{formatDate(r.offered_at)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{daysSince(r.offered_at)}</TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center gap-1', r.offer_expired && 'text-amber-700')}>
                        {r.offer_expired && <AlertTriangle className="size-3.5" />}
                        {formatDate(r.offer_valid_until)}
                      </span>
                    </TableCell>
                    <TableCell className="pr-5 text-right tabular-nums">{formatAmount(r.our_gross_premium_usd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  to,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  sub?: string
  to: string
  danger?: boolean
}) {
  return (
    <Link to={to} className="group">
      <Card className={cn('h-full gap-2 py-4 transition-shadow group-hover:shadow-md', danger && 'border-destructive/40')}>
        <CardContent className="grid gap-1 px-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Icon className={cn('size-4', danger && 'text-destructive')} />
            {label}
          </div>
          <div className={cn('text-3xl font-semibold tabular-nums', danger && 'text-destructive')}>{value}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </CardContent>
      </Card>
    </Link>
  )
}

function RankChart({ title, data, empty }: { title: string; data: { name: string; value: number }[]; empty: string }) {
  const { t } = useTranslation()
  const top = data.slice(0, 8)
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(120, top.length * 34 + 20)}>
            <BarChart data={top} layout="vertical" margin={{ left: 8, right: 56 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)} />
              <Tooltip formatter={(v) => [formatAmount(v as number), t('dash.ourGrossUsd')]} cursor={{ fill: 'oklch(0.96 0.01 255)' }} />
              <Bar dataKey="value" fill={BAR} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                <LabelList dataKey="value" position="right" fontSize={11} formatter={(v) => formatCompactUsd(v as number)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

function AgeBuckets({ rows }: { rows: Row[] }) {
  const { t } = useTranslation()
  const buckets = [
    { key: '0–30', min: 0, max: 30 },
    { key: '31–60', min: 31, max: 60 },
    { key: '61–90', min: 61, max: 90 },
    { key: '90+', min: 91, max: Infinity },
  ].map((b) => {
    const items = rows.filter((r) => {
      const d = r.offered_at ? Math.floor((Date.now() - new Date(r.offered_at).getTime()) / 86_400_000) : 0
      return d >= b.min && d <= b.max
    })
    return { name: t('dash.days', { range: b.key }), value: items.length, usd: items.reduce((s, r) => s + (r.our_gross_premium_usd ?? 0), 0) }
  })
  return (
    <div className="grid gap-2">
      {buckets.map((b) => (
        <div key={b.name} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <span>{b.name}</span>
          <span className="tabular-nums">
            <span className="font-semibold">{b.value}</span>
            <span className="ml-2 text-xs text-muted-foreground">{formatCompactUsd(b.usd)}</span>
          </span>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">{t('dash.ageNote')}</p>
    </div>
  )
}
