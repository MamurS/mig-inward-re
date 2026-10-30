import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AlarmClock, Banknote, CalendarRange, Undo2, Wallet } from 'lucide-react'
import { KpiCard } from '@/components/KpiCard'
import { Amount } from '@/components/Amount'
import { AgingBadge } from '@/components/AgingBadge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatAmount, isoDate } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import { quoteValue } from '@/features/search/query'
import { pageLink, RECEIPTS_PAGE, RECEIVABLES_PAGE } from '@/features/search/pages'
import { AGING_BUCKETS } from '@/features/search/scopes'
import { premiumSummary, usePremiumOverview } from './summary'

const BUCKET_COLOUR: Record<(typeof AGING_BUCKETS)[number], string> = {
  '0-30': 'var(--color-aging-0to30)',
  '31-60': 'var(--color-aging-31to60)',
  '61-90': 'var(--color-aging-61to90)',
  '90+': 'var(--color-aging-90plus)',
}

const rcv = (q: string) => pageLink(RECEIVABLES_PAGE, q)
const rcp = (q: string) => pageLink(RECEIPTS_PAGE, q)

/**
 * Dashboard › Premium: outstanding and overdue (with buckets), cash received
 * this month / year, payable to MGAs kept apart, top MGAs by overdue and the
 * most overdue items. Every figure opens the register it comes from.
 */
export function PremiumDashboard() {
  const { t } = useTranslation()
  const overview = usePremiumOverview()
  const today = isoDate()

  if (overview.isLoading)
    return (
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
    )
  if (overview.error) return <p className="mb-4 text-body text-destructive">{errorMessage(overview.error)}</p>

  const s = premiumSummary(overview.data!.rows, overview.data!.receipts, today)
  const year = today.slice(0, 4)
  const maxMga = Math.max(1, ...s.topMgas.map((m) => m.usd))

  return (
    <section aria-labelledby="dash-premium" className="mb-4 grid gap-4" data-premium-dashboard>
      <h2 id="dash-premium" className="text-title font-semibold">{t('dash.premium.title')}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
        <KpiCard icon={Wallet} label={t('dash.premium.outstanding')} value={<Amount value={s.outstandingUsd} human />} sub={<>USD · {t('dash.premium.notDue', { amount: formatAmount(s.notDueUsd) })}</>} to={rcv('')} />
        <KpiCard
          icon={AlarmClock}
          label={t('dash.premium.overdue')}
          value={<Amount value={s.overdueUsd} human />}
          sub={<>USD · {t('rcv.count', { count: s.overdueCount })}</>}
          to={rcv('overdue')}
          alert={s.overdueUsd > 0}
        />
        <KpiCard icon={Banknote} label={t('dash.premium.receivedMonth')} value={<Amount value={s.receivedMonthUsd} human />} sub="USD" to={rcp('received:thismonth')} />
        <KpiCard icon={CalendarRange} label={t('dash.premium.receivedYear', { year })} value={<Amount value={s.receivedYearUsd} human />} sub="USD" to={rcp(`received>=${year}-01-01`)} />
        <KpiCard
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
          <CardContent className="grid gap-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              {s.overdueUsd > 0 && AGING_BUCKETS.map((b) => s.buckets[b] > 0 && <span key={b} style={{ width: `${(s.buckets[b] / s.overdueUsd) * 100}%`, background: BUCKET_COLOUR[b] }} />)}
            </div>
            <ul className="grid gap-1">
              {AGING_BUCKETS.map((b) => (
                <li key={b}>
                  <Link to={rcv(`bucket:${b}`)} className="flex items-center gap-3 rounded-md px-2 py-2 text-body transition-colors hover:bg-slate-50">
                    <span className="size-3 shrink-0 rounded-sm" style={{ background: BUCKET_COLOUR[b] }} />
                    <span className="flex-1">{t('rcv.bucketDays', { bucket: b })}</span>
                    <Amount value={s.buckets[b]} currency="USD" human className="font-semibold" />
                  </Link>
                </li>
              ))}
            </ul>
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

        <Card className="gap-0 py-0 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2 py-4">
            <CardTitle>{t('dash.premium.mostOverdue')}</CardTitle>
            <Link to={rcv('overdue')} className="text-body text-link hover:underline">{t('dash.openInRegister')}</Link>
          </CardHeader>
          {s.mostOverdue.length === 0 ? (
            <EmptyState pictogram="done" title={t('dash.premium.noOverdue')} compact />
          ) : (
            <ul className="grid grid-cols-[max-content_minmax(0,1fr)_auto] border-t sm:grid-cols-[max-content_minmax(0,1fr)_auto_auto]" data-most-overdue data-ref-list>
              {s.mostOverdue.map((r) => (
                <li key={r.id} className="col-span-full grid grid-cols-subgrid">
                  <Link to={`/submissions/${r.submission_id}`} className="col-span-full grid grid-cols-subgrid items-baseline gap-x-3 border-b px-5 py-2 text-body transition-colors hover:bg-slate-50">
                    <span className="font-medium whitespace-nowrap text-link num" data-ref>{r.ref_no} #{r.installment_no}</span>
                    <span className="min-w-0">
                      <span className="block truncate" title={r.insured_name ?? ''}>{r.insured_name}</span>
                      <span className="block truncate text-caption text-muted-foreground">{r.mga_name}</span>
                    </span>
                    <span className="hidden sm:inline"><AgingBadge days={r.days_overdue ?? 0} /></span>
                    <span className="text-right whitespace-nowrap num">{formatAmount(r.outstanding_amount)} <span className="text-caption text-muted-foreground">{r.currency}</span></span>
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
