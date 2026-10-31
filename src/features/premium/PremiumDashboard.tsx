import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AlarmClock, Banknote, CalendarRange, Undo2, Wallet } from 'lucide-react'
import { KPI_GRID_5, KPI_SPAN_5, KpiCard } from '@/components/KpiCard'
import { Amount } from '@/components/Amount'
import { AgingBadge } from '@/components/AgingBadge'
import { EmptyState } from '@/components/EmptyState'
import { AgeingBreakdown } from '@/components/AgeingBar'
import { Skeleton } from '@/components/Skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatAmount, isoDate } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import { quoteValue } from '@/features/search/query'
import { pageLink, RECEIPTS_PAGE, RECEIVABLES_PAGE } from '@/features/search/pages'
import { AGING_BUCKETS } from '@/features/search/scopes'
import { ATTENTION_MAX, AttentionCard, RefFigure, RefLines, RefRow } from '@/features/dashboard/Attention'
import { premiumSummary, usePremiumOverview } from './summary'

const rcv = (q: string) => pageLink(RECEIVABLES_PAGE, q)
const rcp = (q: string) => pageLink(RECEIPTS_PAGE, q)

/**
 * Dashboard › Premium: outstanding and overdue (with buckets), cash received
 * this month / year, payable to MGAs kept apart, top MGAs by overdue. Every
 * figure opens the register it comes from. The most overdue items are in
 * «Needs attention» ({@link MostOverduePremium}).
 */
export function PremiumDashboard() {
  const { t } = useTranslation()
  const overview = usePremiumOverview()
  const today = isoDate()

  if (overview.isLoading)
    return (
      <div className={`mb-4 ${KPI_GRID_5}`}>
        {KPI_SPAN_5.map((span, i) => <Skeleton key={i} className={`h-32 rounded-xl ${span}`} />)}
      </div>
    )
  if (overview.error) return <p className="mb-4 text-body text-destructive">{errorMessage(overview.error)}</p>

  const s = premiumSummary(overview.data!.rows, overview.data!.receipts, today)
  const year = today.slice(0, 4)
  const maxMga = Math.max(1, ...s.topMgas.map((m) => m.usd))

  return (
    <section aria-labelledby="dash-premium" className="mb-4 grid gap-4" data-premium-dashboard>
      <h2 id="dash-premium" className="text-title font-semibold">{t('dash.premium.title')}</h2>
      <div className={KPI_GRID_5}>
        <KpiCard className={KPI_SPAN_5[0]} icon={Wallet} label={t('dash.premium.outstanding')} value={<Amount value={s.outstandingUsd} human />} sub={<>USD · {t('dash.premium.notDue', { amount: formatAmount(s.notDueUsd) })}</>} to={rcv('')} />
        <KpiCard
          className={KPI_SPAN_5[1]}
          icon={AlarmClock}
          label={t('dash.premium.overdue')}
          value={<Amount value={s.overdueUsd} human />}
          sub={<>USD · {t('rcv.count', { count: s.overdueCount })}</>}
          to={rcv('overdue')}
          alert={s.overdueUsd > 0}
        />
        <KpiCard className={KPI_SPAN_5[2]} icon={Banknote} label={t('dash.premium.receivedMonth')} value={<Amount value={s.receivedMonthUsd} human />} sub="USD" to={rcp('received:thismonth')} />
        <KpiCard className={KPI_SPAN_5[3]} icon={CalendarRange} label={t('dash.premium.receivedYear', { year })} value={<Amount value={s.receivedYearUsd} human />} sub="USD" to={rcp(`received>=${year}-01-01`)} />
        <KpiCard
          className={KPI_SPAN_5[4]}
          icon={Undo2}
          label={t('rcv.payableTile')}
          value={<Amount value={s.payableUsd} human />}
          sub={<>USD · {t('rcv.payableSub', { count: s.payableCount })}</>}
          to={rcv('payable')}
        />
      </div>
      {(s.missingRate > 0 || s.payableMissingRate > 0 || s.receiptsMissingRate > 0) && (
        <p className="text-caption text-warning-700" data-missing-rate>
          {t('dash.premium.missingRate', { count: s.missingRate + s.payableMissingRate + s.receiptsMissingRate })}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t('dash.premium.overdueByAge')}</CardTitle></CardHeader>
          <CardContent>
            <AgeingBreakdown
              columns={1}
              items={AGING_BUCKETS.map((b) => ({
                bucket: b,
                label: t('rcv.bucketDays', { bucket: b }),
                weight: s.buckets[b],
                value: <Amount value={s.buckets[b]} currency="USD" human />,
                to: rcv(`bucket:${b}`),
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('dash.premium.topMgas')}</CardTitle></CardHeader>
          <CardContent>
            {s.topMgas.length === 0 ? (
              <EmptyState pictogram="done" title={t('dash.premium.noOverdue')} compact />
            ) : (
              <ul className="grid gap-1" data-top-mgas>
                {s.topMgas.map((m) => (
                  <li key={m.id}>
                    <Link to={rcv(`mga:${quoteValue(m.name)}, overdue`)} className="grid gap-1 rounded-md px-2 py-2 text-body transition-colors hover:bg-slate-50">
                      <span className="flex items-center gap-3">
                        <span className="min-w-0 flex-1 truncate" title={m.name}>{m.name}</span>
                        <Amount value={m.usd} currency="USD" human className="font-semibold" />
                      </span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                        <span className="block h-full rounded-full bg-danger-500" style={{ width: `${(m.usd / maxMga) * 100}%` }} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

      </div>
    </section>
  )
}

/** «Needs attention»: the most overdue premium installments, oldest first. */
export function MostOverduePremium() {
  const { t } = useTranslation()
  const overview = usePremiumOverview()
  const s = overview.data ? premiumSummary(overview.data.rows, overview.data.receipts, isoDate()) : null
  return (
    <AttentionCard
      title={t('dash.premium.mostOverdue')}
      count={s?.overdueCount ?? 0}
      to={rcv('overdue')}
      empty={t('dash.premium.noOverdue')}
      loading={overview.isLoading}
      error={overview.error}
      data="most-overdue"
    >
      {s?.mostOverdue.slice(0, ATTENTION_MAX).map((r) => (
        <RefRow key={r.id} to={`/submissions/${r.submission_id}`}>
          <RefLines name={r.insured_name} refNo={`${r.ref_no} #${r.installment_no}`} sub={r.mga_name} />
          <RefFigure sub={<span className="num">{formatAmount(r.outstanding_amount)} {r.currency ?? ''}</span>}><AgingBadge days={r.days_overdue ?? 0} /></RefFigure>
        </RefRow>
      ))}
    </AttentionCard>
  )
}
