import i18n from '@/i18n'

const LOCALES: Record<string, string> = { en: 'en-GB', ru: 'ru-RU', uz: 'uz-Latn-UZ' }

export function locale() {
  return LOCALES[i18n.resolvedLanguage ?? 'en'] ?? 'en-GB'
}

/*
 * Uzbek numbers are written the Russian way: a space between thousands and a
 * decimal comma («1 234,38», «83,01 ming»). Browsers ship uneven Uzbek number
 * data (some fall back to «1,234.38» / «83.01K»), so the separators come from
 * ru-RU and the scale words below are spelled out here.
 */
const numberLocaleOf = (loc: string) => (loc.startsWith('uz') ? 'ru-RU' : loc)
const UZ_SCALES = ['ming', 'mln', 'mlrd', 'trln']

/** Any figure in the interface language's number format (Uzbek as Russian). */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(numberLocaleOf(locale()), options).format(value)
}

/** 1 234 567.89 style, always 2 decimals. Accepts DB numbers or exact decimal strings. */
export function formatAmount(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return '—'
  return formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
 * Uzbek: «83,01 ming», «1,25 mln», «2,50 mlrd».
 */
export function compactNumber(value: number, loc: string): string {
  // 999.996 rounds up to «1,00 тыс.»: it is scaled too
  const scaled = Math.abs(value) >= 999.995
  if (loc.startsWith('uz')) return compactUz(value, scaled)
  return new Intl.NumberFormat(loc, { notation: 'compact', minimumFractionDigits: scaled ? 2 : 0, maximumFractionDigits: 2 }).format(value)
}

function compactUz(value: number, scaled: boolean): string {
  const nf = (min: number) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: min, maximumFractionDigits: 2 })
  if (!scaled) return nf(0).format(value)
  let step = 0
  let n = value / 1000
  // 999 995 → «1,00 mln», not «1 000,00 ming»
  while (step < UZ_SCALES.length - 1 && Math.abs(n) >= 999.995) {
    n /= 1000
    step++
  }
  return `${nf(2).format(n)}\u00a0${UZ_SCALES[step]}`
}

/** {@link compactNumber} in the interface language. */
export function formatHuman(value: number): string {
  return compactNumber(value, locale())
}

/** Percent stored as 12.5 → "12.5 %" (up to 6 decimals, trailing zeros dropped). */
export function formatPct(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'string' ? Number(value) : value
  return `${formatNumber(n, { maximumFractionDigits: 6 })} %`
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

/*
 * The app's date field (src/components/ui/date-input.tsx) shows and takes dates
 * the way the UI language writes them: 31.12.2027 in RU / UZ, 31/12/2027 in EN.
 * The stored value stays ISO (YYYY-MM-DD).
 */
const dateSep = () => (locale().startsWith('en') ? '/' : '.')

/** ISO → «31.12.2027» / «31/12/2027»; '' when empty or not a date. */
export function formatDateInput(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  return m ? [m[3], m[2], m[1]].join(dateSep()) : ''
}

/**
 * What a person typed → ISO, or null when it is not a real date. Day first in
 * every language (31.12.2027, 31/12/2027, 31-12-2027, two-digit years as 20xx);
 * ISO (2027-12-31) is taken as well.
 */
export function parseDateInput(text: string): string | null {
  const s = text.trim()
  let y: number, mo: number, d: number
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  const dmy = /^(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{4}|\d{2})$/.exec(s)
  if (iso) [y, mo, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])]
  else if (dmy) [d, mo, y] = [Number(dmy[1]), Number(dmy[2]), dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3])]
  else return null
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return null
  const dt = new Date(y, mo - 1, d)
  if (dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return isoDate(dt)
}

/** «October 2026», «Октябрь 2026», «Oktabr 2026» — a calendar's heading. */
export function formatMonthYear(year: number, monthIndex: number): string {
  if (isUz()) return `${UZ_MONTHS[monthIndex].charAt(0).toUpperCase()}${UZ_MONTHS[monthIndex].slice(1)} ${year}`
  const s = new Intl.DateTimeFormat(locale(), { month: 'long' }).format(new Date(year, monthIndex, 1))
  return `${s.charAt(0).toUpperCase()}${s.slice(1)} ${year}`
}

/** Short weekday names, Monday first: «Mo» … «Su», «Пн» … «Вс», «Du» … «Ya». */
export function weekdaysShort(): string[] {
  if (isUz()) return ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya']
  const f = new Intl.DateTimeFormat(locale(), { weekday: 'short' })
  // 2024-01-01 was a Monday
  return Array.from({ length: 7 }, (_, i) => {
    const s = f.format(new Date(2024, 0, 1 + i)).replace('.', '')
    return s.charAt(0).toUpperCase() + s.slice(1, 2)
  })
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
