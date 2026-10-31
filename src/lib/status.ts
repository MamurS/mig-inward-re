import type { Enums } from './database.types'

export type SubmissionStatus = Enums<'submission_status'>

export const STATUSES: SubmissionStatus[] = ['received', 'under_review', 'offered', 'no_response', 'bound', 'declined', 'ntu']

/** Mirrors public.submission_next_statuses() — the database is the source of truth. */
export const NEXT_STATUSES: Record<SubmissionStatus, SubmissionStatus[]> = {
  received: ['under_review'],
  under_review: ['offered', 'declined'],
  offered: ['bound', 'ntu', 'no_response'],
  no_response: ['bound', 'ntu'],
  bound: [],
  declined: [],
  ntu: [],
}

/** Badge classes per status: the status scale's tint, hairline and ink
 * (DESIGN.md «Submission status scale»). One fixed colour per meaning. */
export const STATUS_STYLES: Record<SubmissionStatus, string> = {
  received: 'bg-status-received-tint text-status-received-deep border-status-received-line',
  under_review: 'bg-status-under-review-tint text-status-under-review-deep border-status-under-review-line',
  offered: 'bg-status-offered-tint text-status-offered-deep border-status-offered-line',
  no_response: 'bg-status-no-response-tint text-status-no-response-deep border-status-no-response-line',
  bound: 'bg-status-bound-tint text-status-bound-deep border-status-bound-line',
  declined: 'bg-status-declined-tint text-status-declined-deep border-status-declined-line',
  ntu: 'bg-status-ntu-tint text-status-ntu-deep border-status-ntu-line',
}

/** The solid of each status (funnel bars, chart marks, dots). */
export const STATUS_SOLID: Record<SubmissionStatus, string> = {
  received: 'var(--color-status-received)',
  under_review: 'var(--color-status-under-review)',
  offered: 'var(--color-status-offered)',
  no_response: 'var(--color-status-no-response)',
  bound: 'var(--color-status-bound)',
  declined: 'var(--color-status-declined)',
  ntu: 'var(--color-status-ntu)',
}

/**
 * A status as a chart mark in its badge colours: the badge's hairline as the
 * fill, the solid as the edge, the deep ink for the figure. Reads as the
 * status badge, never as the ageing scale (whose solids share hues with
 * «offered» / «no response»).
 */
export const STATUS_MARK: Record<SubmissionStatus, { fill: string; edge: string; ink: string }> = Object.fromEntries(
  STATUSES.map((s) => {
    const k = s.replace('_', '-')
    return [s, { fill: `var(--color-status-${k}-line)`, edge: `var(--color-status-${k})`, ink: `var(--color-status-${k}-deep)` }]
  }),
) as Record<SubmissionStatus, { fill: string; edge: string; ink: string }>

export const DOC_TYPES: Enums<'doc_type'>[] = [
  'submission', 'slip', 'correspondence', 'bordereau', 'invoice', 'debit_note', 'credit_note', 'claim_notice', 'loss_advice', 'other',
]

/** Documents a claim carries. */
export const CLAIM_DOC_TYPES: Enums<'doc_type'>[] = [
  'loss_advice', 'claim_notice', 'adjuster_report', 'proof_of_loss', 'cash_call_request', 'payment_proof', 'correspondence', 'other',
]

export type ClaimStatus = Enums<'claim_status'>
export const CLAIM_STATUSES: ClaimStatus[] = ['notified', 'open', 'reopened', 'closed', 'declined']
/** Mirrors the claims_before_write transitions — the database is the source of truth. */
export const CLAIM_NEXT: Record<ClaimStatus, ClaimStatus[]> = {
  notified: ['open', 'declined'],
  open: ['closed', 'declined'],
  reopened: ['closed', 'declined'],
  closed: ['reopened'],
  declined: ['reopened'],
}
