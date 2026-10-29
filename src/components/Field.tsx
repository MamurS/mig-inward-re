import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** Label above the control, then the error (after blur) or a hint — used by all forms. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('grid content-start gap-2', className)}>
      <Label htmlFor={htmlFor} className="text-small font-medium text-foreground">
        {label}
        {required && <span className="text-destructive" aria-hidden>*</span>}
      </Label>
      {children}
      {error ? <p role="alert" className="text-caption text-destructive">{error}</p> : hint ? <p className="text-caption text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/** Read-only label/value pair for detail pages. */
export function InfoItem({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-body break-words">{children ?? '—'}</dd>
    </div>
  )
}
