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

/** Compact USD for tiles / charts: 1.2M */
export function formatCompactUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/** Percent stored as 12.5 → "12.5 %" (up to 6 decimals, trailing zeros dropped). */
export function formatPct(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'string' ? Number(value) : value
  return `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 6 }).format(n)} %`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  return new Intl.DateTimeFormat(locale(), { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale(), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  )
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
