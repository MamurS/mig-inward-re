/**
 * The same parsed query, applied to rows already in the browser — for the
 * small, reference-sized lists (counterparties, follow-ups, users, reference
 * data) that are loaded whole anyway. Semantics match the database filter:
 * excluding a value keeps rows without one; excluding text means none of
 * its words; a missing number or date never matches a range.
 */
import { norm } from './normalize'
import type { ParsedQuery, Range, Term } from './query'

export type ClientSpec<R> = {
  /** everything free text matches, normalised (norm()) */
  text: (row: R) => string
  list?: Record<string, (row: R) => string | string[] | null | undefined>
  like?: Record<string, (row: R) => string | null | undefined>
  num?: Record<string, (row: R) => number | null | undefined>
  date?: Record<string, (row: R) => string | null | undefined>
  flags?: Record<string, (row: R) => boolean>
}

function inRange(v: string | number, r: Range): boolean {
  const cmp = (a: string | number, b: string) => (typeof a === 'number' ? a - Number(b) : a.localeCompare(b))
  if (r.gte !== undefined && cmp(v, r.gte) < 0) return false
  if (r.gt !== undefined && cmp(v, r.gt) <= 0) return false
  if (r.lte !== undefined && cmp(v, r.lte) > 0) return false
  if (r.lt !== undefined && cmp(v, r.lt) >= 0) return false
  return true
}

function termMatches<R>(t: Term, row: R, spec: ClientSpec<R>): boolean {
  switch (t.kind) {
    case 'text': {
      const hay = spec.text(row)
      const words = t.words.map(norm).filter(Boolean)
      if (!words.length) return true
      return t.neg ? !words.some((w) => hay.includes(w)) : words.every((w) => hay.includes(w))
    }
    case 'field': {
      const likeOf = spec.like?.[t.field]
      if (likeOf) {
        const v = norm(likeOf(row) ?? '')
        const hit = t.values.some((x) => v.includes(norm(x)))
        return t.neg ? !hit : hit
      }
      const of = spec.list?.[t.field]
      if (!of) return true
      const raw = of(row)
      const vals = raw === null || raw === undefined ? [] : Array.isArray(raw) ? raw : [raw]
      const hit = t.values.some((x) => (x === 'none' ? vals.length === 0 : vals.includes(x)))
      return t.neg ? !hit : hit
    }
    case 'num':
    case 'date': {
      const of = t.kind === 'num' ? spec.num?.[t.field] : spec.date?.[t.field]
      if (!of) return true
      const v = of(row)
      if (v === null || v === undefined || v === '') return false
      const hit = inRange(typeof v === 'string' ? v.slice(0, 10) : v, t.range)
      return t.neg ? !hit : hit
    }
    case 'flag': {
      const f = spec.flags?.[t.flag]
      if (!f) return true
      return t.neg ? !f(row) : f(row)
    }
  }
}

/** Does a row match the query (any OR group whose every term matches)? */
export function matchesQuery<R>(q: ParsedQuery | null, row: R, spec: ClientSpec<R>): boolean {
  if (!q || !q.groups.length) return true
  return q.groups.some((g) => g.terms.every((t) => termMatches(t, row, spec)))
}

/** Is a flag asked for (not excluded) anywhere in the query? */
export const hasFlag = (q: ParsedQuery | null, flag: string) => Boolean(q?.groups.some((g) => g.terms.some((t) => t.kind === 'flag' && t.flag === flag && !t.neg)))

/** The values a field is asked for (not excluded) anywhere in the query. */
export const fieldValues = (q: ParsedQuery | null, field: string) =>
  [...new Set(q?.groups.flatMap((g) => g.terms.flatMap((t) => (t.kind === 'field' && t.field === field && !t.neg ? t.values : []))) ?? [])]
