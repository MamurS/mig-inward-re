/**
 * A parsed query → one PostgREST logic tree for submissions_v, so filtering
 * runs in the database (never «load everything and filter in the browser»):
 *   (g1 OR g2 …), each group = and(term, term …)
 * Free text matches search_text — ref no., insured, risk, MGA, broker, source,
 * country and line of business (all three languages) and notes, normalised by
 * public.search_norm() exactly as normalize.ts does here.
 */
import { norm } from './normalize'
import type { DateKey, FieldKey, NumKey, ParsedQuery, Range, Term } from './query'

const FIELD_COLUMN: Record<Exclude<FieldKey, 'ref'>, string> = {
  status: 'status', mga: 'mga_id', broker: 'broker_id', lob: 'lob_id', country: 'insured_country', ccy: 'currency', uw: 'underwriter_id', type: 'business_type',
}
export const NUM_COLUMN: Record<NumKey, string> = { premium: 'our_gross_premium_usd', share: 'share_pct', si: 'sum_insured_100_usd' }
export const DATE_COLUMN: Record<DateKey, string> = { received: 'received_at', inception: 'period_from', expiry: 'period_to', bound: 'bound_at' }

const DAY = 86_400_000
const nextDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + DAY).toISOString().slice(0, 10)

/** A value inside a logic tree: always double-quoted, with the quoting characters removed. */
const q = (v: string) => `"${v.replace(/["\\]/g, '')}"`
const like = (v: string) => q(`*${v.replace(/[*%]/g, '')}*`)
const list = (vs: string[]) => `(${vs.map(q).join(',')})`

function rangeConds(col: string, r: Range, isDate: boolean): string[] {
  const out: string[] = []
  if (isDate) {
    // day granularity that also works on timestamps (bound_at)
    if (r.gte) out.push(`${col}.gte.${r.gte}`)
    if (r.gt) out.push(`${col}.gte.${nextDay(r.gt)}`)
    if (r.lte) out.push(`${col}.lt.${nextDay(r.lte)}`)
    if (r.lt) out.push(`${col}.lt.${r.lt}`)
  } else {
    for (const op of ['gte', 'gt', 'lte', 'lt'] as const) if (r[op] !== undefined) out.push(`${col}.${op}.${r[op]}`)
  }
  return out
}

const all = (conds: string[]) => (conds.length === 1 ? conds[0] : `and(${conds.join(',')})`)
const not = (conds: string[]) => (conds.length === 1 ? conds[0].replace(/^([a-z_0-9]+)\./, '$1.not.') : `not.and(${conds.join(',')})`)

export function termCondition(t: Term, userId: string | null): string | null {
  switch (t.kind) {
    case 'text': {
      if (!t.words.length) return null
      const words = t.words.map((w) => norm(w)).filter(Boolean)
      if (!words.length) return null
      // excluding text: none of the words; including: every word
      return all(words.map((w) => `search_text.${t.neg ? 'not.' : ''}ilike.${like(w)}`))
    }
    case 'field': {
      if (t.field === 'ref') {
        const conds = t.values.map((v) => `ref_no.ilike.${like(v)}`)
        if (t.neg) return all(t.values.map((v) => `ref_no.not.ilike.${like(v)}`))
        return conds.length === 1 ? conds[0] : `or(${conds.join(',')})`
      }
      const col = FIELD_COLUMN[t.field]
      const none = t.values.includes('none')
      const ids = t.values.filter((v) => v !== 'none')
      if (!t.neg) {
        const conds = [...(ids.length ? [`${col}.in.${list(ids)}`] : []), ...(none ? [`${col}.is.null`] : [])]
        return conds.length === 1 ? conds[0] : `or(${conds.join(',')})`
      }
      // excluding keeps the rows with no value at all (a direct deal has no broker to exclude)
      if (none) return all([`${col}.not.is.null`, ...(ids.length ? [`${col}.not.in.${list(ids)}`] : [])])
      return `or(${col}.is.null,${col}.not.in.${list(ids)})`
    }
    case 'num':
    case 'date': {
      const col = t.kind === 'num' ? NUM_COLUMN[t.field] : DATE_COLUMN[t.field]
      const conds = rangeConds(col, t.range, t.kind === 'date')
      if (!conds.length) return null
      return t.neg ? not(conds) : all(conds)
    }
    case 'flag': {
      if (t.flag === 'overdue') return `follow_up_overdue.${t.neg ? 'not.is' : 'is'}.true`
      if (t.flag === 'expired') return `offer_expired.${t.neg ? 'not.is' : 'is'}.true`
      if (!userId) return null
      return t.neg ? `or(underwriter_id.is.null,underwriter_id.neq.${userId})` : `underwriter_id.eq.${userId}`
    }
  }
}

/** The `or` filter for the whole query, or null when it filters nothing. */
export function toPostgrestFilter(query: ParsedQuery, userId: string | null): string | null {
  const groups = query.groups
    .map((g) =>
      g.terms
        .map((t) => termCondition(t, userId))
        .filter((c): c is string => Boolean(c))
        // an and(…) inside a group's and(…) is the same thing: flatten it
        .map((c) => (c.startsWith('and(') ? c.slice(4, -1) : c)),
    )
    .filter((conds) => conds.length > 0)
  if (!groups.length) return null
  return groups.map((conds) => `and(${conds.join(',')})`).join(',')
}
