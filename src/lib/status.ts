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

export const STATUS_STYLES: Record<SubmissionStatus, string> = {
  received: 'bg-slate-100 text-slate-700 border-slate-200',
  under_review: 'bg-sky-50 text-sky-700 border-sky-200',
  offered: 'bg-amber-50 text-amber-800 border-amber-200',
  no_response: 'bg-orange-50 text-orange-800 border-orange-200',
  bound: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  declined: 'bg-rose-50 text-rose-700 border-rose-200',
  ntu: 'bg-zinc-100 text-zinc-600 border-zinc-200',
}

export const DOC_TYPES: Enums<'doc_type'>[] = [
  'submission', 'slip', 'correspondence', 'bordereau', 'invoice', 'debit_note', 'credit_note', 'claim_notice', 'loss_advice', 'other',
]
