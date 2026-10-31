/**
 * The search language of the top bar — one engine for every page. A page's
 * Scope (scopes.ts) says which fields, values and keywords it knows; the
 * engine turns text into a structured query with them. Never throws: whatever
 * it cannot read becomes free text, marked so the chips say «searched as text».
 *
 *   ;            OR between groups          Sevil, bound; IUC, offered
 *   ,            AND between parts          Sevil, property, bound
 *   -            exclude                    -declined   -mga:Sevil
 *   "…"          exact phrase               "Yigit Agro"
 *   field:a|b    one of several values      status:offered|bound
 *   > < >= <= .. numbers and dates          premium>100k  inception:2026-01-01..2026-06-30  expiry<30d
 *   keywords     per page                   overdue  expired  mine  today  inactive …
 *
 * Field names, keywords and values are recognised in EN, RU and UZ; matching
 * ignores case, diacritics and apostrophes (normalize.ts).
 */
import { compact, norm } from './normalize'

export type Range = { gte?: string; gt?: string; lte?: string; lt?: string }
export type DateKeyword = 'today' | 'thisweek' | 'thismonth'

type Span = { id: string; start: number; end: number; raw: string; neg: boolean }
export type TextTerm = Span & { kind: 'text'; words: string[]; phrase: boolean; asText?: boolean }
/** `titles`: the values' full names for the chip's tooltip (when a label is a short name). */
export type FieldTerm = Span & { kind: 'field'; field: string; values: string[]; labels: string[]; titles?: string[] }
export type NumTerm = Span & { kind: 'num'; field: string; range: Range; display: string }
export type DateTerm = Span & { kind: 'date'; field: string; range: Range; display: string; keyword?: DateKeyword }
export type FlagTerm = Span & { kind: 'flag'; flag: string }
export type Term = TextTerm | FieldTerm | NumTerm | DateTerm | FlagTerm
export type Group = { terms: Term[] }
export type ParsedQuery = { text: string; groups: Group[] }

/** What the parser needs to know about the world (reference data, today, the user, labels). */
export type SearchContext = {
  today: string // YYYY-MM-DD, Tashkent
  userId: string | null
  counterparties: { id: string; name: string; type: string }[]
  lobs: { id: string; code: string; name: string; name_ru?: string | null; name_uz?: string | null; short_name?: string | null; short_name_ru?: string | null; short_name_uz?: string | null }[]
  countries: { code: string; name: string; name_ru?: string | null; name_uz?: string | null }[]
  currencies: string[]
  users: { id: string; name: string; role?: string | null }[]
  /** UI-language labels (chips, suggestions, the builder); without it values label themselves. */
  t?: (key: string) => string
  /** A country's or line's name in the UI language. */
  localName?: (row: { name: string; name_ru?: string | null; name_uz?: string | null }) => string
  /** A line's short name in the UI language (chips, the builder's summary). */
  localShortName?: (row: SearchContext['lobs'][number]) => string
}

// ---------------------------------------------------------------------------
// Scopes: what one page's search knows
// ---------------------------------------------------------------------------

/**
 * One value of a list field. `names` also count as a bare word / part; `codes` only after `field:`.
 * `full`: the full name when `label` is a short one (lines of business), for pickers, suggestions and tooltips.
 */
export type Option = { value: string; label: string; full?: string; insert: string; names: string[]; codes?: string[] }

type FieldBase = { key: string; aliases: string[]; labelKey: string }
export type ListField = FieldBase & { kind: 'list'; options: (ctx: SearchContext) => Option[]; partial: 'prefix' | 'contains' | 'none' }
export type LikeField = FieldBase & { kind: 'like' }
export type NumField = FieldBase & { kind: 'num' }
export type DateField = FieldBase & { kind: 'date'; looksBack: boolean }
export type FieldDef = ListField | LikeField | NumField | DateField

export type FlagDef = { flag: string; words: string[]; labelKey: string; needsUser?: boolean }

export type Scope = {
  id: string
  fields: FieldDef[]
  flags: FlagDef[]
  /** the date field «today / thisweek / thismonth» filter (none: those words are text) */
  dateKeywordField?: string
  /** list fields whose option names, typed as a bare word or a whole part, filter by it */
  exactFields: string[]
  /** synonyms that only count when they stand alone in their part («new» in «New York Life» is text) */
  weak: string[]
}

const DATE_KEYWORDS: Record<DateKeyword, string[]> = {
  today: ['today', 'сегодня', 'bugun'],
  thisweek: ['thisweek', 'week', 'эта неделя', 'на этой неделе', 'неделя', 'bu hafta', 'hafta'],
  thismonth: ['thismonth', 'month', 'этот месяц', 'в этом месяце', 'месяц', 'bu oy'],
}
const DATE_KEYWORD_OF = new Map<string, DateKeyword>()
for (const [k, list] of Object.entries(DATE_KEYWORDS)) for (const w of list) DATE_KEYWORD_OF.set(compact(w), k as DateKeyword)

/** Lookup tables for a scope, built once per scope object. */
type Vocab = {
  field: Map<string, FieldDef>
  flag: Map<string, FlagDef>
  weak: Set<string>
}
const VOCAB = new WeakMap<Scope, Vocab>()
function vocab(scope: Scope): Vocab {
  let v = VOCAB.get(scope)
  if (!v) {
    v = { field: new Map(), flag: new Map(), weak: new Set(scope.weak.map(compact)) }
    for (const f of scope.fields) for (const a of [f.key, ...f.aliases]) v.field.set(compact(a), f)
    for (const f of scope.flags) for (const w of [f.flag, ...f.words]) v.flag.set(compact(w), f)
    VOCAB.set(scope, v)
  }
  return v
}

export const fieldOf = (scope: Scope, key: string) => scope.fields.find((f) => f.key === key)

/** A field's value → ids / codes: exact names or codes win; otherwise names that start with / contain it. */
export function resolveList(field: ListField, value: string, ctx: SearchContext): { values: string[]; labels: string[]; titles: string[] } | null {
  const c = compact(value)
  if (!c) return null
  const options = field.options(ctx)
  let hits = options.filter((o) => [...o.names, ...(o.codes ?? [])].some((n) => compact(n) === c))
  if (!hits.length && field.partial !== 'none') {
    hits = options.filter((o) => o.names.some((n) => (field.partial === 'prefix' ? compact(n).startsWith(c) : compact(n).includes(c))))
  }
  if (!hits.length) return null
  const seen = new Set<string>()
  hits = hits.filter((o) => !seen.has(o.value) && seen.add(o.value))
  return { values: hits.map((o) => o.value), labels: hits.map((o) => o.label), titles: hits.map((o) => o.full ?? o.label) }
}

/** A whole part (or a single word) that names something exactly becomes that filter. */
function exactName(text: string, scope: Scope, ctx: SearchContext): { field: string; value: string; label: string; title: string } | null {
  const c = compact(text)
  if (!c) return null
  for (const key of scope.exactFields) {
    const f = fieldOf(scope, key)
    if (f?.kind !== 'list') continue
    const o = f.options(ctx).find((x) => x.names.some((n) => compact(n) === c))
    if (o) return { field: key, value: o.value, label: o.label, title: o.full ?? o.label }
  }
  return null
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const DAY = 86_400_000
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const addDays = (d: string, n: number) => iso(Date.parse(`${d}T00:00:00Z`) + n * DAY)

function monthEnd(y: number, m: number) {
  return iso(Date.UTC(y, m, 0)) // m is 1-based: day 0 of the next month
}

/** A date or a period: 2026-10-01, 2026-10, 2026, 01.10.2026. Returns its first and last day. */
function parseDate(v: string): { from: string; to: string } | null {
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v) ?? /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v)
  if (m) {
    const [y, mo, d] = v.includes('-') ? [m[1], m[2], m[3]] : [m[3], m[2], m[1]]
    const t = Date.UTC(Number(y), Number(mo) - 1, Number(d))
    if (Number.isNaN(t) || new Date(t).getUTCDate() !== Number(d)) return null
    return { from: iso(t), to: iso(t) }
  }
  m = /^(\d{4})-(\d{1,2})$/.exec(v)
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { from: `${m[1]}-${m[2].padStart(2, '0')}-01`, to: monthEnd(Number(m[1]), Number(m[2])) }
  m = /^(\d{4})$/.exec(v)
  if (m) return { from: `${m[1]}-01-01`, to: `${m[1]}-12-31` }
  return null
}

function relativeDays(v: string): number | null {
  const m = /^(\d{1,4})\s*(d|д|дн|дней|дня|kun)$/.exec(norm(v))
  return m ? Number(m[1]) : null
}

function dateRange(looksBack: boolean, op: string, value: string, today: string): Range | null {
  const n = relativeDays(value)
  if (n !== null) {
    const back = looksBack
    const edge = back ? addDays(today, -n) : addDays(today, n)
    if (op === '>' || op === '>=') return back ? { [op === '>' ? 'lt' : 'lte']: edge } : { [op === '>' ? 'gt' : 'gte']: edge }
    // :, =, <, <=  → within the next / last n days
    return back ? { gte: edge, lte: today } : { gte: today, lte: edge }
  }
  if (op === ':' || op === '=') {
    const [a, b] = value.split('..')
    if (b !== undefined) {
      const from = a ? parseDate(a) : null
      const to = b ? parseDate(b) : null
      if ((a && !from) || (b && !to) || (!from && !to)) return null
      return { ...(from ? { gte: from.from } : {}), ...(to ? { lte: to.to } : {}) }
    }
    const d = parseDate(value)
    return d ? { gte: d.from, lte: d.to } : null
  }
  const d = parseDate(value)
  if (!d) return null
  if (op === '>') return { gt: d.to }
  if (op === '>=') return { gte: d.from }
  if (op === '<') return { lt: d.from }
  if (op === '<=') return { lte: d.to }
  return null
}

function keywordRange(k: DateKeyword, today: string): Range {
  if (k === 'today') return { gte: today, lte: today }
  if (k === 'thisweek') {
    const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7 // Monday = 0
    return { gte: addDays(today, -dow), lte: addDays(today, 6 - dow) }
  }
  const [y, m] = today.split('-').map(Number)
  return { gte: `${today.slice(0, 7)}-01`, lte: monthEnd(y, m) }
}

// ---------------------------------------------------------------------------
// Numbers: 100000, 100k, 5m, 1.5bn, 250тыс, 5млн
// ---------------------------------------------------------------------------

const SUFFIX: Record<string, number> = { k: 1e3, к: 1e3, тыс: 1e3, m: 1e6, м: 1e6, млн: 1e6, mln: 1e6, b: 1e9, bn: 1e9, млрд: 1e9, mlrd: 1e9 }

function parseNumber(v: string): number | null {
  const m = /^(\d+(?:[.,]\d+)?)\s*([a-zа-я]*)$/.exec(norm(v).replace(/[\s_]/g, ''))
  if (!m) return null
  const mult = m[2] ? SUFFIX[m[2]] : 1
  if (mult === undefined) return null
  return Math.round(Number(m[1].replace(',', '.')) * mult * 1e6) / 1e6
}

function numRange(op: string, value: string): Range | null {
  if (op === ':' || op === '=') {
    const [a, b] = value.split('..')
    if (b !== undefined) {
      const lo = a ? parseNumber(a) : null
      const hi = b ? parseNumber(b) : null
      if ((a && lo === null) || (b && hi === null) || (lo === null && hi === null)) return null
      return { ...(lo !== null ? { gte: String(lo) } : {}), ...(hi !== null ? { lte: String(hi) } : {}) }
    }
    const n = parseNumber(value)
    return n === null ? null : { gte: String(n), lte: String(n) }
  }
  const n = parseNumber(value)
  if (n === null) return null
  return { [op === '>' ? 'gt' : op === '>=' ? 'gte' : op === '<' ? 'lt' : 'lte']: String(n) }
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

type Piece = { start: number; end: number; text: string }

/** Splits on a separator outside double quotes, keeping positions. */
function splitOutsideQuotes(text: string, start: number, end: number, sep: string): Piece[] {
  const out: Piece[] = []
  let inQ = false
  let from = start
  for (let i = start; i < end; i++) {
    const ch = text[i]
    if (ch === '"') inQ = !inQ
    else if (ch === sep && !inQ) {
      out.push({ start: from, end: i, text: text.slice(from, i) })
      from = i + 1
    }
  }
  out.push({ start: from, end, text: text.slice(from, end) })
  return out
}

function trimPiece(text: string, p: Piece): Piece | null {
  let s = p.start
  let e = p.end
  while (s < e && /\s/.test(text[s])) s++
  while (e > s && /\s/.test(text[e - 1])) e--
  return s < e ? { start: s, end: e, text: text.slice(s, e) } : null
}

/** Tokens: whitespace-separated, a quoted run stays whole («mga:"Silk Road"», «"Yigit Agro"»). */
function tokens(text: string, p: Piece): Piece[] {
  const out: Piece[] = []
  let i = p.start
  while (i < p.end) {
    while (i < p.end && /\s/.test(text[i])) i++
    if (i >= p.end) break
    const s = i
    let inQ = false
    while (i < p.end && (inQ || !/\s/.test(text[i]))) {
      if (text[i] === '"') inQ = !inQ
      i++
    }
    out.push({ start: s, end: i, text: text.slice(s, i) })
  }
  return out
}

const unquote = (v: string) => v.replace(/^"/, '').replace(/"$/, '')
const cleanWord = (w: string) => w.replace(/["\\*%()]/g, '').trim()

let seq = 0
const nextId = () => `t${++seq}`

const OP_RE = /^([^:<>=]+?)(>=|<=|>|<|=|:)(.*)$/s

function parseToken(tok: Piece, scope: Scope, ctx: SearchContext, alone: boolean): Term | 'word' {
  const v = vocab(scope)
  let raw = tok.text
  let neg = false
  if (raw.startsWith('-') && raw.length > 1) {
    neg = true
    raw = raw.slice(1)
  }
  const base = { id: nextId(), start: tok.start, end: tok.end, raw: tok.text, neg }

  // exact phrase
  if (raw.startsWith('"')) {
    const closed = raw.length > 1 && raw.endsWith('"')
    const phrase = cleanWord(raw)
    if (!phrase) return { ...base, kind: 'text', words: [], phrase: true, asText: true }
    return { ...base, kind: 'text', words: [phrase], phrase: true, ...(closed ? {} : { asText: true }) }
  }

  // field:value, field>value …
  const m = OP_RE.exec(raw)
  if (m) {
    const field = v.field.get(compact(m[1]))
    const op = m[2]
    const value = unquote(m[3].trim())
    if (field && value) {
      if (field.kind === 'num') {
        const range = numRange(op, value)
        if (range) return { ...base, kind: 'num', field: field.key, range, display: `${op === ':' ? '=' : op} ${value}` }
      } else if (field.kind === 'date') {
        const range = dateRange(field.looksBack, op, value, ctx.today)
        if (range) return { ...base, kind: 'date', field: field.key, range, display: `${op === ':' ? '' : `${op} `}${value}` }
      } else if (op === ':' || op === '=') {
        const parts = value.split('|').map((x) => unquote(x.trim())).filter(Boolean)
        const res = parts.map((x) => (field.kind === 'like' ? { values: [x], labels: [x], titles: [x] } : resolveList(field, x, ctx)))
        if (res.length && res.every(Boolean)) {
          const values = [...new Set(res.flatMap((r) => r!.values))]
          const labels = [...new Set(res.flatMap((r) => r!.labels))]
          const titles = [...new Set(res.flatMap((r) => r!.titles))]
          return { ...base, kind: 'field', field: field.key, values, labels, titles }
        }
      }
    }
    // not understood: search for its words as text, and say so
    // (a known field with a value we cannot match searches the value; an unknown «field» searches it all)
    const words = cleanWord(field && value ? value : raw).split(/[\s|:<>=]+/).filter(Boolean)
    return { ...base, kind: 'text', words: words.length ? words : [cleanWord(raw)].filter(Boolean), phrase: false, asText: true }
  }

  // single words: keywords, statuses, currencies, names
  if (!alone && !neg && v.weak.has(compact(raw))) return 'word'
  const kw = keyword(compact(raw), scope, ctx, base)
  if (kw) return kw
  const named = exactName(raw, scope, ctx)
  if (named) return { ...base, kind: 'field', field: named.field, values: [named.value], labels: [named.label], titles: [named.title] }
  if (neg) return { ...base, kind: 'text', words: [cleanWord(raw)].filter(Boolean), phrase: false }
  return 'word'
}

/** A keyword of this scope (a flag, or today / thisweek / thismonth), or null. */
function keyword(c: string, scope: Scope, ctx: SearchContext, base: Span): Term | null {
  const dk = DATE_KEYWORD_OF.get(c)
  if (dk && scope.dateKeywordField) {
    return { ...base, kind: 'date', field: scope.dateKeywordField, range: keywordRange(dk, ctx.today), display: dk, keyword: dk }
  }
  const flag = vocab(scope).flag.get(c)
  if (flag && (!flag.needsUser || ctx.userId)) return { ...base, kind: 'flag', flag: flag.flag }
  return null
}

function parsePart(text: string, part: Piece, scope: Scope, ctx: SearchContext): Term[] {
  // the whole part names something («Silk Road Underwriting Agency», «на рассмотрении», «this week»)
  if (!/["':<>=]/.test(part.text) && !part.text.startsWith('-') && /\s/.test(part.text)) {
    const base = { id: nextId(), start: part.start, end: part.end, raw: part.text, neg: false }
    const kw = keyword(compact(part.text), scope, ctx, base)
    if (kw) return [kw]
    const named = exactName(part.text, scope, ctx)
    if (named) return [{ ...base, kind: 'field', field: named.field, values: [named.value], labels: [named.label], titles: [named.title] }]
  }
  const out: Term[] = []
  let run: Piece[] = [] // consecutive plain words → one text term
  const flush = () => {
    if (!run.length) return
    const words = run.map((p) => cleanWord(p.text)).filter(Boolean)
    if (words.length) {
      const start = run[0].start
      const end = run[run.length - 1].end
      out.push({ id: nextId(), start, end, raw: text.slice(start, end), neg: false, kind: 'text', words, phrase: false })
    }
    run = []
  }
  const toks = tokens(text, part)
  for (const tok of toks) {
    const t = parseToken(tok, scope, ctx, toks.length === 1)
    if (t === 'word') run.push(tok)
    else {
      flush()
      if (t.kind !== 'text' || t.words.length) out.push(t)
    }
  }
  flush()
  return out
}

export function parseQuery(text: string, ctx: SearchContext, scope: Scope): ParsedQuery {
  const groups: Group[] = []
  for (const g of splitOutsideQuotes(text, 0, text.length, ';')) {
    const terms: Term[] = []
    for (const p of splitOutsideQuotes(text, g.start, g.end, ',')) {
      const part = trimPiece(text, p)
      if (part) terms.push(...parsePart(text, part, scope, ctx))
    }
    if (terms.length) groups.push({ terms })
  }
  return { text, groups }
}

export const isEmptyQuery = (q: ParsedQuery) => q.groups.length === 0

/** All free-text words of a query (for highlighting matches in the table). */
export function textWords(q: ParsedQuery): string[] {
  return q.groups.flatMap((g) => g.terms.flatMap((t) => (t.kind === 'text' && !t.neg ? t.words : [])))
}

// ---------------------------------------------------------------------------
// Editing the text
// ---------------------------------------------------------------------------

/** Re-joins a query after an edit: drops empty parts and groups, single spaces outside quotes. */
export function tidy(text: string): string {
  const groups = splitOutsideQuotes(text, 0, text.length, ';')
    .map((g) =>
      splitOutsideQuotes(text, g.start, g.end, ',')
        .map((p) => trimPiece(text, p)?.text.replace(/\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/g, ' ') ?? '')
        .filter(Boolean)
        .join(', '),
    )
    .filter(Boolean)
  return groups.join('; ')
}

/** Removes one term's text (a chip's ×) and tidies the rest. */
export function removeTerm(text: string, term: Pick<Term, 'start' | 'end'>): string {
  return tidy(text.slice(0, term.start) + text.slice(term.end))
}

/** Quotes a value when it has spaces or syntax characters. */
export function quoteValue(v: string): string {
  return /[\s,;:|<>="]/.test(v) ? `"${v.replace(/"/g, '')}"` : v
}

/** The token being typed at the end of the text (for suggestions): its span, field (if any) and value. */
export function currentToken(text: string, scope: Scope): { start: number; end: number; neg: boolean; field: string | null; value: string } {
  let inQ = false
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') inQ = !inQ
    else if (!inQ && (ch === ',' || ch === ';' || /\s/.test(ch))) start = i + 1
  }
  let tok = text.slice(start)
  let neg = false
  if (tok.startsWith('-')) {
    neg = true
    tok = tok.slice(1)
  }
  const m = /^([^:]+):(.*)$/s.exec(tok)
  const def = m ? vocab(scope).field.get(compact(m[1])) : undefined
  const field = def && (def.kind === 'list' || def.kind === 'like') ? def.key : null
  const value = unquote(field ? m![2].split('|').pop()! : tok)
  return { start, end: text.length, neg, field, value }
}
