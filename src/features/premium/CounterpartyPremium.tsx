import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Amount } from '@/components/Amount'
import { Skeleton } from '@/components/Skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { isoDate } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import { quoteValue } from '@/features/search/query'
import { pageLink, RECEIPTS_PAGE, RECEIVABLES_PAGE } from '@/features/search/pages'
import { AGING_BUCKETS } from '@/features/search/scopes'
import { premiumSummary, usePremiumOverview } from './summary'

/**
 * Counterparty page › Premium: what this MGA / broker owes us (outstanding,
 * overdue by bucket), what we owe them back (payable, apart) and what they
 * paid this year. Links open the registers filtered to them.
 */
export function CounterpartyPremium({ party }: { party: { id: string; name: string; type: string } }) {
  const { t } = useTranslation()
  const overview = usePremiumOverview(party)
  const field = party.type === 'broker' ? 'broker' : 'mga'
  const who = `${field}:${quoteValue(party.name)}`
  const today = isoDate()

  return (
    <Card data-counterparty-premium>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{t('cp.premium.title')}</CardTitle>
        <Link to={pageLink(RECEIVABLES_PAGE, who)} className="text-body text-link hover:underline">{t('cp.premium.open')}</Link>
      </CardHeader>
      <CardContent className="grid gap-4">
        {overview.isLoading && <Skeleton className="h-32 rounded-md" />}
        {overview.error && <p className="text-body text-destructive">{errorMessage(overview.error)}</p>}
        {overview.data && (() => {
          const s = premiumSummary(overview.data.rows, overview.data.receipts, today)
          return (
            <>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-caption text-muted-foreground">{t('dash.premium.outstanding')}</dt>
                  <dd className="font-display-bold text-headline"><Amount value={s.outstandingUsd} currency="USD" human /></dd>
                </div>
                <div>
                  <dt className="text-caption text-muted-foreground">{t('dash.premium.overdue')}</dt>
                  <dd className={s.overdueUsd > 0 ? 'font-display-bold text-headline text-destructive' : 'font-display-bold text-headline'}>
                    <Link to={pageLink(RECEIVABLES_PAGE, `${who}, overdue`)} className="hover:underline"><Amount value={s.overdueUsd} currency="USD" human /></Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-muted-foreground">{t('rcv.payableTile')}</dt>
                  <dd className="text-lead font-semibold"><Link to={pageLink(RECEIVABLES_PAGE, `${who}, payable`)} className="hover:underline"><Amount value={s.payableUsd} currency="USD" human /></Link></dd>
                </div>
                <div>
                  <dt className="text-caption text-muted-foreground">{t('dash.premium.receivedYear', { year: today.slice(0, 4) })}</dt>
                  <dd className="text-lead font-semibold">
                    <Link to={pageLink(RECEIPTS_PAGE, `payer:${quoteValue(party.name)}, received>=${today.slice(0, 4)}-01-01`)} className="hover:underline">
                      <Amount value={s.receivedYearUsd} currency="USD" human />
                    </Link>
                  </dd>
                </div>
              </dl>
              <ul className="grid gap-1 border-t pt-3 text-body" aria-label={t('rcv.ageing')}>
                {AGING_BUCKETS.map((b) => (
                  <li key={b}>
                    <Link to={pageLink(RECEIVABLES_PAGE, `${who}, bucket:${b}`)} className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-slate-50">
                      <span className="text-muted-foreground">{t('rcv.bucketDays', { bucket: b })}</span>
                      <Amount value={s.buckets[b]} currency="USD" human className="font-medium" />
                    </Link>
                  </li>
                ))}
              </ul>
              {s.missingRate + s.payableMissingRate + s.receiptsMissingRate > 0 && (
                <p className="text-caption text-warning-700">{t('dash.premium.missingRate', { count: s.missingRate + s.payableMissingRate + s.receiptsMissingRate })}</p>
              )}
            </>
          )
        })()}
      </CardContent>
    </Card>
  )
}
