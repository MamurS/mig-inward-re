import { Fragment, useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'

export type Crumb = { label: string; to?: string }

/** Page header: quiet breadcrumbs, title, subtitle, actions on the right. */
export function PageHeader({ title, subtitle, actions, breadcrumbs }: { title: string; subtitle?: string; actions?: ReactNode; breadcrumbs?: Crumb[] }) {
  // Browser tab title follows the page title (and the UI language)
  useEffect(() => {
    document.title = `${title} · MIG Inward Re`
    return () => {
      document.title = 'MIG Inward Re'
    }
  }, [title])

  return (
    <div className="mb-6 grid gap-2">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1 text-small text-muted-foreground">
          {breadcrumbs.map((c, i) => (
            <Fragment key={i}>
              {i > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
              {c.to ? (
                <Link to={c.to} className="rounded-sm transition-colors hover:text-foreground">{c.label}</Link>
              ) : (
                <span aria-current="page" className="truncate">{c.label}</span>
              )}
            </Fragment>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display-bold text-headline break-words text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-body text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
