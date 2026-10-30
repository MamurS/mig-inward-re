/**
 * A parsed query → one PostgREST logic tree, so a server-side page filters in
 * the database (never «load everything and filter in the browser»):
 *   (g1 OR g2 …), each group = and(term, term …)
 * A ServerSpec (scopes.ts) maps the scope's fields to columns. Free text
 * matches one normalised text column (submissions_v.search_text, built by
 * public.search_norm() exactly as normalize.ts does here).
 */
import { norm } from './normalize'
import type { ParsedQuery, Range, Term } from './query'

export type ServerSpec = {
  /** list fields → column (excluding keeps rows with no value) */
  list: Record<string, string>
  /** substring fields → column */
  like: Record<string, string>
  num: Record<string, string>
  /** date fields → column (date or timestamp: compared by day) */
  date: Record<string, string>
  flags: Record<string, (neg: boolean, userId: string | null) => string | null>
  /** the normalised column free text matches; or a function for scopes without one */
  textColumn: string | ((word: string, neg: boolean) => string)
}

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

export function termCondition(t: Term, spec: ServerSpec, userId: string | null): string | null {
  switch (t.kind) {
    case 'text': {
      const words = t.words.map((w) => norm(w)).filter(Boolean)
      if (!words.length) return null
      // excluding text: none of the words; including: every word
      const tc = spec.textColumn
      return all(words.map((w) => (typeof tc === 'string' ? `${tc}.${t.neg ? 'not.' : ''}ilike.${like(w)}` : tc(w, t.neg))))
    }
    case 'field': {
      const likeCol = spec.like[t.field]
      if (likeCol) {
        if (t.neg) return all(t.values.map((v) => `${likeCol}.not.ilike.${like(v)}`))
        const conds = t.values.map((v) => `${likeCol}.ilike.${like(v)}`)
        return conds.length === 1 ? conds[0] : `or(${conds.join(',')})`
      }
      const col = spec.list[t.field]
      if (!col) return null
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
      const col = t.kind === 'num' ? spec.num[t.field] : spec.date[t.field]
      if (!col) return null
      const conds = rangeConds(col, t.range, t.kind === 'date')
      if (!conds.length) return null
      return t.neg ? not(conds) : all(conds)
    }
    case 'flag':
      return spec.flags[t.flag]?.(t.neg, userId) ?? null
  }
}

/** The `or` filter for the whole query, or null when it filters nothing. */
export function toPostgrestFilter(query: ParsedQuery, spec: ServerSpec, userId: string | null): string | null {
  const groups = query.groups
    .map((g) =>
      g.terms
        .map((t) => termCondition(t, spec, userId))
        .filter((c): c is string => Boolean(c))
        // an and(…) inside a group's and(…) is the same thing: flatten it
        .map((c) => (c.startsWith('and(') ? c.slice(4, -1) : c)),
    )
    .filter((conds) => conds.length > 0)
  if (!groups.length) return null
  return groups.map((conds) => `and(${conds.join(',')})`).join(',')
}
