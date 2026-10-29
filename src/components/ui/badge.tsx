import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * The one badge (DESIGN.md «Badges»): tinted fill, hairline border, deep
 * text — readable on white and on the canvas. `solid` is reserved for the
 * few things that must shout (90+ days overdue, an unread count).
 */
export type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'received'
  | 'under_review'
  | 'offered'
  | 'no_response'
  | 'bound'
  | 'declined'
  | 'ntu'
  | 'aging_0_30'
  | 'aging_31_60'
  | 'aging_61_90'
  | 'aging_90'

const TINT: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  brand: 'bg-navy-100 text-navy-700 border-navy-200',
  info: 'bg-info-100 text-info-700 border-info-200',
  success: 'bg-success-100 text-success-700 border-success-200',
  warning: 'bg-warning-100 text-warning-700 border-warning-200',
  danger: 'bg-danger-100 text-danger-700 border-danger-200',
  received: 'bg-status-received-tint text-status-received-deep border-status-received-line',
  under_review: 'bg-status-under-review-tint text-status-under-review-deep border-status-under-review-line',
  offered: 'bg-status-offered-tint text-status-offered-deep border-status-offered-line',
  no_response: 'bg-status-no-response-tint text-status-no-response-deep border-status-no-response-line',
  bound: 'bg-status-bound-tint text-status-bound-deep border-status-bound-line',
  declined: 'bg-status-declined-tint text-status-declined-deep border-status-declined-line',
  ntu: 'bg-status-ntu-tint text-status-ntu-deep border-status-ntu-line',
  aging_0_30: 'bg-aging-0to30-tint text-aging-0to30-deep border-aging-0to30-line',
  aging_31_60: 'bg-aging-31to60-tint text-aging-31to60-deep border-aging-31to60-line',
  aging_61_90: 'bg-aging-61to90-tint text-aging-61to90-deep border-aging-61to90-line',
  aging_90: 'bg-aging-90plus-tint text-aging-90plus-deep border-aging-90plus-line',
}

const SOLID: Partial<Record<BadgeTone, string>> = {
  danger: 'bg-danger-600 text-white border-danger-600',
  aging_90: 'bg-aging-90plus-ink text-white border-aging-90plus-ink',
  brand: 'bg-navy-600 text-white border-navy-600',
  neutral: 'bg-slate-700 text-white border-slate-700',
}

function Badge({
  tone = 'neutral',
  solid = false,
  className,
  ...props
}: React.ComponentProps<'span'> & { tone?: BadgeTone; solid?: boolean }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-caption font-medium whitespace-nowrap [&>svg]:size-3',
        (solid && SOLID[tone]) || TINT[tone],
        className,
      )}
      {...props}
    />
  )
}

export { Badge }
