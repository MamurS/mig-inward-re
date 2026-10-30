import { useLayoutEffect, useRef, type ComponentType, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

/** A tiny trend line, drawn to the card's width; the last point is marked. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return <svg className={className} aria-hidden />
  const w = 120
  const h = 32
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn('h-8 w-full overflow-visible', className)} aria-hidden>
      <path d={`${line}L${w},${h}L0,${h}Z`} className="fill-brand-100" />
      <path d={line} className="fill-none stroke-brand-500" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r={2.5} className="fill-brand-600" />
    </svg>
  )
}

/**
 * Five KPI cards in full rows, never a hole: one row of five on wide screens;
 * two wide cards over three below that (a six-column grid); two by two with
 * the last card across on phones. Give card i the class `KPI_SPAN_5[i]`.
 */
export const KPI_GRID_5 = 'grid grid-cols-2 gap-3 md:grid-cols-6 xl:grid-cols-5'
export const KPI_SPAN_5 = [
  'md:col-span-3 xl:col-span-1',
  'md:col-span-3 xl:col-span-1',
  'md:col-span-2 xl:col-span-1',
  'md:col-span-2 xl:col-span-1',
  'col-span-2 md:col-span-2 xl:col-span-1',
] as const

/** Six KPI cards: one row on very wide screens, three by three below, two by three on phones. */
export const KPI_GRID_6 = 'grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6'

/** Never smaller than this share of the display size: below it the figure is cut with an ellipsis. */
const MIN_SCALE = 0.6

/**
 * The figure, on one line, never wider than its card: when it does not fit it
 * is scaled down (a transform, so nothing around it moves), measured again
 * whenever the card or the figure changes size.
 */
export function FitValue({ children, className }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const b = box.current
    const i = inner.current
    if (!b || !i) return
    const fit = () => {
      // offsetWidth ignores the transform: the figure's natural width
      const need = i.offsetWidth
      const room = b.clientWidth
      const scale = need > room && need > 0 ? Math.max(MIN_SCALE, Math.floor((room / need) * 1000) / 1000) : 1
      i.style.transform = scale < 1 ? `scale(${scale})` : ''
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(b)
    ro.observe(i)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={box} className={cn('min-w-0 overflow-x-clip text-ellipsis whitespace-nowrap', className)} data-kpi-value>
      <span ref={inner} className="inline-block origin-left">{children}</span>
    </div>
  )
}

/**
 * A KPI: label, the figure in the display face, the change against the
 * previous period (green when it moves the good way), a sparkline, and —
 * when `to` is set — a click through to the rows behind the number.
 */
export function KpiCard({
  label,
  value,
  sub,
  delta,
  deltaLabel,
  goodWhen = 'up',
  series,
  to,
  alert = false,
  icon: ChipIcon,
  className,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  /** Relative change, 0.12 = +12 %. null / undefined hides it. */
  delta?: number | null
  deltaLabel?: string
  goodWhen?: 'up' | 'down'
  series?: number[]
  to?: string
  /** The figure needs attention (e.g. overdue items): shown in the danger ink. */
  alert?: boolean
  /** Shown in a soft accent-tinted chip next to the label. */
  icon?: ComponentType<{ className?: string }>
  className?: string
}) {
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta)
  const flat = hasDelta && Math.abs(delta) < 0.005
  const good = hasDelta && !flat && (delta > 0) === (goodWhen === 'up')
  const Icon = !hasDelta || flat ? ArrowRight : delta > 0 ? ArrowUpRight : ArrowDownRight
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-3">
          {ChipIcon && (
            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', alert ? 'bg-danger-100 text-danger-700' : 'bg-brand-50 text-brand-700')} aria-hidden>
              <ChipIcon className="size-[18px]" />
            </span>
          )}
          <span className="min-w-0 text-small font-medium text-balance text-muted-foreground">{label}</span>
        </span>
        {to && <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />}
      </div>
      <FitValue className={cn('mt-1 font-display-bold text-display num', alert ? 'text-danger-700' : 'text-foreground')}>{value}</FitValue>
      <div className="flex min-h-5 flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
        {hasDelta && (
          <span className={cn('inline-flex items-center gap-0.5 font-medium num', flat ? 'text-muted-foreground' : good ? 'text-success-700' : 'text-danger-700')}>
            <Icon className="size-3.5" />
            {formatNumber(delta, { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' })}
          </span>
        )}
        {hasDelta && deltaLabel && <span>{deltaLabel}</span>}
        {!hasDelta && sub}
      </div>
      {series && <Sparkline values={series} className="mt-1" />}
    </>
  )
  const base = cn('group flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-5 shadow-card', className)
  return to ? (
    <Link to={to} className={cn(base, 'transition-colors hover:border-brand-300 hover:bg-brand-50')} data-slot="card">
      {body}
    </Link>
  ) : (
    <div className={base} data-slot="card">{body}</div>
  )
}
