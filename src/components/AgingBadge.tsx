import { useTranslation } from 'react-i18next'
import { Badge, type BadgeTone } from '@/components/ui/badge'

export type AgingBucket = '0-30' | '31-60' | '61-90' | '90+'

export function agingBucket(daysOverdue: number): AgingBucket | null {
  if (daysOverdue <= 0) return null
  if (daysOverdue <= 30) return '0-30'
  if (daysOverdue <= 60) return '31-60'
  if (daysOverdue <= 90) return '61-90'
  return '90+'
}

const TONE: Record<AgingBucket, BadgeTone> = { '0-30': 'aging_0_30', '31-60': 'aging_31_60', '61-90': 'aging_61_90', '90+': 'aging_90' }

/** Days on the ageing scale (overdue by default; `label` for e.g. days waiting); only 90+ is solid. */
export function AgingBadge({ days, label, className }: { days: number; label?: string; className?: string }) {
  const { t } = useTranslation()
  const bucket = agingBucket(days)
  if (!bucket) return null
  return (
    <Badge tone={TONE[bucket]} solid={bucket === '90+'} className={className} title={t('ui.agingBucket', { bucket })}>
      <span className="num">{label ?? t('ui.daysOverdue', { count: days })}</span>
    </Badge>
  )
}
