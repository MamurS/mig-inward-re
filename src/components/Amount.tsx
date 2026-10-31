import { Tooltip } from '@/components/ui/tooltip'
import { formatAmount, formatHuman } from '@/lib/format'
import { cn } from '@/lib/utils'


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
  // Human figures may break before the currency, never inside the figure: a narrow column wraps, nothing spills over
  const human_ = <><span className="whitespace-nowrap">{formatHuman(n)}</span>{ccy && <>{' '}<span className="whitespace-nowrap text-muted-foreground">{currency}</span></>}</>
  // Small figures are already human: no tooltip needed, but the same compact style as their neighbours
  if (Math.abs(n) < 10_000) return <span className={cn('num', className)}>{human_}</span>
  return (
    <Tooltip content={<span className="num">{full}{currency ? ` ${currency}` : ''}</span>}>
      <span tabIndex={0} className={cn('num cursor-default underline decoration-slate-300 decoration-dotted underline-offset-4', className)}>
        {human_}
      </span>
    </Tooltip>
  )
}
