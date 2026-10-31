import type { SubmissionStatus } from '@/lib/status'

/**
 * Which statuses a premium total counts — one rule for every total and KPI
 * (docs/totals-audit.md):
 * - bound: the total («our gross» is written business);
 * - offered / no response: «pending», shown apart, never added in;
 * - received / under review (no terms yet), declined and NTU: nowhere.
 */
export const BOUND_STATUSES: readonly SubmissionStatus[] = ['bound']
export const PENDING_STATUSES: readonly SubmissionStatus[] = ['offered', 'no_response']

export const isBound = (s: SubmissionStatus | null | undefined) => s === 'bound'
export const isPending = (s: SubmissionStatus | null | undefined) => s === 'offered' || s === 'no_response'

const round2 = (n: number) => Math.round(n * 100) / 100

/** The register's totals: our gross in USD of the bound rows, and of the pending ones apart. */
export function registerTotals(rows: { status: SubmissionStatus | null; our_gross_premium_usd: number | null }[]) {
  let boundUsd = 0
  let pendingUsd = 0
  let boundCount = 0
  let pendingCount = 0
  for (const r of rows) {
    if (isBound(r.status)) {
      boundUsd += r.our_gross_premium_usd ?? 0
      boundCount++
    } else if (isPending(r.status)) {
      pendingUsd += r.our_gross_premium_usd ?? 0
      pendingCount++
    }
  }
  return { boundUsd: round2(boundUsd), pendingUsd: round2(pendingUsd), boundCount, pendingCount }
}
