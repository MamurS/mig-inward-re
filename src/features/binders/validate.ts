/**
 * Bordereau checks, the same ones the database re-runs on import: every line
 * is mapped to the system's fields, parsed, and checked against the binder.
 * An error leaves the line out (the database would refuse it); a warning lets
 * it in only with the reviewer's comment. Pure: no React, no Supabase.
 */
import { scaledToString, toScaled } from '@/lib/decimal'
import type { Cell } from './parse'

export type BordereauKind = 'risk' | 'premium' | 'claims'
export type FieldType = 'text' | 'date' | 'amount' | 'country' | 'currency' | 'lob'
export type FieldDef = { key: string; type: FieldType; required?: boolean; synonyms: string[] }

const F = (key: string, type: FieldType, synonyms: string[], required = false): FieldDef => ({ key, type, required, synonyms })

/** The system's fields per kind; synonyms (lower case, no punctuation) drive the first mapping guess. */
export const FIELDS: Record<BordereauKind, FieldDef[]> = {
  risk: [
    F('policy_ref', 'text', ['policy', 'policyno', 'policynumber', 'certificate', 'certificateno', 'certno', 'ref', 'reference', 'полис', 'номерполиса', 'сертификат', 'polis'], true),
    F('insured_name', 'text', ['insured', 'assured', 'insuredname', 'client', 'страхователь', 'застрахованный', 'sugurtalovchi']),
    F('insured_country', 'country', ['country', 'countrycode', 'territory', 'страна', 'mamlakat']),
    F('lob', 'lob', ['lob', 'line', 'class', 'lineofbusiness', 'вид', 'класс', 'yonalish']),
    F('period_from', 'date', ['inception', 'from', 'startdate', 'start', 'periodfrom', 'effective', 'начало', 'датаначала', 'boshlanish'], true),
    F('period_to', 'date', ['expiry', 'to', 'enddate', 'end', 'periodto', 'окончание', 'датаокончания', 'tugash']),
    F('currency', 'currency', ['currency', 'ccy', 'cur', 'валюта', 'valyuta'], true),
    F('sum_insured_100', 'amount', ['suminsured', 'si', 'suminsured100', 'tsi', 'страховаясумма', 'sugurtasummasi']),
    F('limit_100', 'amount', ['limit', 'limit100', 'liability', 'лимит', 'limiti']),
  ],
  premium: [
    F('policy_ref', 'text', ['policy', 'policyno', 'policynumber', 'certificate', 'certificateno', 'certno', 'ref', 'reference', 'полис', 'номерполиса', 'сертификат', 'polis'], true),
    F('transaction', 'text', ['transaction', 'transactiontype', 'type', 'trantype', 'endorsement', 'тип', 'операция']),
    F('insured_name', 'text', ['insured', 'assured', 'insuredname', 'client', 'страхователь', 'sugurtalovchi']),
    F('insured_country', 'country', ['country', 'countrycode', 'territory', 'страна', 'mamlakat']),
    F('lob', 'lob', ['lob', 'line', 'class', 'lineofbusiness', 'вид', 'класс', 'yonalish']),
    F('period_from', 'date', ['inception', 'from', 'startdate', 'start', 'periodfrom', 'effective', 'начало', 'boshlanish']),
    F('currency', 'currency', ['currency', 'ccy', 'cur', 'валюта', 'valyuta'], true),
    F('gross_premium_100', 'amount', ['grosspremium', 'grosspremium100', 'premium', 'gwp', 'gross', 'премия', 'брутто', 'mukofot'], true),
  ],
  claims: [
    F('claim_ref', 'text', ['claim', 'claimno', 'claimnumber', 'claimref', 'claimreference', 'убыток', 'номерубытка', 'zarar'], true),
    F('policy_ref', 'text', ['policy', 'policyno', 'policynumber', 'certificate', 'certificateno', 'полис', 'polis']),
    F('insured_name', 'text', ['insured', 'assured', 'insuredname', 'страхователь', 'sugurtalovchi']),
    F('insured_country', 'country', ['country', 'countrycode', 'territory', 'страна', 'mamlakat']),
    F('lob', 'lob', ['lob', 'line', 'class', 'вид', 'класс', 'yonalish']),
    F('date_of_loss', 'date', ['dateofloss', 'lossdate', 'dol', 'датаубытка', 'zararsana'], true),
    F('notified_date', 'date', ['notified', 'notificationdate', 'reported', 'reporteddate', 'датазаявления']),
    F('cause', 'text', ['cause', 'causeofloss', 'description', 'причина', 'sabab']),
    F('currency', 'currency', ['currency', 'ccy', 'cur', 'валюта', 'valyuta'], true),
    F('paid_100', 'amount', ['paid', 'paidtodate', 'paid100', 'оплачено', 'tolangan']),
    F('outstanding_100', 'amount', ['outstanding', 'os', 'reserve', 'outstanding100', 'резерв', 'остаток', 'qoldiq']),
  ],
}

/** field key → the file's column title */
export type Mapping = Record<string, string>

const norm = (s: string) => s.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '')

/** A first guess: each field takes the first unused column whose title matches one of its synonyms. */
export function autoMap(headers: string[], kind: BordereauKind): Mapping {
  const used = new Set<string>()
  const out: Mapping = {}
  for (const f of FIELDS[kind]) {
    const exact = headers.find((h) => !used.has(h) && (norm(h) === norm(f.key) || f.synonyms.includes(norm(h))))
    const partial = exact ?? headers.find((h) => !used.has(h) && f.synonyms.some((s) => s.length > 3 && norm(h).includes(s)))
    if (partial) {
      out[f.key] = partial
      used.add(partial)
    }
  }
  return out
}

/** Keep a saved template's choices that still exist in this file. */
export function applyTemplate(saved: Mapping, headers: string[]): Mapping {
  return Object.fromEntries(Object.entries(saved).filter(([, col]) => headers.includes(col)))
}

export type BinderTerms = {
  period_from: string
  period_to: string
  currency: string
  limit_per_risk: number | null
  territories: string[]
  lobs: { id: string; code: string; name: string; limit_100: number | null }[]
}
export type CheckContext = {
  kind: BordereauKind
  binder: BinderTerms
  periodStart: string
  periodEnd: string
  /** dup keys already on this binder for this kind */
  existing: Set<string>
  currencies: Set<string>
  /** lower-case country name → ISO code (EN / RU / UZ names) */
  countries: Map<string, string>
}

export type Issue = { level: 'error' | 'warning'; code: string; field?: string; params?: Record<string, string | number> }
export type CheckedLine = {
  line_no: number
  /** the row as the file has it (column title → text) */
  raw: Record<string, string>
  values: Record<string, string | null>
  lob_id: string | null
  dup_key: string
  issues: Issue[]
  status: 'ok' | 'warning' | 'error'
}

export function parseDate(v: Cell): string | null | undefined {
  if (v === null || v === '') return null
  if (v instanceof Date) return isNaN(v.getTime()) ? undefined : v.toISOString().slice(0, 10)
  if (typeof v === 'number') {
    // an Excel serial date that read as a number
    if (v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10)
    return undefined
  }
  const s = String(v).trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s)
  if (m) return ymd(+m[1], +m[2], +m[3])
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s)
  if (m) return ymd(+m[3], +m[2], +m[1]) // day first, as in the region
  return undefined
}

function ymd(y: number, mo: number, d: number) {
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return undefined
  return dt.toISOString().slice(0, 10)
}

/** An amount as an exact decimal string ("1234.5"), or undefined when it is not a number. Handles 1 234,56 / 1,234.56 / (1,000). */
export function parseAmount(v: Cell): string | null | undefined {
  if (v === null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? scaledToString(toScaled(v, 2)!, 2) : undefined
  if (typeof v !== 'string') return undefined
  let s = v.trim().replace(/[\s  ']/g, '').replace(/^[A-Z]{3}/i, '').replace(/[A-Z]{3}$/i, '')
  let neg = false
  if (/^\(.*\)$/.test(s)) {
    neg = true
    s = s.slice(1, -1)
  }
  if (s.startsWith('-')) {
    neg = !neg
    s = s.slice(1)
  }
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) {
    // 1.234,56 or 1234,56 → comma is the decimal mark when followed by 1–2 digits
    s = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else s = s.replace(/,/g, '')
  if (!/^\d+(\.\d+)?$/.test(s)) return undefined
  const scaled = toScaled((neg ? '-' : '') + s, 2)
  return scaled === null ? undefined : scaledToString(scaled, 2)
}

const text = (v: Cell) => (v === null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim() || null)

/** Map, parse and check every data row below the header. */
export function checkRows(rows: Cell[][], headers: string[], headerRow: number, mapping: Mapping, ctx: CheckContext): CheckedLine[] {
  const col = (key: string) => (mapping[key] ? headers.indexOf(mapping[key]) : -1)
  const fields = FIELDS[ctx.kind]
  const seen = new Map<string, number>()
  const out: CheckedLine[] = []
  rows.slice(headerRow).forEach((row, i) => {
    if (row.every((c) => c === null || String(c).trim() === '')) return
    const line_no = headerRow + i + 1
    const raw: Record<string, string> = {}
    headers.forEach((h, j) => {
      const t = text(row[j] ?? null)
      if (t !== null) raw[h] = t
    })
    const issues: Issue[] = []
    const values: Record<string, string | null> = {}
    let lob_id: string | null = null
    for (const f of fields) {
      const j = col(f.key)
      const cell = j >= 0 ? (row[j] ?? null) : null
      let v: string | null | undefined
      switch (f.type) {
        case 'date':
          v = parseDate(cell)
          break
        case 'amount':
          v = parseAmount(cell)
          break
        case 'currency': {
          const t = text(cell)?.toUpperCase() ?? null
          v = t === null ? null : ctx.currencies.has(t) ? t : undefined
          break
        }
        case 'country': {
          const t = text(cell)
          v = t === null ? null : t.length === 2 && /^[a-z]{2}$/i.test(t) ? t.toUpperCase() : (ctx.countries.get(t.toLowerCase()) ?? undefined)
          break
        }
        case 'lob': {
          const t = text(cell)
          if (t === null) v = null
          else {
            const hit = ctx.binder.lobs.find((l) => l.code.toLowerCase() === t.toLowerCase() || l.name.toLowerCase() === t.toLowerCase())
            if (hit) {
              lob_id = hit.id
              v = hit.code
            } else {
              issues.push({ level: 'error', code: 'lobNotInBinder', field: f.key, params: { value: t } })
              v = t
            }
          }
          break
        }
        default:
          v = text(cell)
      }
      if (v === undefined) {
        issues.push({ level: 'error', code: f.type === 'currency' ? 'badCurrency' : f.type === 'country' ? 'badCountry' : 'badValue', field: f.key, params: { value: text(cell) ?? '' } })
        values[f.key] = null
      } else {
        values[f.key] = v
        if (v === null && f.required) issues.push({ level: 'error', code: 'required', field: f.key })
      }
    }
    checkAgainstBinder(values, lob_id, ctx, issues)

    const dup_key = dupKey(ctx.kind, values, ctx.periodStart)
    if (ctx.existing.has(dup_key)) issues.push({ level: 'error', code: 'duplicateEarlier' })
    const firstSeen = seen.get(dup_key)
    if (firstSeen !== undefined) issues.push({ level: 'error', code: 'duplicateInFile', params: { line: firstSeen } })
    else seen.set(dup_key, line_no)

    const status = issues.some((x) => x.level === 'error') ? 'error' : issues.length ? 'warning' : 'ok'
    out.push({ line_no, raw, values, lob_id, dup_key, issues, status })
  })
  return out
}

function checkAgainstBinder(v: Record<string, string | null>, lobId: string | null, ctx: CheckContext, issues: Issue[]) {
  const b = ctx.binder
  const inBinder = (d: string) => d >= b.period_from && d <= b.period_to
  const inPeriod = (d: string) => d >= ctx.periodStart && d <= ctx.periodEnd
  if (ctx.kind !== 'claims' && v.period_from) {
    if (!inBinder(v.period_from)) issues.push({ level: 'error', code: 'outsideBinder', field: 'period_from', params: { date: v.period_from } })
    else if (ctx.kind === 'risk' && !inPeriod(v.period_from)) issues.push({ level: 'warning', code: 'outsidePeriod', field: 'period_from', params: { date: v.period_from } })
  }
  if (ctx.kind === 'claims' && v.date_of_loss) {
    if (!inBinder(v.date_of_loss)) issues.push({ level: 'warning', code: 'lossOutsideBinder', field: 'date_of_loss', params: { date: v.date_of_loss } })
    if (v.date_of_loss > ctx.periodEnd) issues.push({ level: 'warning', code: 'lossAfterPeriod', field: 'date_of_loss', params: { date: v.date_of_loss } })
  }
  if (v.insured_country && b.territories.length && !b.territories.includes(v.insured_country)) {
    issues.push({ level: 'error', code: 'territory', field: 'insured_country', params: { value: v.insured_country } })
  }
  if (v.currency && v.currency !== b.currency) issues.push({ level: 'warning', code: 'otherCurrency', field: 'currency', params: { value: v.currency, binder: b.currency } })
  if (ctx.kind === 'risk' && v.currency === b.currency) {
    const amount = v.limit_100 ?? v.sum_insured_100
    const n = amount === null ? null : Number(amount)
    if (n !== null && b.limit_per_risk !== null && n > b.limit_per_risk) issues.push({ level: 'error', code: 'aboveLimit', field: 'limit_100', params: { limit: b.limit_per_risk } })
    const lobLimit = b.lobs.find((l) => l.id === lobId)?.limit_100 ?? null
    if (n !== null && lobLimit !== null && n > lobLimit) issues.push({ level: 'error', code: 'aboveLobLimit', field: 'limit_100', params: { limit: lobLimit } })
    if (n === null) issues.push({ level: 'warning', code: 'noLimit', field: 'limit_100' })
  }
  if (ctx.kind === 'premium' && v.gross_premium_100 && v.gross_premium_100.startsWith('-')) issues.push({ level: 'warning', code: 'returnPremium', field: 'gross_premium_100' })
  if (ctx.kind === 'claims' && v.paid_100 === null && v.outstanding_100 === null) issues.push({ level: 'warning', code: 'noAmounts' })
}

/** Never the same line twice on one binder: risk by policy + inception, premium by policy + transaction, claims by claim + bordereau month. */
export function dupKey(kind: BordereauKind, v: Record<string, string | null>, periodStart: string): string {
  if (kind === 'risk') return `${v.policy_ref ?? ''}|${v.period_from ?? ''}`
  if (kind === 'premium') return `${v.policy_ref ?? ''}|${v.transaction ?? 'NB'}`
  return `${v.claim_ref ?? ''}|${periodStart}`
}

/** The lines' total (exact): premium = gross premium, risk = limits (or sums insured), claims = paid + outstanding. */
export function linesTotal(kind: BordereauKind, lines: Pick<CheckedLine, 'values'>[]): string {
  let sum = 0n
  for (const l of lines) {
    const v = l.values
    const parts = kind === 'premium' ? [v.gross_premium_100] : kind === 'risk' ? [v.limit_100 ?? v.sum_insured_100] : [v.paid_100, v.outstanding_100]
    for (const p of parts) sum += toScaled(p, 2) ?? 0n
  }
  return scaledToString(sum, 2)
}

/** The payload import_bordereau takes for one line. */
export function toPayload(l: CheckedLine, comment: string | null) {
  const { lob: _lob, transaction: _t, ...v } = l.values
  return {
    line_no: l.line_no,
    dup_key: l.dup_key,
    status: l.status === 'warning' ? 'warning' : 'ok',
    comment: comment?.trim() || null,
    messages: l.issues.map((i) => i.code),
    raw: l.raw,
    lob_id: l.lob_id,
    ...v,
  }
}

/** Calendar month (or quarter) containing a date, as [start, end]. */
export function periodOf(date: string, frequency: 'monthly' | 'quarterly'): [string, string] {
  const [y, m] = date.split('-').map(Number)
  const startMonth = frequency === 'monthly' ? m : Math.floor((m - 1) / 3) * 3 + 1
  const start = new Date(Date.UTC(y, startMonth - 1, 1))
  const end = new Date(Date.UTC(y, startMonth - 1 + (frequency === 'monthly' ? 1 : 3), 0))
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)]
}
