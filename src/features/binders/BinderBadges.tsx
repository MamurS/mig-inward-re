import { useTranslation } from 'react-i18next'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { BinderStatus, PeriodRow } from './api'

const TONE: Record<BinderStatus, BadgeTone> = { draft: 'neutral', active: 'success', expired: 'info', cancelled: 'danger' }

export function BinderStatusBadge({ status, className }: { status: BinderStatus | null; className?: string }) {
  const { t } = useTranslation()
  if (!status) return null
  return <Badge tone={TONE[status]} className={className}>{t(`binder.status.${status}`)}</Badge>
}

const STATE_TONE: Record<PeriodRow['state'], BadgeTone> = { received: 'success', late: 'warning', missing: 'danger', upcoming: 'neutral' }

export function PeriodStateBadge({ state, className }: { state: PeriodRow['state']; className?: string }) {
  const { t } = useTranslation()
  return <Badge tone={STATE_TONE[state]} className={className}>{t(`binder.state.${state}`)}</Badge>
}

/** Aggregate used against the limit: a bar that turns amber at 80 % and red at 100 %. */
export function CapacityBar({ pct, className, showLabel = true }: { pct: number | null; className?: string; showLabel?: boolean }) {
  const { t } = useTranslation()
  if (pct === null) return <span className={cn('text-caption text-muted-foreground', className)}>{t('binder.noAggregate')}</span>
  const tone = pct >= 100 ? 'bg-danger-600' : pct >= 80 ? 'bg-warning-500' : 'bg-brand-600'
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)} data-capacity={pct}>
      <span
        className="relative h-2 w-20 shrink-0 overflow-hidden rounded-full bg-slate-200"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, pct)}
        aria-label={t('binder.capacityPct')}
      >
        <span className={cn('absolute inset-y-0 left-0 rounded-full', tone)} style={{ width: `${Math.min(100, pct)}%` }} />
      </span>
      {showLabel && <span className={cn('num whitespace-nowrap', pct >= 80 && 'font-medium text-warning-700', pct >= 100 && 'text-danger-700')}>{pct.toLocaleString(undefined, { maximumFractionDigits: 1 })} %</span>}
    </span>
  )
}
