import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CircleCheck } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/Skeleton'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'

/** «Needs attention» lists are short: the first few, the register has the rest. */
export const ATTENTION_MAX = 5

/**
 * One list of the dashboard's «Needs attention» block: a title with how many
 * there are, «Open in register» to the filtered rows, and at most
 * {@link ATTENTION_MAX} rows (a ref-list grid, see `RefRow` and `RefLines`)
 * — or one quiet line when there is nothing to do.
 */
export function AttentionCard({
  title,
  count,
  to,
  empty,
  loading = false,
  error,
  columns = 'grid-cols-[minmax(0,1fr)_auto]',
  data,
  children,
}: {
  title: string
  count: number
  to: string
  empty: string
  loading?: boolean
  error?: unknown
  /** The list's grid columns (name and ref · figures on the right): one grid, so the right column lines up. */
  columns?: string
  /** A data-* hook for the list (e2e). */
  data: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <Card className="gap-0 py-0" data-attention-card={data}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-4">
        <CardTitle className="flex items-baseline gap-2">
          {title}
          {!loading && count > 0 && <span className="text-body font-normal text-muted-foreground num">{count}</span>}
        </CardTitle>
        <Link to={to} className="text-body text-link hover:underline">{t('dash.openInRegister')}</Link>
      </CardHeader>
      {loading ? (
        <div className="grid gap-2 border-t px-5 py-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 rounded-md" />)}</div>
      ) : error ? (
        <p className="border-t px-5 py-3 text-body text-destructive">{errorMessage(error)}</p>
      ) : count === 0 ? (
        <p className="flex items-center gap-2 border-t px-5 py-3 text-body text-muted-foreground">
          <CircleCheck className="size-4 shrink-0 text-success-700" aria-hidden />
          {empty}
        </p>
      ) : (
        <ul className={cn('grid border-t [&>li:last-child>a]:border-b-0', columns)} data-ref-list {...{ [`data-${data}`]: '' }}>
          {children}
        </ul>
      )}
    </Card>
  )
}

/** A row of an {@link AttentionCard}: the whole row is the link; cells sit on the list's grid. */
export function RefRow({ to, children }: { to: string; children: ReactNode }) {
  return (
    <li className="col-span-full grid grid-cols-subgrid">
      <Link to={to} className="col-span-full grid grid-cols-subgrid items-baseline gap-x-3 border-b px-5 py-2 text-body transition-colors hover:bg-slate-50">
        {children}
      </Link>
    </li>
  )
}

/**
 * The main cell of a {@link RefRow}: the name on line 1 (never squeezed by the
 * ref), «ref · sub» on line 2 in the caption size and grey. The ref keeps the
 * link colour and is never cut; the rest of line 2 ends in an ellipsis.
 */
export function RefLines({ name, refNo, sub }: { name: ReactNode; refNo: ReactNode; sub?: ReactNode }) {
  return (
    <span className="min-w-0">
      <span className="block truncate" title={typeof name === 'string' ? name : undefined}>{name}</span>
      <span className="flex min-w-0 items-baseline gap-1 text-caption text-muted-foreground">
        <span className="shrink-0 font-medium whitespace-nowrap text-link num" data-ref>{refNo}</span>
        {sub && <span className="min-w-0 truncate" title={typeof sub === 'string' ? sub : undefined}>· {sub}</span>}
      </span>
    </span>
  )
}

/** A figure on the right of a {@link RefRow} (amount, badge), with an optional quieter line under it. */
export function RefFigure({ children, sub, className }: { children: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <span className={cn('grid justify-items-end text-right', className)}>
      <span className="inline-flex items-center gap-2 whitespace-nowrap">{children}</span>
      {sub && <span className="text-caption whitespace-nowrap text-muted-foreground">{sub}</span>}
    </span>
  )
}
