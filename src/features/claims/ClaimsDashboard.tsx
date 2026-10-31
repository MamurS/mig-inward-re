import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Banknote, CircleDollarSign, Flame, FolderOpen, Scale, Wallet } from 'lucide-react'
import { KPI_GRID_6, KpiCard } from '@/components/KpiCard'
import { Amount } from '@/components/Amount'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SegmentedControl } from '@/components/SegmentedControl'
import { chartFontSize } from '@/lib/appearance'
import { formatAmount, formatDate, formatHuman, isoDate } from '@/lib/format'
import { Tooltip as Hint } from '@/components/ui/tooltip'
import { useNumberSetting } from '@/hooks/useSettings'
import { useRefNames } from '@/hooks/useReference'
import { errorMessage } from '@/lib/errors'
import { CLAIMS_PAGE, pageLink } from '@/features/search/pages'
import { useAllClaims, useClaimPayments, useRatioRisks } from './api'
import { lossRatios } from './ratios'
import { pct } from './CounterpartyClaims'
import { LargeLossBadge } from './ClaimStatusBadge'
import { ATTENTION_MAX, AttentionCard, RefFigure, RefLines, RefRow } from '@/features/dashboard/Attention'

const cl = (q: string) => pageLink(CLAIMS_PAGE, q)
const OPEN = 'status:notified|open|reopened'
/** The database's fallback when the setting is missing (claim_check_large_loss). */
const LARGE_LOSS_DEFAULT_USD = 250_000

/**
 * Dashboard › Claims: open claims, outstanding reserves, paid and incurred
 * this year (USD, our share), loss ratios (incurred / written and incurred /
 * earned — always labelled), large losses and cash calls due. Every figure
 * opens the filtered claims register. Large losses and cash calls due are in
 * «Needs attention» ({@link LargeLosses}, {@link CashCallsDue}).
 */
export function ClaimsDashboard() {
  const { t } = useTranslation()
  const today = isoDate()
  const year = today.slice(0, 4)
  const claims = useAllClaims()
  const payments = useClaimPayments(`${year}-01-01`)
  const risks = useRatioRisks()
  const [by, setBy] = useState<'mga' | 'lob' | 'year'>('mga')
  const names = useRefNames()

  if (claims.isLoading || payments.isLoading)
    return <div className={`mb-4 ${KPI_GRID_6}`}>{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
  if (claims.error) return <p className="mb-4 text-body text-destructive">{errorMessage(claims.error)}</p>

  const rows = claims.data ?? []
  const open = rows.filter((r) => r.status === 'notified' || r.status === 'open' || r.status === 'reopened')
  const outstandingUsd = open.reduce((s, r) => s + (r.outstanding_usd ?? 0), 0)
  const paidYtd = (payments.data ?? []).reduce((s, p) => s + (p.amount_usd ?? 0), 0)
  const incurredYtdRows = rows.filter((r) => r.date_of_loss?.startsWith(year))
  const incurredYtd = incurredYtdRows.reduce((s, r) => s + (r.incurred_usd ?? 0), 0)
  const large = largeLosses(rows)
  const cashCalls = cashCallsDue(rows)
  const noRate = rows.filter((r) => r.fx_rate_to_usd === null).length + (payments.data ?? []).filter((p) => p.amount_usd === null).length
  const computed = risks.data ? lossRatios(risks.data, rows, by, today) : null
  // lines of business in the UI language (grouped by code; the view's English name until the list loads)
  const ratios = computed && by === 'lob' ? { ...computed, rows: computed.rows.map((r) => ({ ...r, name: names.lobByCode(r.key, r.name) ?? r.name })) } : computed
  const chartData = (ratios?.rows ?? []).filter((r) => r.lrWritten !== null || r.lrEarned !== null).slice(0, 8)
    .map((r) => ({ name: r.name, written: r.lrWritten === null ? 0 : Math.round(r.lrWritten * 1000) / 10, earned: r.lrEarned === null ? 0 : Math.round(r.lrEarned * 1000) / 10 }))

  return (
    <section aria-labelledby="dash-claims" className="mb-4 grid gap-4" data-claims-dashboard>
      <h2 id="dash-claims" className="text-title font-semibold">{t('claim.dashTitle')}</h2>
      <div className={KPI_GRID_6}>
        <KpiCard icon={FolderOpen} label={t('claim.openClaims')} value={open.length} to={cl(OPEN)} />
        <KpiCard icon={Wallet} label={t('claim.outstandingReserves')} value={<Amount value={outstandingUsd} human />} sub="USD" to={cl(OPEN)} />
        <KpiCard icon={Banknote} label={t('claim.paidYear', { year })} value={<Amount value={paidYtd} human />} sub="USD" to={cl('paid>0')} />
        <KpiCard icon={CircleDollarSign} label={t('claim.incurredYear', { year })} value={<Amount value={incurredYtd} human />} sub={<>USD · {t('claim.byDolNote')}</>} to={cl(`dol>=${year}-01-01`)} />
        <KpiCard icon={Flame} label={t('claim.largeLosses')} value={large.length} to={cl('large')} alert={large.length > 0} />
        <KpiCard icon={Scale} label={t('claim.cashCallsDue')} value={cashCalls.length} to={cl('cashcall')} alert={cashCalls.some((c) => c.cash_call_due_at! < new Date().toISOString())} />
      </div>
      {noRate > 0 && <p className="text-caption text-warning-700">{t('dash.premium.missingRate', { count: noRate })}</p>}

      <Card data-loss-ratios>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>{t('claim.lossRatios')}</CardTitle>
          <SegmentedControl ariaLabel={t('claim.lossRatiosBy')} value={by} onChange={setBy} options={[{ value: 'mga', label: t('fields.mga') }, { value: 'lob', label: t('fields.lob') }, { value: 'year', label: t('claim.uwYear') }]} />
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-caption text-muted-foreground">{t('claim.lrExplain')}</p>
          {!ratios || ratios.rows.length === 0 ? (
            <EmptyState pictogram="chart" title={t('claim.noRatios')} compact />
          ) : (
            <>
              {chartData.length > 0 && (
                // the name above its pair of bars, never cut on a narrow axis; the full name in the tooltip
                <ResponsiveContainer width="100%" height={chartData.length * 64 + 56}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 32, top: 4 }} barGap={2} barCategoryGap={20}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--color-slate-200)" />
                    <XAxis type="number" unit=" %" tick={{ fontSize: chartFontSize(), fill: 'var(--color-slate-600)' }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={1} tickLine={false} axisLine={false} tick={NameAbove} interval={0} />
                    <Tooltip formatter={(v, n) => [`${v} %`, n === 'written' ? t('claim.lrWritten') : t('claim.lrEarned')]} cursor={{ fill: 'var(--color-slate-50)' }} />
                    <Legend formatter={(v) => (v === 'written' ? t('claim.lrWritten') : t('claim.lrEarned'))} />
                    <Bar dataKey="written" fill="var(--color-brand-300)" radius={[0, 3, 3, 0]} barSize={12} isAnimationActive={false} />
                    <Bar dataKey="earned" fill="var(--color-brand-600)" radius={[0, 3, 3, 0]} barSize={12} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-table" data-ratio-table>
                  <thead>
                    <tr className="border-b text-small text-muted-foreground">
                      <th className="h-11 px-3 text-left font-medium">{by === 'mga' ? t('fields.mga') : by === 'lob' ? t('fields.lob') : t('claim.uwYear')}</th>
                      <th className="h-11 px-3 text-right font-medium">{t('claim.writtenUsd')}</th>
                      <th className="h-11 px-3 text-right font-medium">{t('claim.earnedUsd')}</th>
                      <th className="h-11 px-3 text-right font-medium">{t('claim.incurredUsd')}</th>
                      <th className="h-11 px-3 text-right font-medium">{t('claim.lrWritten')}</th>
                      <th className="h-11 px-3 text-right font-medium">{t('claim.lrEarned')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ratios.rows.map((r) => (
                      <tr key={r.key} className="h-12 border-b last:border-0">
                        <td className="max-w-64 truncate px-3" title={r.name}>{r.name}</td>
                        <td className="px-3 text-right num">{formatAmount(r.written)}</td>
                        <td className="px-3 text-right num">{formatAmount(r.earned)}</td>
                        <td className="px-3 text-right num">{formatAmount(r.incurred)}</td>
                        <td className="px-3 text-right num">{pct(r.lrWritten)}</td>
                        <td className="px-3 text-right font-medium num">{pct(r.lrEarned)}</td>
                      </tr>
                    ))}
                    <tr className="h-12 font-semibold">
                      <td className="px-3">{t('prem.total')}</td>
                      <td className="px-3 text-right num">{formatAmount(ratios.total.written)}</td>
                      <td className="px-3 text-right num">{formatAmount(ratios.total.earned)}</td>
                      <td className="px-3 text-right num">{formatAmount(ratios.total.incurred)}</td>
                      <td className="px-3 text-right num">{pct(ratios.total.lrWritten)}</td>
                      <td className="px-3 text-right num">{pct(ratios.total.lrEarned)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

    </section>
  )
}

/** A category tick drawn above its pair of bars (2 × 12 px around the tick), from the plot's left edge — even when both bars are 0. */
function NameAbove({ x, y, payload }: { x?: number | string; y?: number | string; payload?: { value?: unknown } }) {
  return (
    <text x={Number(x)} y={Number(y) - 19} fontSize={chartFontSize()} fill="var(--color-slate-700)" textAnchor="start">
      {String(payload?.value ?? '')}
    </text>
  )
}

type ClaimRows = NonNullable<ReturnType<typeof useAllClaims>['data']>
/**
 * The amount a large loss is flagged on (claim_check_large_loss): our share of
 * the estimate, or of the reserves when they are higher, in USD. Null without a rate.
 */
export const largeLossBasisUsd = (r: Pick<ClaimRows[number], 'estimate_our_share_usd' | 'reserves_total' | 'fx_rate_to_usd'>) => {
  if (r.fx_rate_to_usd === null) return r.estimate_our_share_usd
  const reserves = Math.round(Number(r.reserves_total ?? 0) * r.fx_rate_to_usd * 100) / 100
  return Math.max(r.estimate_our_share_usd ?? 0, reserves)
}
const largeLosses = (rows: ClaimRows) => rows.filter((r) => r.large_loss).sort((a, b) => (largeLossBasisUsd(b) ?? 0) - (largeLossBasisUsd(a) ?? 0))
const cashCallsDue = (rows: ClaimRows) => rows.filter((r) => r.cash_call_due_at).sort((a, b) => a.cash_call_due_at!.localeCompare(b.cash_call_due_at!))

/** «Needs attention»: the largest large losses. */
export function LargeLosses() {
  const { t } = useTranslation()
  const claims = useAllClaims()
  const threshold = useNumberSetting('large_loss_threshold_usd', LARGE_LOSS_DEFAULT_USD)
  const large = largeLosses(claims.data ?? [])
  const human = (v: number | null) => (v === null ? '—' : formatHuman(v))
  return (
    <AttentionCard title={t('claim.largeLosses')} count={large.length} to={cl('large')} empty={t('claim.noLarge')} loading={claims.isLoading} error={claims.error} data="large-losses">
      {large.slice(0, ATTENTION_MAX).map((r) => {
        // the figure that set the flag, not the incurred so far (a fresh loss is reserved far below its estimate)
        const basis = largeLossBasisUsd(r)
        return (
          <RefRow key={r.id} to={`/claims/${r.id}`}>
            <RefLines name={r.insured_name} refNo={r.claim_no} sub={`${r.mga_name ?? ''} · ${formatDate(r.date_of_loss)}`} />
            <RefFigure sub={<span className="num" data-large-loss-sub>{t('claim.largeLossSub', { incurred: human(r.incurred_usd), outstanding: human(r.outstanding_usd) })}</span>}>
              {basis === null ? (
                <LargeLossBadge />
              ) : (
                <Hint content={t('claim.largeLossBasis', { threshold: formatAmount(threshold), amount: formatAmount(basis) })}>
                  <span tabIndex={0} className="num cursor-default font-semibold underline decoration-slate-300 decoration-dotted underline-offset-4" data-large-loss-basis={basis}>
                    {formatHuman(basis)} <span className="font-normal text-muted-foreground">USD</span>
                  </span>
                </Hint>
              )}
            </RefFigure>
          </RefRow>
        )
      })}
    </AttentionCard>
  )
}

/** «Needs attention»: cash calls, the earliest due first (past due in the danger ink). */
export function CashCallsDue() {
  const { t } = useTranslation()
  const claims = useAllClaims()
  const calls = cashCallsDue(claims.data ?? [])
  const now = new Date().toISOString()
  return (
    <AttentionCard title={t('claim.cashCallsDue')} count={calls.length} to={cl('cashcall')} empty={t('claim.noCashCalls')} loading={claims.isLoading} error={claims.error} data="cash-calls">
      {calls.slice(0, ATTENTION_MAX).map((r) => (
        <RefRow key={r.id} to={`/claims/${r.id}`}>
          <RefLines name={r.insured_name} refNo={r.claim_no} sub={r.mga_name} />
          <RefFigure className={r.cash_call_due_at! < now ? 'text-destructive' : undefined}>{formatDate(r.cash_call_due_at)}</RefFigure>
        </RefRow>
      ))}
    </AttentionCard>
  )
}
