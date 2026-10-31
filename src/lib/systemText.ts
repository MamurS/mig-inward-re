import type { TFunction } from 'i18next'
import { formatDate, formatPct } from '@/lib/format'

/**
 * Texts the database writes itself (follow-up titles and outcomes, status-history
 * comments, a receipt's default note) are stored in English. They are rendered in
 * the user's language from a dictionary here; the database stays unchanged. Text a
 * person typed matches no pattern and is shown as it is.
 *
 * Sources (supabase/migrations, mirrored by e2e/support):
 * - status_machine: 'Request update on offer', 'Closed automatically: status changed to %s', 'Submission registered'
 * - follow_up_job: 'Automatically set: no answer %s days after the offer', 'Offer validity has passed'
 * - premium_receivables: 'Premium overdue', 'Closed automatically: installment paid' / '… written off'
 * - claims: 'Large loss', 'Review the reserve', 'Cash call paid on DD.MM.YYYY', 'Claim payment offset against premium'
 * - binders: 'Capacity %s %% used', 'Missing %s bordereau MM.YYYY'
 * - demo seed status comments: 'Firm order received from MGA', 'Quote sent'
 */
type Match = { key: string; params?: Record<string, string | number> }
type Rule = { re: RegExp; match: (m: RegExpMatchArray, t: TFunction) => Match }

const fixed = (key: string) => () => ({ key })

const RULES: Rule[] = [
  { re: /^Request update on offer$/, match: fixed('sysText.requestUpdate') },
  { re: /^Offer validity has passed$/, match: fixed('sysText.offerExpired') },
  { re: /^Premium overdue$/, match: fixed('sysText.premiumOverdue') },
  { re: /^Review the reserve$/, match: fixed('sysText.reviewReserve') },
  { re: /^Large loss$/, match: fixed('sysText.largeLoss') },
  { re: /^Submission registered$/, match: fixed('sysText.registered') },
  { re: /^Claim payment offset against premium$/, match: fixed('sysText.offsetNote') },
  { re: /^Closed automatically: installment paid$/, match: fixed('sysText.closedPaid') },
  { re: /^Closed automatically: installment written off$/, match: fixed('sysText.closedWrittenOff') },
  { re: /^Cash call paid$/, match: fixed('sysText.cashCallPaid') },
  { re: /^Firm order received from MGA$/, match: fixed('sysText.firmOrder') },
  { re: /^Quote sent$/, match: fixed('sysText.quoteSent') },
  {
    re: /^Closed automatically: status changed to ([a-z_]+)$/,
    match: (m, t) => ({ key: 'sysText.closedStatus', params: { status: t(`status.${m[1]}`, { defaultValue: m[1] }) } }),
  },
  {
    re: /^Automatically set: no answer (\d+) days after the offer$/,
    match: (m) => ({ key: 'sysText.autoNoResponse', params: { count: Number(m[1]) } }),
  },
  {
    re: /^Cash call paid on (\d{2})\.(\d{2})\.(\d{4})$/,
    match: (m) => ({ key: 'sysText.cashCallPaidOn', params: { date: formatDate(`${m[3]}-${m[2]}-${m[1]}`) } }),
  },
  {
    re: /^Capacity (\d+(?:\.\d+)?) % used$/,
    match: (m) => ({ key: 'sysText.capacityUsed', params: { pct: formatPct(Number(m[1])) } }),
  },
  {
    re: /^Missing (risk|premium|claims) bordereau (\d{2}\.\d{4})$/,
    match: (m, t) => ({ key: 'sysText.bordereauMissing', params: { kind: t(`binder.kind.${m[1]}`), period: m[2] } }),
  },
]

/** The dictionary entry for a system-written text, or null when a person wrote it. */
export function matchSystemText(text: string | null | undefined, t: TFunction): Match | null {
  if (!text) return null
  const s = text.trim()
  for (const r of RULES) {
    const m = s.match(r.re)
    if (m) return r.match(m, t)
  }
  return null
}

/** A stored text in the user's language: system texts translated, anything else unchanged. */
export function systemText(text: string | null | undefined, t: TFunction): string {
  const hit = matchSystemText(text, t)
  return hit ? t(hit.key, hit.params) : (text ?? '')
}
