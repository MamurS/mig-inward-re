import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, Clock, Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { InfoItem } from '@/components/Field'
import { StatusBadge } from '@/components/StatusBadge'
import { Amount } from '@/components/Amount'
import { useAuth } from '@/auth/AuthProvider'
import { can } from '@/lib/roles'
import { formatDate, formatPct } from '@/lib/format'
import type { SubmissionRow } from './api'

/** The register's quick view: the essentials of a submission without leaving the list. */
export function SubmissionQuickView({ row, onClose }: { row: SubmissionRow | null; onClose: () => void }) {
  const { t } = useTranslation()
  const { role } = useAuth()
  const r = row
  return (
    <Dialog open={Boolean(r)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined}>
        {r && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className="text-caption font-medium text-muted-foreground num">{r.ref_no}</span>
                <StatusBadge status={r.status} />
              </div>
              <DialogTitle>{r.insured_name}</DialogTitle>
              <DialogDescription>{[r.mga_name, r.lob_name].filter(Boolean).join(' · ')}</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-4">
              <div className="grid gap-1">
                <span className="text-caption text-muted-foreground">{t('fields.ourGrossPremium')}</span>
                <Amount value={r.our_gross_premium} currency={r.currency} className="text-lead font-semibold" />
              </div>
              <div className="grid gap-1">
                <span className="text-caption text-muted-foreground">{t('fields.ourGrossUsd')}</span>
                <Amount value={r.our_gross_premium_usd} currency="USD" className="text-lead font-semibold" />
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <InfoItem label={t('fields.receivedAt')}>{formatDate(r.received_at)}</InfoItem>
              <InfoItem label={t('fields.underwriter')}>{r.underwriter_name ?? '—'}</InfoItem>
              <InfoItem label={t('fields.broker')}>{r.broker_name ?? t('sub.directNoBroker')}</InfoItem>
              <InfoItem label={t('fields.businessType')}>{r.business_type ? t(`businessType.${r.business_type}`) : '—'}</InfoItem>
              <InfoItem label={t('fields.period')}>{r.period_from || r.period_to ? `${formatDate(r.period_from)} – ${formatDate(r.period_to)}` : '—'}</InfoItem>
              <InfoItem label={t('fields.grossPremium100')}><Amount value={r.gross_premium_100} currency={r.currency} /></InfoItem>
              <InfoItem label={t('fields.share')}>{formatPct(r.signed_share_pct ?? r.written_share_pct)}</InfoItem>
              <InfoItem label={t('fields.offerValidUntil')}>{formatDate(r.offer_valid_until)}</InfoItem>
              <InfoItem label={t('fields.nextFollowUp')}>
                {r.next_follow_up_at ? (
                  <span className={r.follow_up_overdue ? 'inline-flex items-center gap-1 font-medium text-destructive' : undefined}>
                    {r.follow_up_overdue && <Clock className="size-3.5" />}
                    {formatDate(r.next_follow_up_at)}
                  </span>
                ) : '—'}
              </InfoItem>
              {r.risk_description && <InfoItem label={t('fields.riskDescription')} className="col-span-2">{r.risk_description}</InfoItem>}
            </dl>

            <DialogFooter>
              {can.editSubmissions(role) && (
                <Button variant="outline" asChild>
                  <Link to={`/submissions/${r.id}/edit`}><Pencil />{t('ui.editSubmission')}</Link>
                </Button>
              )}
              <Button asChild>
                <Link to={`/submissions/${r.id}`}><ArrowUpRight />{t('ui.openSubmission')}</Link>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
