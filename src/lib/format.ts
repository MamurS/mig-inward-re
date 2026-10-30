import i18n from '@/i18n'

const LOCALES: Record<string, string> = { en: 'en-GB', ru: 'ru-RU', uz: 'uz-Latn-UZ' }

export function locale() {
  return LOCALES[i18n.resolvedLanguage ?? 'en'] ?? 'en-GB'
}

/** 1 234 567.89 style, always 2 decimals. Accepts DB numbers or exact decimal strings. */
export function formatAmount(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export function formatMoney(value: number | string | null | undefined, currency?: string | null): string {
  const s = formatAmount(value)
  return s === '—' || !currency ? s : `${s} ${currency}`
}

/**
 * Human scale for tiles, charts and summaries: 12 000 → «12,00 тыс.»,
 * 1 250 000 → «1,25 млн» («12.00K», «1.25M» in English). Scaled figures always
 * carry two decimals, so neighbours line up («12,00 тыс.» next to «83,01 тыс.»);
 * figures under a thousand are already human and keep up to two decimals.
 */
export function compactNumber(value: number, loc: string): string {
  // 999.996 rounds up to «1,00 тыс.»: it is scaled too
  const scaled = Math.abs(value) >= 999.995
  return new Intl.NumberFormat(loc, { notation: 'compact', minimumFractionDigits: scaled ? 2 : 0, maximumFractionDigits: 2 }).format(value)
}

/** {@link compactNumber} in the interface language. */
export function formatHuman(value: number): string {
  return compactNumber(value, locale())
}

/** Percent stored as 12.5 → "12.5 %" (up to 6 decimals, trailing zeros dropped). */
export function formatPct(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'string' ? Number(value) : value
  return `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 6 }).format(n)} %`
}

/*
 * Uzbek (Latin) dates are written out here instead of left to Intl: browsers
 * ship uneven Uzbek data, and some fall back to «2026 M02 21». The pattern
 * matches CLDR: «21-fev, 2026», «shanba, 21-fevral».
 */
const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
const UZ_MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek']
const UZ_WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba']
const isUz = () => locale().startsWith('uz')
const pad = (n: number) => String(n).padStart(2, '0')

function toDate(value: string) {
  return value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = toDate(value)
  if (isUz()) return `${pad(d.getDate())}-${UZ_MONTHS_SHORT[d.getMonth()]}, ${d.getFullYear()}`
  return new Intl.DateTimeFormat(locale(), { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isUz()) return `${formatDate(value)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
  return new Intl.DateTimeFormat(locale(), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)
}

/** «Jan», «янв.», «Yan» — chart axes. */
export function formatMonthShort(year: number, monthIndex: number): string {
  if (isUz()) {
    const m = UZ_MONTHS_SHORT[monthIndex]
    return m.charAt(0).toUpperCase() + m.slice(1)
  }
  return new Intl.DateTimeFormat(locale(), { month: 'short' }).format(new Date(year, monthIndex, 1))
}

/** «Thursday, 29 October 2026» (with `year`) — greetings and the login screen. */
export function formatLongDate(d: Date = new Date(), withYear = false): string {
  if (isUz()) return `${UZ_WEEKDAYS[d.getDay()]}, ${d.getDate()}-${UZ_MONTHS[d.getMonth()]}${withYear ? `, ${d.getFullYear()}` : ''}`
  return new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}) }).format(d)
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`
}

/** YYYY-MM-DD for <input type="date"> in local time */
export function isoDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

/** An Excel column width (characters) that fits every value: never narrower than `min`. */
export function fitWidth(values: (string | null | undefined)[], min = 12, max = 60): number {
  return Math.min(max, Math.max(min, ...values.map((v) => (v ?? '').length + 2)))
}
