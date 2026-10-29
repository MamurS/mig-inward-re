import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { locale } from '@/lib/format'
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
      <path d={`${line}L${w},${h}L0,${h}Z`} className="fill-navy-100" />
      <path d={line} className="fill-none stroke-navy-500" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r={2.5} className="fill-navy-600" />
    </svg>
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
  className?: string
}) {
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta)
  const flat = hasDelta && Math.abs(delta) < 0.005
  const good = hasDelta && !flat && (delta > 0) === (goodWhen === 'up')
  const Icon = !hasDelta || flat ? ArrowRight : delta > 0 ? ArrowUpRight : ArrowDownRight
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-caption font-medium text-muted-foreground">{label}</span>
        {to && <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />}
      </div>
      <div className={cn('font-display-bold text-headline num', alert ? 'text-danger-700' : 'text-foreground')}>{value}</div>
      <div className="flex min-h-5 flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
        {hasDelta && (
          <span className={cn('inline-flex items-center gap-0.5 font-medium num', flat ? 'text-muted-foreground' : good ? 'text-success-700' : 'text-danger-700')}>
            <Icon className="size-3.5" />
            {new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' }).format(delta)}
          </span>
        )}
        {hasDelta && deltaLabel && <span>{deltaLabel}</span>}
        {!hasDelta && sub}
      </div>
      {series && <Sparkline values={series} className="mt-1" />}
    </>
  )
  const base = cn('group flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-4 shadow-card', className)
  return to ? (
    <Link to={to} className={cn(base, 'transition-colors hover:border-navy-300 hover:bg-navy-50')} data-slot="card">
      {body}
    </Link>
  ) : (
    <div className={base} data-slot="card">{body}</div>
  )
}
