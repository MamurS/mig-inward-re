/**
 * The filter builder's model: a parsed query ⇄ simple form state. Pure, so the
 * round trip is unit-tested. The builder edits one AND group; whatever it has
 * no control for (exclusions, OR, ref:, open-ended or relative ranges …) is
 * kept exactly as typed and written back after the builder's parts.
 */
import { fieldOf, quoteValue, type ListField, type ParsedQuery, type Scope, type SearchContext, type Term } from './query'

export type BuilderItem =
  | { kind: 'chips'; field: string } // a short list: toggle buttons
  | { kind: 'multi'; field: string } // a long list: searchable checklist
  | { kind: 'range'; field: string } // a number field: min / max
  | { kind: 'dates'; field: string } // a date field: from / to
export type BuilderToggle = { flag: string } | { field: string; value: string; labelKey: string }
export type BuilderSpec = { items: BuilderItem[]; toggles: BuilderToggle[] }

export type BuilderState = {
  text: string
  lists: Record<string, string[]>
  ranges: Record<string, { from: string; to: string }>
  flags: Record<string, boolean>
  /** parts kept as typed (shown, never lost) */
  kept: string[]
  /** the query has OR groups — the builder cannot show it */
  orGroups: boolean
}

export const emptyBuilder = (): BuilderState => ({ text: '', lists: {}, ranges: {}, flags: {}, kept: [], orGroups: false })

const ISO = /^\d{4}-\d{2}-\d{2}$/
const SIMPLE = /^[^:<>=]+?(>=|<=|=|:)(.+)$/s

function asRange(t: Term, isDate: boolean): { from: string; to: string } | null {
  const m = SIMPLE.exec(t.raw)
  if (!m) return null
  const [, op, value] = m
  const ok = (v: string) => (isDate ? ISO.test(v) : /^\d+(?:[.,]\d+)?\s*[a-zа-я]*$/i.test(v))
  if (op === ':' || op === '=') {
    const [a, b] = value.split('..')
    if (b === undefined) return isDate && ok(a) ? { from: a, to: a } : null
    if ((a && !ok(a)) || (b && !ok(b)) || (!a && !b)) return null
    return { from: a, to: b }
  }
  if (!ok(value)) return null
  return op === '>=' ? { from: value, to: '' } : { from: '', to: value }
}

export function builderFromQuery(q: ParsedQuery | null, spec: BuilderSpec): BuilderState {
  const s = emptyBuilder()
  if (!q || !q.groups.length) return s
  if (q.groups.length > 1) return { ...s, orGroups: true }
  const listFields = new Set(spec.items.filter((i) => i.kind === 'chips' || i.kind === 'multi').map((i) => i.field))
  for (const tf of spec.toggles) if ('field' in tf) listFields.add(tf.field)
  const rangeFields = new Map(spec.items.filter((i) => i.kind === 'range' || i.kind === 'dates').map((i) => [i.field, i.kind === 'dates']))
  const flags = new Set(spec.toggles.flatMap((tf) => ('flag' in tf ? [tf.flag] : [])))
  const text: string[] = []
  for (const t of q.groups[0].terms) {
    if (t.neg) {
      s.kept.push(t.raw)
      continue
    }
    if (t.kind === 'text' && !t.asText) {
      text.push(t.phrase ? `"${t.words[0]}"` : t.words.join(' '))
    } else if (t.kind === 'field' && listFields.has(t.field)) {
      s.lists[t.field] = [...new Set([...(s.lists[t.field] ?? []), ...t.values])]
    } else if (t.kind === 'flag' && flags.has(t.flag)) {
      s.flags[t.flag] = true
    } else if ((t.kind === 'num' || t.kind === 'date') && rangeFields.has(t.field) && !s.ranges[t.field] && !(t.kind === 'date' && t.keyword)) {
      const r = asRange(t, rangeFields.get(t.field)!)
      if (r) s.ranges[t.field] = r
      else s.kept.push(t.raw)
    } else {
      s.kept.push(t.raw)
    }
  }
  s.text = text.join(' ')
  return s
}

export function builderToText(s: BuilderState, scope: Scope, spec: BuilderSpec, ctx: SearchContext): string {
  const parts: string[] = []
  if (s.text.trim()) parts.push(s.text.trim())
  const listOrder = [...spec.items.map((i) => i.field), ...spec.toggles.flatMap((tf) => ('field' in tf ? [tf.field] : []))]
  for (const key of [...new Set(listOrder)]) {
    const f = fieldOf(scope, key)
    const values = s.lists[key] ?? []
    if (f?.kind === 'list' && values.length) {
      const options = (f as ListField).options(ctx)
      const insert = values.map((v) => quoteValue(options.find((o) => o.value === v)?.insert ?? v))
      parts.push(`${key}:${insert.join('|')}`)
    }
    const r = s.ranges[key]
    if (r && (r.from.trim() || r.to.trim())) {
      const from = r.from.trim()
      const to = r.to.trim()
      parts.push(from && to ? `${key}:${from}..${to}` : from ? `${key}>=${from}` : `${key}<=${to}`)
    }
  }
  for (const tf of spec.toggles) if ('flag' in tf && s.flags[tf.flag]) parts.push(tf.flag)
  parts.push(...s.kept)
  return parts.join(', ')
}
