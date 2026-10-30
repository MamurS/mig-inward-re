import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { confidenceLevel } from './match'

const TONE: Record<ReturnType<typeof confidenceLevel>, BadgeTone> = { high: 'success', medium: 'warning', low: 'danger' }

/** «AI · 92 %», coloured by how sure the reading is. */
export function ConfidenceBadge({ value, className, title }: { value: number; className?: string; title?: string }) {
  const { t } = useTranslation()
  const level = confidenceLevel(value)
  return (
    <Badge tone={TONE[level]} className={className} title={title ?? t(`ai.level.${level}`)} data-confidence={level}>
      <Sparkles className="size-3" />
      {t('ai.confidence', { pct: Math.round(value * 100) })}
    </Badge>
  )
}
