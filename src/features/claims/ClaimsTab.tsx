import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { useAuth } from '@/auth/AuthProvider'
import { can } from '@/lib/roles'
import { formatAmount, formatDate } from '@/lib/format'
import { useAllClaims } from './api'
import { ClaimStatusBadge, LargeLossBadge } from './ClaimStatusBadge'
import { NewClaimDialog } from './NewClaimDialog'

/** Submission › Claims: that risk's claims and their totals (our share, the risk's currency). */
export function ClaimsTab({ submissionId, currency }: { submissionId: string; currency: string | null }) {
  const { t } = useTranslation()
  const { role } = useAuth()
  const claims = useAllClaims({ column: 'submission_id', value: submissionId })
  const [creating, setCreating] = useState(false)
  const rows = claims.data ?? []
  const sum = (k: 'outstanding' | 'paid_total' | 'recoveries_total' | 'incurred') => rows.filter((r) => r.currency === currency).reduce((s, r) => s + Number(r[k] ?? 0), 0)
  const otherCcy = rows.some((r) => r.currency !== currency)

  return (
    <div className="grid gap-4" data-claims-tab>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-body">
          {(['outstanding', 'paid_total', 'recoveries_total', 'incurred'] as const).map((k) => (
            <div key={k}>
              <dt className="text-caption text-muted-foreground">{t(`claim.totals.${k}`)} {currency}</dt>
              <dd className="font-semibold num">{formatAmount(sum(k))}</dd>
            </div>
          ))}
        </dl>
        {can.manageClaims(role) && <Button size="sm" onClick={() => setCreating(true)}><Plus />{t('claim.new')}</Button>}
      </div>
      {otherCcy && <p className="text-caption text-warning-700">{t('claim.otherCurrencyNote')}</p>}
      {claims.isLoading && <Skeleton className="h-24 rounded-md" />}
      {!claims.isLoading && rows.length === 0 && <EmptyState pictogram="done" title={t('claim.noneOnRisk')} compact />}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-table">
            <thead>
              <tr className="border-b text-small text-muted-foreground">
                <th className="h-11 px-3 text-left font-medium">{t('claim.claimNo')}</th>
                <th className="h-11 px-3 text-left font-medium">{t('claim.dateOfLoss')}</th>
                <th className="h-11 px-3 text-left font-medium">{t('claim.cause')}</th>
                <th className="h-11 px-3 text-left font-medium">{t('fields.status')}</th>
                <th className="h-11 px-3 text-right font-medium">{t('claim.outstanding')}</th>
                <th className="h-11 px-3 text-right font-medium">{t('claim.paid')}</th>
                <th className="h-11 px-3 text-right font-medium">{t('claim.incurred')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="h-12 border-b last:border-0">
                  <td className="px-3 whitespace-nowrap">
                    <Link to={`/claims/${r.id}`} className="font-medium text-link num hover:underline" data-ref>{r.claim_no}</Link>
                    {r.large_loss && <LargeLossBadge className="ml-2" />}
                  </td>
                  <td className="px-3 whitespace-nowrap">{formatDate(r.date_of_loss)}</td>
                  <td className="px-3">{r.cause ?? '—'}</td>
                  <td className="px-3"><ClaimStatusBadge status={r.status} /></td>
                  <td className="px-3 text-right whitespace-nowrap num">{formatAmount(r.outstanding)} <span className="text-caption text-muted-foreground">{r.currency}</span></td>
                  <td className="px-3 text-right whitespace-nowrap num">{formatAmount(r.paid_total)}</td>
                  <td className="px-3 text-right whitespace-nowrap num">{formatAmount(r.incurred)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <NewClaimDialog open={creating} onClose={() => setCreating(false)} submissionId={submissionId} />
    </div>
  )
}
