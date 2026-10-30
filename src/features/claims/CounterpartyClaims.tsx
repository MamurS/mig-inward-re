import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Amount } from '@/components/Amount'
import { Skeleton } from '@/components/Skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { isoDate, locale } from '@/lib/format'
import { quoteValue } from '@/features/search/query'
import { CLAIMS_PAGE, pageLink } from '@/features/search/pages'
import { useAllClaims, useRatioRisks } from './api'
import { lossRatios } from './ratios'

export const pct = (v: number | null) => (v === null ? '—' : `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(v * 100)} %`)

/** Counterparty page › Claims: open claims, outstanding and incurred (USD), and this MGA's loss ratios, both kinds, labelled. */
export function CounterpartyClaims({ party }: { party: { id: string; name: string; type: string } }) {
  const { t } = useTranslation()
  const isMga = party.type === 'mga'
  const claims = useAllClaims({ column: isMga ? 'mga_id' : 'broker_id', value: party.id })
  const risks = useRatioRisks(party.id, isMga)
  const who = `${isMga ? 'mga' : 'broker'}:${quoteValue(party.name)}`

  return (
    <Card data-counterparty-claims>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{t('claim.cpTitle')}</CardTitle>
        <Link to={pageLink(CLAIMS_PAGE, who)} className="text-body text-link hover:underline">{t('claim.openInClaims')}</Link>
      </CardHeader>
      <CardContent className="grid gap-4">
        {(claims.isLoading || (isMga && risks.isLoading)) && <Skeleton className="h-24 rounded-md" />}
        {claims.data && (() => {
          const rows = claims.data
          const open = rows.filter((r) => r.status === 'notified' || r.status === 'open' || r.status === 'reopened')
          const lr = isMga && risks.data ? lossRatios(risks.data, rows, 'mga', isoDate()).total : null
          return (
            <>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-caption text-muted-foreground">{t('claim.openClaims')}</dt>
                  <dd className="font-display-bold text-headline num">
                    <Link to={pageLink(CLAIMS_PAGE, `${who}, status:notified|open|reopened`)} className="hover:underline">{open.length}</Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-muted-foreground">{t('claim.outstandingUsd')}</dt>
                  <dd className="font-display-bold text-headline"><Amount value={open.reduce((s, r) => s + (r.outstanding_usd ?? 0), 0)} human /></dd>
                </div>
                <div>
                  <dt className="text-caption text-muted-foreground">{t('claim.incurredUsd')}</dt>
                  <dd className="text-lead font-semibold"><Amount value={rows.reduce((s, r) => s + (r.incurred_usd ?? 0), 0)} human /></dd>
                </div>
                <div>
                  <dt className="text-caption text-muted-foreground">{t('claim.largeLosses')}</dt>
                  <dd className="text-lead font-semibold num">
                    <Link to={pageLink(CLAIMS_PAGE, `${who}, large`)} className="hover:underline">{rows.filter((r) => r.large_loss).length}</Link>
                  </dd>
                </div>
              </dl>
              {lr && (
                <dl className="grid grid-cols-2 gap-4 border-t pt-3" data-loss-ratio>
                  <div>
                    <dt className="text-caption text-muted-foreground">{t('claim.lrWritten')}</dt>
                    <dd className="text-lead font-semibold num">{pct(lr.lrWritten)}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">{t('claim.lrEarned')}</dt>
                    <dd className="text-lead font-semibold num">{pct(lr.lrEarned)}</dd>
                  </div>
                </dl>
              )}
              {lr && <p className="text-caption text-muted-foreground">{t('claim.lrExplain')}</p>}
              {rows.some((r) => r.incurred_usd === null) && <p className="text-caption text-warning-700">{t('rcv.missingRate', { count: rows.filter((r) => r.incurred_usd === null).length })}</p>}
            </>
          )
        })()}
      </CardContent>
    </Card>
  )
}
