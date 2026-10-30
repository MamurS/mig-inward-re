import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Empty states with the product's own pictograms (64 px line drawings in
 * the brand ramp — not stock icons). One sentence saying what is empty and
 * why, and, when there is one, the action that fills it.
 */
export type Pictogram = 'search' | 'inbox' | 'done' | 'documents' | 'chart' | 'people'

const STROKE = { fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function Art({ kind }: { kind: Pictogram }) {
  // The soft disc behind each drawing is brand-100; strokes are brand-500, accents sky-400 (≥ 3 : 1 on white).
  const disc = <circle cx="32" cy="32" r="30" className="fill-brand-100" stroke="none" />
  switch (kind) {
    case 'search':
      return (
        <>
          {disc}
          <g {...STROKE} className="stroke-brand-500">
            <rect x="14" y="16" width="26" height="32" rx="3" />
            <path d="M19 24h16M19 30h12M19 36h8" />
          </g>
          <g {...STROKE} className="stroke-sky-400">
            <circle cx="42" cy="40" r="8" />
            <path d="M48 46l6 6" />
          </g>
        </>
      )
    case 'inbox':
      return (
        <>
          {disc}
          <g {...STROKE} className="stroke-brand-500">
            <path d="M12 36l7-16h26l7 16v10a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3z" />
            <path d="M12 36h12l3 5h10l3-5h12" />
          </g>
          <path {...STROKE} className="stroke-sky-400" d="M32 12v12M27 19l5 5 5-5" />
        </>
      )
    case 'done':
      return (
        <>
          {disc}
          <g {...STROKE} className="stroke-brand-500">
            <rect x="14" y="16" width="36" height="32" rx="3" />
            <path d="M14 25h36M22 12v8M42 12v8" />
          </g>
          <path {...STROKE} className="stroke-success-500" d="M24 36l6 6 11-12" />
        </>
      )
    case 'documents':
      return (
        <>
          {disc}
          <g {...STROKE} className="stroke-brand-500">
            <path d="M20 14h16l8 8v26a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2V16a2 2 0 0 1 2-2z" />
            <path d="M36 14v8h8" />
          </g>
          <path {...STROKE} className="stroke-sky-400" d="M24 32h14M24 38h14M24 44h8" />
        </>
      )
    case 'chart':
      return (
        <>
          {disc}
          <g {...STROKE} className="stroke-brand-500">
            <path d="M14 48h36M18 48V30M28 48V22M38 48V34" />
          </g>
          <path {...STROKE} className="stroke-sky-400" d="M46 48V16" strokeDasharray="3 4" />
        </>
      )
    case 'people':
      return (
        <>
          {disc}
          <g {...STROKE} className="stroke-brand-500">
            <circle cx="26" cy="26" r="7" />
            <path d="M14 48c0-7 5-12 12-12s12 5 12 12" />
          </g>
          <g {...STROKE} className="stroke-sky-400">
            <circle cx="42" cy="24" r="5" />
            <path d="M40 34c6 0 10 4 10 10" />
          </g>
        </>
      )
  }
}

export function EmptyState({
  pictogram,
  title,
  children,
  action,
  className,
  compact = false,
}: {
  pictogram: Pictogram
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-12', className)}>
      <svg viewBox="0 0 64 64" className={compact ? 'size-12' : 'size-16'} aria-hidden>
        <Art kind={pictogram} />
      </svg>
      <div className="grid max-w-md gap-1">
        <p className="text-body font-semibold text-foreground">{title}</p>
        {children && <p className="text-body text-muted-foreground">{children}</p>}
      </div>
      {action}
    </div>
  )
}
