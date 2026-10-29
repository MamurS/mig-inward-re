import { Tooltip } from '@/components/ui/tooltip'
import { formatAmount, locale } from '@/lib/format'
import { cn } from '@/lib/utils'

/** 1 250 000 → «1.25M» (locale-aware: «1,25 млн», «1,25 mln»). */
export function formatHuman(value: number): string {
  return new Intl.NumberFormat(locale(), { notation: 'compact', maximumFractionDigits: 2 }).format(value)
}

/**
 * A money amount. `human` shows it at human scale (KPI tiles, charts,
 * summaries) with the exact value in a tooltip; tables show the full value.
 * Always tabular figures; the currency follows in a muted tone.
 */
export function Amount({
  value,
  currency,
  human = false,
  className,
}: {
  value: number | string | null | undefined
  currency?: string | null
  human?: boolean
  className?: string
}) {
  if (value === null || value === undefined || value === '') return <span className={cn('text-muted-foreground', className)}>—</span>
  const n = typeof value === 'string' ? Number(value) : value
  const full = formatAmount(value)
  const ccy = currency ? <span className="ml-1 text-muted-foreground">{currency}</span> : null
  if (!human) return <span className={cn('num whitespace-nowrap', className)}>{full}{ccy}</span>
  // Small figures are already human: no tooltip needed, but the same compact style as their neighbours
  if (Math.abs(n) < 10_000) return <span className={cn('num whitespace-nowrap', className)}>{formatHuman(n)}{ccy}</span>
  return (
    <Tooltip content={<span className="num">{full}{currency ? ` ${currency}` : ''}</span>}>
      <span tabIndex={0} className={cn('num cursor-default whitespace-nowrap underline decoration-slate-300 decoration-dotted underline-offset-4', className)}>
        {formatHuman(n)}{ccy}
      </span>
    </Tooltip>
  )
}
