import { cn } from '@/lib/utils'

/** A placeholder block in the exact place the content will appear. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('block animate-pulse rounded-sm bg-slate-100', className)} />
}

/** Skeleton table rows: same row height as the real rows, so nothing jumps when data arrives. */
export function SkeletonRows({ rows = 8, cols, rowClassName }: { rows?: number; cols: number; rowClassName?: string }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className={cn('border-b', rowClassName)} aria-hidden>
          {Array.from({ length: cols }, (_, c) => (
            <td key={c} className="px-3">
              <Skeleton className={cn('h-3', c === 0 ? 'w-24' : c % 3 === 0 ? 'w-16' : 'w-28')} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
