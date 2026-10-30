import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { AgingBucket } from '@/components/AgingBadge'
import { cn } from '@/lib/utils'

export const AGEING_KEYS: AgingBucket[] = ['0-30', '31-60', '61-90', '90+']

/**
 * The ageing scale as marks (bars, swatches), light to dark: 0–30 is the pale
 * `line` step so it never reads as 31–60 (their solids share a lightness);
 * the rest are the solids. Fixed in every theme (DESIGN.md «Ageing scale»).
 */
export const AGEING_FILL: Record<AgingBucket, string> = {
  '0-30': 'var(--color-aging-0to30-line)',
  '31-60': 'var(--color-aging-31to60)',
  '61-90': 'var(--color-aging-61to90)',
  '90+': 'var(--color-aging-90plus)',
}
/** A hairline in the bucket's solid around the pale 0–30 mark, so it holds 3 : 1 against white. */
const EDGE: Partial<Record<AgingBucket, string>> = { '0-30': 'inset 0 0 0 1px var(--color-aging-0to30)' }

export type AgeingItem = {
  bucket: AgingBucket
  label: ReactNode
  /** What the bar is proportional to (USD, or a count). */
  weight: number
  /** The figure in the legend (an <Amount>, a count…). */
  value: ReactNode
  /** A second, quieter figure (e.g. the USD behind a count). */
  extra?: ReactNode
  /** The filtered register behind the bucket. */
  to?: string
}

/**
 * Ageing at a glance: one proportional stacked bar, then the four buckets as
 * a legend with their figures — each bucket opens the rows behind it.
 * `columns` lays the legend out two by two (tile rows) or one per line.
 */
export function AgeingBreakdown({ items, active, columns = 2, className }: { items: AgeingItem[]; active?: AgingBucket | null; columns?: 1 | 2; className?: string }) {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0)
  return (
    <div className={cn('grid gap-3', className)} data-ageing-breakdown>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden data-ageing-bar>
        {total > 0 &&
          items.map((i) => i.weight > 0 && (
            <span key={i.bucket} data-bucket={i.bucket} style={{ width: `${(i.weight / total) * 100}%`, background: AGEING_FILL[i.bucket], boxShadow: EDGE[i.bucket] }} />
          ))}
      </div>
      <ul className={cn('grid gap-x-3 gap-y-0.5', columns === 2 && 'grid-cols-2')}>
        {items.map((i) => {
          const body = (
            <>
              <span className="mt-1 size-3 shrink-0 self-start rounded-sm" style={{ background: AGEING_FILL[i.bucket], boxShadow: EDGE[i.bucket] }} aria-hidden />
              <span className={cn('flex min-w-0 flex-1 gap-x-3', columns === 2 ? 'flex-col' : 'flex-wrap items-baseline justify-between')}>
                <span className="text-muted-foreground">{i.label}</span>
                <span className="flex items-baseline gap-2">
                  <span className="font-semibold">{i.value}</span>
                  {i.extra && <span className="text-caption text-muted-foreground">{i.extra}</span>}
                </span>
              </span>
            </>
          )
          const cls = cn('flex min-w-0 gap-2 rounded-md px-2 py-1 text-body', active === i.bucket && 'bg-brand-50 ring-1 ring-ring/40')
          return (
            <li key={i.bucket} className="min-w-0">
              {i.to ? (
                <Link to={i.to} className={cn(cls, 'transition-colors hover:bg-slate-50')} aria-current={active === i.bucket ? 'true' : undefined}>{body}</Link>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
