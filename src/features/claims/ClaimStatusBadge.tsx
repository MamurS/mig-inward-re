import { useTranslation } from 'react-i18next'
import { Flame } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import type { ClaimStatus } from '@/lib/status'

const TONE: Record<ClaimStatus, BadgeTone> = { notified: 'info', open: 'brand', reopened: 'warning', closed: 'neutral', declined: 'danger' }

export function ClaimStatusBadge({ status, className }: { status: ClaimStatus | null; className?: string }) {
  const { t } = useTranslation()
  if (!status) return null
  return <Badge tone={TONE[status]} className={className}>{t(`claim.status.${status}`)}</Badge>
}

/** The large-loss mark, shown wherever the claim is. */
export function LargeLossBadge({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <Badge tone="danger" solid className={className} title={t('claim.largeLossHint')}>
      <Flame className="size-3.5" />
      {t('claim.largeLoss')}
    </Badge>
  )
}
