/**
 * The search language of the top bar — one pure function from text to a
 * structured query (DESIGN.md «Search»). Never throws: whatever it cannot read
 * becomes free text, marked so the chips can say «searched as text».
 *
 *   ;            OR between groups          Sevil, bound; IUC, offered
 *   ,            AND between parts          Sevil, property, bound
 *   -            exclude                    -declined   -mga:Sevil
 *   "…"          exact phrase               "Yigit Agro"
 *   field:a|b    one of several values      status:offered|bound
 *   > < >= <= .. numbers and dates          premium>100k  inception:2026-01-01..2026-06-30  expiry<30d
 *   keywords     overdue expired noresponse mine today thisweek thismonth
 *
 * Field names, keywords and status words are recognised in EN, RU and UZ;
 * matching ignores case, diacritics and apostrophes (normalize.ts).
 */
import { compact, norm } from './normalize'

export const STATUS_KEYS = ['received', 'under_review', 'offered', 'no_response', 'bound', 'declined', 'ntu'] as const
export type StatusKey = (typeof STATUS_KEYS)[number]

export type FieldKey = 'status' | 'mga' | 'broker' | 'lob' | 'country' | 'ccy' | 'uw' | 'type' | 'ref'
export type NumKey = 'premium' | 'share' | 'si'
export type DateKey = 'received' | 'inception' | 'expiry' | 'bound'
export type Flag = 'overdue' | 'expired' | 'mine'
export type Range = { gte?: string; gt?: string; lte?: string; lt?: string }

type Span = { id: string; start: number; end: number; raw: string; neg: boolean }
export type TextTerm = Span & { kind: 'text'; words: string[]; phrase: boolean; asText?: boolean }
export type FieldTerm = Span & { kind: 'field'; field: FieldKey; values: string[]; labels: string[] }
export type NumTerm = Span & { kind: 'num'; field: NumKey; range: Range; display: string }
export type DateTerm = Span & { kind: 'date'; field: DateKey; range: Range; display: string; keyword?: 'today' | 'thisweek' | 'thismonth' }
export type FlagTerm = Span & { kind: 'flag'; flag: Flag }
export type Term = TextTerm | FieldTerm | NumTerm | DateTerm | FlagTerm
export type Group = { terms: Term[] }
export type ParsedQuery = { text: string; groups: Group[] }

/** What the parser needs to know about the world (reference data, today, the user). */
export type SearchContext = {
  today: string // YYYY-MM-DD, Tashkent
  userId: string | null
  counterparties: { id: string; name: string; type: string }[]
  lobs: { id: string; code: string; name: string; name_ru?: string | null; name_uz?: string | null }[]
  countries: { code: string; name: string; name_ru?: string | null; name_uz?: string | null }[]
  currencies: string[]
  users: { id: string; name: string }[]
  /** Status labels in the UI language (chips); the parser knows all three languages itself. */
  statusLabel?: (s: StatusKey) => string
  /** A country's or line's name in the UI language (chips). */
  localName?: (row: { name: string; name_ru?: string | null; name_uz?: string | null }) => string
}

// ---------------------------------------------------------------------------
// Vocabulary (compared after compact(): lower case, no diacritics, apostrophes, spaces)
// ---------------------------------------------------------------------------

const FIELD_ALIASES: Record<FieldKey | NumKey | DateKey, string[]> = {
  status: ['status', 'state', 'статус', 'состояние', 'holat', 'holati'],
  mga: ['mga', 'мга', 'agent', 'агент'],
  broker: ['broker', 'брокер', 'vositachi'],
  lob: ['lob', 'line', 'class', 'вид', 'класс', 'линия', 'yonalish', 'sinf', 'soha'],
  country: ['country', 'страна', 'mamlakat', 'davlat'],
  ccy: ['ccy', 'currency', 'cur', 'валюта', 'вал', 'valyuta'],
  uw: ['uw', 'underwriter', 'андеррайтер', 'андер', 'anderrayter'],
  type: ['type', 'тип', 'turi', 'tur'],
  ref: ['ref', 'refno', 'номер', 'реф', 'raqam'],
  premium: ['premium', 'prem', 'премия', 'mukofot'],
  share: ['share', 'доля', 'ulush'],
  si: ['si', 'suminsured', 'sum', 'сумма', 'сс', 'summa'],
  received: ['received', 'recv', 'получена', 'получено', 'поступила', 'qabul', 'qabulqilindi', 'kelgan'],
  inception: ['inception', 'start', 'from', 'начало', 'с', 'boshlanish', 'boshi'],
  expiry: ['expiry', 'expires', 'end', 'to', 'окончание', 'конец', 'по', 'tugash', 'oxiri'],
  bound: ['bound', 'boundon', 'подтверждена', 'tasdiqlandi'],
}
const FIELD_OF = new Map<string, FieldKey | NumKey | DateKey>()
for (const [k, list] of Object.entries(FIELD_ALIASES)) for (const a of list) FIELD_OF.set(compact(a), k as FieldKey)
const NUM_FIELDS = new Set<string>(['premium', 'share', 'si'])
const DATE_FIELDS = new Set<string>(['received', 'inception', 'expiry', 'bound'])

/** Every status in EN / RU / UZ, with the usual synonyms. */
export const STATUS_WORDS: Record<StatusKey, string[]> = {
  received: ['received', 'new', 'получена', 'получен', 'получено', 'новая', 'новые', 'qabulqilindi', 'qabul', 'yangi'],
  under_review: ['under_review', 'underreview', 'review', 'inreview', 'на рассмотрении', 'рассмотрение', 'korib chiqilmoqda', 'korib'],
  offered: ['offered', 'offer', 'quoted', 'предложение', 'предложена', 'котировка', 'taklif berildi', 'taklif'],
  no_response: ['no_response', 'noresponse', 'nores', 'нет ответа', 'безответа', 'javob yoq', 'javobsiz'],
  bound: ['bound', 'подтверждена', 'подтвержден', 'связан', 'связана', 'связанные', 'связанный', 'tasdiqlandi', 'tasdiqlangan', 'boglangan'],
  declined: ['declined', 'decline', 'отклонена', 'отклонено', 'отказ', 'rad etildi', 'rad', 'radetilgan'],
  ntu: ['ntu', 'nottakenup', 'не принята', 'qabulqilinmadi'],
}
const STATUS_OF = new Map<string, StatusKey>()
for (const [k, list] of Object.entries(STATUS_WORDS)) for (const w of list) STATUS_OF.set(compact(w), k as StatusKey)

const TYPE_WORDS: Record<string, string[]> = {
  facultative: ['facultative', 'fac', 'факультатив', 'факультативный', 'fakultativ'],
  binder: ['binder', 'биндер', 'binder'],
}

const FLAG_WORDS: Record<Flag, string[]> = {
  overdue: ['overdue', 'late', 'просрочено', 'просрочен', 'просроченные', 'просрочка', 'kechikkan', 'muddati otgan'],
  expired: ['expired', 'истекло', 'истек', 'истекшие', 'просроченное предложение', 'eskirgan', 'muddati tugagan'],
  mine: ['mine', 'my', 'мои', 'мое', 'моё', 'mening', 'meniki'],
}
const DATE_KEYWORDS: Record<'today' | 'thisweek' | 'thismonth', string[]> = {
  today: ['today', 'сегодня', 'bugun'],
  thisweek: ['thisweek', 'week', 'эта неделя', 'на этой неделе', 'неделя', 'bu hafta', 'hafta'],
  thismonth: ['thismonth', 'month', 'этот месяц', 'в этом месяце', 'месяц', 'bu oy'],
}
const KEYWORD_OF = new Map<string, Flag | 'today' | 'thisweek' | 'thismonth'>()
for (const [k, list] of Object.entries({ ...FLAG_WORDS, ...DATE_KEYWORDS })) for (const w of list) KEYWORD_OF.set(compact(w), k as Flag)

/** Synonyms that only count as a filter when they stand alone in their part («new» in «New York Life» is text). */
const WEAK = new Set(
  ['new', 'yangi', 'review', 'offer', 'quoted', 'taklif', 'qabul', 'rad', 'korib', 'decline', 'отказ', 'javobsiz', 'nores', 'my', 'late', 'week', 'month', 'hafta', 'неделя', 'месяц', 'с', 'по'].map(compact),
)

const NO_BROKER = new Set(['none', 'direct', 'нет', 'прямой', 'прямая', 'без', 'yoq', 'togridan'].map(compact))

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

/** Received and bound look back from today; inception and expiry look ahead. */
const LOOKS_BACK = new Set<DateKey>(['received', 'bound'])

function relativeDays(v: string): number | null {
  const m = /^(\d{1,4})\s*(d|д|дн|дней|дня|kun)$/.exec(norm(v))
  return m ? Number(m[1]) : null
}

function dateRange(field: DateKey, op: string, value: string, today: string): Range | null {
  const n = relativeDays(value)
  if (n !== null) {
    const back = LOOKS_BACK.has(field)
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

function keywordRange(k: 'today' | 'thisweek' | 'thismonth', today: string): Range {
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
// Values of list fields → ids / codes
// ---------------------------------------------------------------------------

/** Exact (normalised) name matches win; otherwise everything whose name contains the value. */
function pick<T>(items: T[], names: (x: T) => (string | null | undefined)[], value: string): T[] {
  const c = compact(value)
  if (!c) return []
  const exact = items.filter((x) => names(x).some((n) => n && compact(n) === c))
  if (exact.length) return exact
  return items.filter((x) => names(x).some((n) => n && compact(n).includes(c)))
}

function resolve(field: FieldKey, value: string, ctx: SearchContext): { values: string[]; labels: string[] } | null {
  const v = value.trim()
  if (!v) return null
  const one = (values: string[], labels: string[]) => (values.length ? { values, labels } : null)
  switch (field) {
    case 'status': {
      const exact = STATUS_OF.get(compact(v))
      if (exact) return one([exact], [ctx.statusLabel?.(exact) ?? exact])
      const c = compact(v)
      const hits = STATUS_KEYS.filter((k) => STATUS_WORDS[k].some((w) => compact(w).startsWith(c)))
      return one(hits, hits.map((k) => ctx.statusLabel?.(k) ?? k))
    }
    case 'mga':
    case 'broker': {
      if (field === 'broker' && NO_BROKER.has(compact(v))) return { values: ['none'], labels: ['—'] }
      const hits = pick(ctx.counterparties.filter((c) => c.type === field), (c) => [c.name], v)
      return one(hits.map((c) => c.id), hits.map((c) => c.name))
    }
    case 'lob': {
      const hits = pick(ctx.lobs, (l) => [l.code, l.name, l.name_ru, l.name_uz], v)
      return one(hits.map((l) => l.id), hits.map((l) => ctx.localName?.(l) ?? l.name))
    }
    case 'country': {
      const exactCode = ctx.countries.filter((c) => c.code.toLowerCase() === v.toLowerCase())
      const hits = exactCode.length ? exactCode : pick(ctx.countries, (c) => [c.name, c.name_ru, c.name_uz], v)
      return one(hits.map((c) => c.code), hits.map((c) => ctx.localName?.(c) ?? c.name))
    }
    case 'ccy': {
      const hits = ctx.currencies.filter((c) => c.toLowerCase() === v.toLowerCase())
      return one(hits, hits)
    }
    case 'uw': {
      if (KEYWORD_OF.get(compact(v)) === 'mine' && ctx.userId) {
        const me = ctx.users.find((u) => u.id === ctx.userId)
        return { values: [ctx.userId], labels: [me?.name ?? v] }
      }
      const hits = pick(ctx.users, (u) => [u.name], v)
      return one(hits.map((u) => u.id), hits.map((u) => u.name))
    }
    case 'type': {
      const c = compact(v)
      const hits = Object.keys(TYPE_WORDS).filter((k) => TYPE_WORDS[k].some((w) => compact(w).startsWith(c)))
      return one(hits, hits)
    }
    case 'ref':
      return { values: [v], labels: [v] }
  }
}

/** A whole part (or a single word) that names something exactly becomes that filter. */
function exactName(text: string, ctx: SearchContext): { field: FieldKey; value: string; label: string } | null {
  const c = compact(text)
  if (!c) return null
  const status = STATUS_OF.get(c)
  if (status) return { field: 'status', value: status, label: ctx.statusLabel?.(status) ?? status }
  const ccy = ctx.currencies.find((x) => x.toLowerCase() === c)
  if (ccy) return { field: 'ccy', value: ccy, label: ccy }
  const cp = ctx.counterparties.find((x) => (x.type === 'mga' || x.type === 'broker') && compact(x.name) === c)
  if (cp) return { field: cp.type as FieldKey, value: cp.id, label: cp.name }
  const lob = ctx.lobs.find((l) => [l.name, l.name_ru, l.name_uz].some((n) => n && compact(n) === c))
  if (lob) return { field: 'lob', value: lob.id, label: ctx.localName?.(lob) ?? lob.name }
  const country = ctx.countries.find((x) => [x.name, x.name_ru, x.name_uz].some((n) => n && compact(n) === c))
  if (country) return { field: 'country', value: country.code, label: ctx.localName?.(country) ?? country.name }
  return null
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

function parseToken(tok: Piece, ctx: SearchContext, alone: boolean): Term | 'word' {
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
    const key = FIELD_OF.get(compact(m[1]))
    const op = m[2]
    const value = unquote(m[3].trim())
    if (key && value) {
      if (NUM_FIELDS.has(key)) {
        const range = numRange(op, value)
        if (range) return { ...base, kind: 'num', field: key as NumKey, range, display: `${op === ':' ? '=' : op} ${value}` }
      } else if (DATE_FIELDS.has(key)) {
        const range = dateRange(key as DateKey, op, value, ctx.today)
        if (range) return { ...base, kind: 'date', field: key as DateKey, range, display: `${op === ':' ? '' : `${op} `}${value}` }
      } else if (op === ':' || op === '=') {
        const parts = value.split('|').map((x) => unquote(x.trim())).filter(Boolean)
        const res = parts.map((x) => resolve(key as FieldKey, x, ctx))
        if (res.length && res.every(Boolean)) {
          const values = [...new Set(res.flatMap((r) => r!.values))]
          const labels = [...new Set(res.flatMap((r) => r!.labels))]
          return { ...base, kind: 'field', field: key as FieldKey, values, labels }
        }
      }
    }
    // not understood: search for its words as text, and say so
    // (a known field with a value we cannot match searches the value; an unknown «field» searches it all)
    const words = cleanWord(key && value ? value : raw).split(/[\s|:<>=]+/).filter(Boolean)
    return { ...base, kind: 'text', words: words.length ? words : [cleanWord(raw)].filter(Boolean), phrase: false, asText: true }
  }

  // single words: keywords, statuses, currencies, names
  if (!alone && !neg && WEAK.has(compact(raw))) return 'word'
  const kw = KEYWORD_OF.get(compact(raw))
  if (kw === 'today' || kw === 'thisweek' || kw === 'thismonth') {
    return { ...base, kind: 'date', field: 'received', range: keywordRange(kw, ctx.today), display: kw, keyword: kw }
  }
  if (kw === 'mine' && !ctx.userId) return { ...base, kind: 'text', words: [cleanWord(raw)], phrase: false, asText: true }
  if (kw) return { ...base, kind: 'flag', flag: kw }
  const named = exactName(raw, ctx)
  if (named) return { ...base, kind: 'field', field: named.field, values: [named.value], labels: [named.label] }
  if (neg) return { ...base, kind: 'text', words: [cleanWord(raw)].filter(Boolean), phrase: false }
  return 'word'
}

function parsePart(text: string, part: Piece, ctx: SearchContext): Term[] {
  // the whole part names something («Silk Road Underwriting Agency», «на рассмотрении», «this week»)
  if (!/["':<>=]/.test(part.text) && !part.text.startsWith('-') && /\s/.test(part.text)) {
    const base = { id: nextId(), start: part.start, end: part.end, raw: part.text, neg: false }
    const kw = KEYWORD_OF.get(compact(part.text))
    if (kw === 'today' || kw === 'thisweek' || kw === 'thismonth') {
      return [{ ...base, kind: 'date', field: 'received', range: keywordRange(kw, ctx.today), display: kw, keyword: kw }]
    }
    if (kw && (kw !== 'mine' || ctx.userId)) return [{ ...base, kind: 'flag', flag: kw }]
    const named = exactName(part.text, ctx)
    if (named) return [{ ...base, kind: 'field', field: named.field, values: [named.value], labels: [named.label] }]
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
    const t = parseToken(tok, ctx, toks.length === 1)
    if (t === 'word') run.push(tok)
    else {
      flush()
      if (t.kind !== 'text' || t.words.length) out.push(t)
    }
  }
  flush()
  return out
}

export function parseQuery(text: string, ctx: SearchContext): ParsedQuery {
  const groups: Group[] = []
  for (const g of splitOutsideQuotes(text, 0, text.length, ';')) {
    const terms: Term[] = []
    for (const p of splitOutsideQuotes(text, g.start, g.end, ',')) {
      const part = trimPiece(text, p)
      if (part) terms.push(...parsePart(text, part, ctx))
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
export function currentToken(text: string): { start: number; end: number; neg: boolean; field: FieldKey | null; value: string } {
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
  const key = m ? FIELD_OF.get(compact(m[1])) : undefined
  const field = key && !NUM_FIELDS.has(key) && !DATE_FIELDS.has(key) ? (key as FieldKey) : null
  const value = unquote(field ? m![2].split('|').pop()! : tok)
  return { start, end: text.length, neg, field, value }
}
