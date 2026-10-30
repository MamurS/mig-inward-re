import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Banknote, CircleDollarSign, Flame, FolderOpen, Scale, Wallet } from 'lucide-react'
import { KpiCard } from '@/components/KpiCard'
import { Amount } from '@/components/Amount'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SegmentedControl } from '@/components/SegmentedControl'
import { formatAmount, formatDate, isoDate } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import { CLAIMS_PAGE, pageLink } from '@/features/search/pages'
import { useAllClaims, useClaimPayments, useRatioRisks } from './api'
import { lossRatios } from './ratios'
import { pct } from './CounterpartyClaims'
import { LargeLossBadge } from './ClaimStatusBadge'

const cl = (q: string) => pageLink(CLAIMS_PAGE, q)
const OPEN = 'status:notified|open|reopened'

/**
 * Dashboard › Claims: open claims, outstanding reserves, paid and incurred
 * this year (USD, our share), loss ratios (incurred / written and incurred /
 * earned — always labelled), large losses and cash calls due. Every figure
 * opens the filtered claims register.
 */
export function ClaimsDashboard() {
  const { t } = useTranslation()
  const today = isoDate()
  const year = today.slice(0, 4)
  const claims = useAllClaims()
  const payments = useClaimPayments(`${year}-01-01`)
  const risks = useRatioRisks()
  const [by, setBy] = useState<'mga' | 'lob' | 'year'>('mga')

  if (claims.isLoading || payments.isLoading)
    return <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
  if (claims.error) return <p className="mb-4 text-body text-destructive">{errorMessage(claims.error)}</p>

  const rows = claims.data ?? []
  const open = rows.filter((r) => r.status === 'notified' || r.status === 'open' || r.status === 'reopened')
  const outstandingUsd = open.reduce((s, r) => s + (r.outstanding_usd ?? 0), 0)
  const paidYtd = (payments.data ?? []).reduce((s, p) => s + (p.amount_usd ?? 0), 0)
  const incurredYtdRows = rows.filter((r) => r.date_of_loss?.startsWith(year))
  const incurredYtd = incurredYtdRows.reduce((s, r) => s + (r.incurred_usd ?? 0), 0)
  const large = rows.filter((r) => r.large_loss).sort((a, b) => (b.incurred_usd ?? 0) - (a.incurred_usd ?? 0))
  const cashCalls = rows.filter((r) => r.cash_call_due_at).sort((a, b) => a.cash_call_due_at!.localeCompare(b.cash_call_due_at!))
  const noRate = rows.filter((r) => r.fx_rate_to_usd === null).length + (payments.data ?? []).filter((p) => p.amount_usd === null).length
  const ratios = risks.data ? lossRatios(risks.data, rows, by, today) : null
  const chartData = (ratios?.rows ?? []).filter((r) => r.lrWritten !== null || r.lrEarned !== null).slice(0, 8)
    .map((r) => ({ name: r.name, written: r.lrWritten === null ? 0 : Math.round(r.lrWritten * 1000) / 10, earned: r.lrEarned === null ? 0 : Math.round(r.lrEarned * 1000) / 10 }))

  return (
    <section aria-labelledby="dash-claims" className="mb-4 grid gap-4" data-claims-dashboard>
      <h2 id="dash-claims" className="text-title font-semibold">{t('claim.dashTitle')}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
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
                <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 44 + 40)}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 32 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--color-slate-200)" />
                    <XAxis type="number" unit=" %" tick={{ fontSize: 12, fill: 'var(--color-slate-600)' }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={180} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--color-slate-600)' }} tickFormatter={(v: string) => (v.length > 26 ? `${v.slice(0, 25)}…` : v)} />
                    <Tooltip formatter={(v, n) => [`${v} %`, n === 'written' ? t('claim.lrWritten') : t('claim.lrEarned')]} cursor={{ fill: 'var(--color-slate-50)' }} />
                    <Legend formatter={(v) => (v === 'written' ? t('claim.lrWritten') : t('claim.lrEarned'))} />
                    <Bar dataKey="written" fill="var(--color-brand-300)" radius={[0, 3, 3, 0]} isAnimationActive={false} />
                    <Bar dataKey="earned" fill="var(--color-brand-600)" radius={[0, 3, 3, 0]} isAnimationActive={false} />
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row items-center justify-between gap-2 py-4">
            <CardTitle>{t('claim.largeLosses')}</CardTitle>
            <Link to={cl('large')} className="text-body text-link hover:underline">{t('dash.openInRegister')}</Link>
          </CardHeader>
          {large.length === 0 ? (
            <EmptyState pictogram="done" title={t('claim.noLarge')} compact />
          ) : (
            <ul className="grid grid-cols-[max-content_minmax(8rem,1fr)_auto] border-t" data-ref-list data-large-losses>
              {large.slice(0, 8).map((r) => (
                <li key={r.id} className="col-span-full grid grid-cols-subgrid">
                  <Link to={`/claims/${r.id}`} className="col-span-full grid grid-cols-subgrid items-baseline gap-x-3 border-b px-5 py-2 text-body hover:bg-slate-50">
                    <span className="font-medium whitespace-nowrap text-link num" data-ref>{r.claim_no}</span>
                    <span className="min-w-0">
                      <span className="block truncate" title={r.insured_name ?? ''}>{r.insured_name}</span>
                      <span className="block truncate text-caption text-muted-foreground">{r.mga_name} · {formatDate(r.date_of_loss)}</span>
                    </span>
                    <span className="text-right whitespace-nowrap">{r.incurred_usd === null ? <LargeLossBadge /> : <Amount value={r.incurred_usd} currency="USD" human />}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row items-center justify-between gap-2 py-4">
            <CardTitle>{t('claim.cashCallsDue')}</CardTitle>
            <Link to={cl('cashcall')} className="text-body text-link hover:underline">{t('dash.openInRegister')}</Link>
          </CardHeader>
          {cashCalls.length === 0 ? (
            <EmptyState pictogram="done" title={t('claim.noCashCalls')} compact />
          ) : (
            <ul className="grid grid-cols-[max-content_minmax(8rem,1fr)_auto] border-t" data-ref-list data-cash-calls>
              {cashCalls.slice(0, 8).map((r) => (
                <li key={r.id} className="col-span-full grid grid-cols-subgrid">
                  <Link to={`/claims/${r.id}`} className="col-span-full grid grid-cols-subgrid items-baseline gap-x-3 border-b px-5 py-2 text-body hover:bg-slate-50">
                    <span className="font-medium whitespace-nowrap text-link num" data-ref>{r.claim_no}</span>
                    <span className="min-w-0">
                      <span className="block truncate" title={r.insured_name ?? ''}>{r.insured_name}</span>
                      <span className="block truncate text-caption text-muted-foreground">{r.mga_name}</span>
                    </span>
                    <span className={r.cash_call_due_at! < new Date().toISOString() ? 'whitespace-nowrap text-destructive' : 'whitespace-nowrap'}>{formatDate(r.cash_call_due_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  )
}
