/**
 * Exact decimal arithmetic for money and shares using BigInt fixed-point.
 * Mirrors Postgres numeric + round(x, 2) (half away from zero) so the live
 * figures in the form match the database view `submissions_v` exactly.
 */

const DECIMAL_RE = /^-?\d+(\.\d+)?$/

/**
 * What a typed number means: a money amount (2 decimals), a percentage
 * (shares, commission), an FX rate, or a whole number (days, limits).
 */
export type NumberKind = 'amount' | 'pct' | 'rate' | 'int'

/** The interface language the typed numbers are read in (set by src/i18n on every language change). */
let inputLanguage = 'en'
export function setNumberInputLanguage(lang: string | null | undefined) {
  inputLanguage = (lang ?? 'en').slice(0, 2).toLowerCase()
}
export const numberInputLanguage = () => inputLanguage

/** Which kind a scale belongs to: 2 → amount, 6 → percent, 10 → FX rate, 0 → whole number. */
export const kindOfScale = (scale: number): NumberKind => (scale === 0 ? 'int' : scale === 2 ? 'amount' : scale === 6 ? 'pct' : 'rate')

const commaGroups = (lang: string) => lang === 'en'
const groupsOk = (parts: string[]) => /^\d{1,3}$/.test(parts[0]) && parts.slice(1).every((p) => /^\d{3}$/.test(p))

/**
 * Read a number the way a person types or pastes it, in any of the three
 * interface languages, into a plain decimal string («1234567.89», «-12.5»).
 * Returns null for empty or unreadable input. No floats are involved.
 *
 * Rules:
 * - Spaces of any kind (incl. U+00A0, U+202F) and apostrophes are thousands
 *   separators and are dropped: «1 234 567,89», «1'234.5».
 * - Both «,» and «.» are accepted as the decimal separator in every language.
 * - Both «,» and «.» present: the LAST one is the decimal separator, the other
 *   one groups thousands («1,234,567.89», «1.234.567,89» → 1234567.89).
 * - The same separator repeated is a thousands separator («1,234,567»,
 *   «1.234.567» → 1234567); the groups must then be of three digits.
 * - A single «,» or «.» is the decimal separator («1,5» → 1.5, «12.5» → 12.5),
 *   with one exception for amounts and whole numbers: in English, where «,»
 *   groups thousands, a single «,» after 1–3 digits (no leading zero) and
 *   followed by exactly three digits is a thousands separator («1,234» → 1234).
 *   In Russian and Uzbek the same «1,234» is 1.234. Percentages and FX rates
 *   always read a single «,» or «.» as decimal.
 * - A leading «-» (or «−», «+») is the sign; percentages may end in «%».
 */
export function parseDecimalInput(input: string, kind: NumberKind = 'amount', lang: string = inputLanguage): string | null {
  let s = input.trim()
  if (kind === 'pct') s = s.replace(/%$/, '')
  s = s.replace(/[\s'’ʼ`]/g, '')
  let neg = false
  if (/^[-−+]/.test(s)) {
    neg = s[0] !== '+'
    s = s.slice(1)
  }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  let int: string
  let frac = ''
  if (hasComma && hasDot) {
    const dec = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.'
    const parts = s.split(dec)
    if (parts.length !== 2 || /[.,]/.test(parts[1])) return null
    const groups = parts[0].split(dec === ',' ? '.' : ',')
    if (!groupsOk(groups)) return null
    int = groups.join('')
    frac = parts[1]
  } else if (hasComma || hasDot) {
    const sep = hasComma ? ',' : '.'
    const parts = s.split(sep)
    if (parts.length > 2) {
      if (!groupsOk(parts)) return null
      int = parts.join('')
    } else {
      const [a, b] = parts
      const thousands = sep === ',' && (kind === 'amount' || kind === 'int') && commaGroups(lang) && /^[1-9]\d{0,2}$/.test(a) && /^\d{3}$/.test(b)
      if (thousands) int = a + b
      else {
        int = a
        frac = b
      }
    }
  } else int = s
  if (int === '' && frac === '') return null
  int = int.replace(/^0+(?=\d)/, '') || '0'
  const out = frac ? `${int}.${frac}` : int
  return neg && /[1-9]/.test(out) ? `-${out}` : out
}

/**
 * A plain decimal string written back in the interface language for the
 * input it came from: «1 234 567,89» (RU/UZ, U+00A0 between thousands),
 * «1,234,567.89» (EN). The decimals are kept exactly as typed. English
 * percentages and rates are not grouped, so «12,650» never reads back as 12.65.
 */
export function formatDecimalInput(value: string, kind: NumberKind = 'amount', lang: string = inputLanguage): string {
  if (!DECIMAL_RE.test(value)) return value
  const neg = value.startsWith('-')
  const [int, frac] = value.replace('-', '').split('.')
  const en = commaGroups(lang)
  const group = en ? (kind === 'amount' || kind === 'int' ? ',' : '') : '\u00a0'
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, group)
  return `${neg ? '-' : ''}${grouped}${frac === undefined ? '' : (en ? '.' : ',') + frac}`
}

/** What an input shows after it loses focus: the parsed number in the interface language, or the text unchanged when it is not a number. */
export function reformatDecimalInput(input: string, kind: NumberKind = 'amount', lang: string = inputLanguage): string {
  const v = parseDecimalInput(input, kind, lang)
  return v === null ? input : formatDecimalInput(v, kind, lang)
}

/**
 * Normalise user input to a plain decimal string (see {@link parseDecimalInput}).
 * Unreadable input comes back without spaces, so {@link isDecimal} rejects it.
 */
export function cleanDecimal(input: string, kind: NumberKind = 'amount'): string {
  return parseDecimalInput(input, kind) ?? input.replace(/\s/g, '')
}

export function isDecimal(input: string, maxScale: number, kind: NumberKind = kindOfScale(maxScale)): boolean {
  const s = cleanDecimal(input, kind)
  if (!DECIMAL_RE.test(s)) return false
  const frac = s.split('.')[1]
  return !frac || frac.length <= maxScale
}

/** Parse to a BigInt scaled by 10^scale (rounds half away from zero if more digits). */
export function toScaled(value: string | number | null | undefined, scale: number): bigint | null {
  if (value === null || value === undefined || value === '') return null
  const s = typeof value === 'number' ? value.toFixed(Math.min(scale + 2, 20)) : cleanDecimal(value, kindOfScale(scale))
  if (!DECIMAL_RE.test(s)) return null
  const neg = s.startsWith('-')
  const [int, frac = ''] = s.replace('-', '').split('.')
  const padded = (frac + '0'.repeat(scale + 1)).slice(0, scale + 1) // one extra digit for rounding
  let n = BigInt(int + padded)
  n = (n + 5n) / 10n
  return neg ? -n : n
}

/** a / b rounded half away from zero. */
export function roundDiv(a: bigint, b: bigint): bigint {
  const neg = a < 0n !== b < 0n
  const absA = a < 0n ? -a : a
  const absB = b < 0n ? -b : b
  const q = (absA * 2n + absB) / (absB * 2n)
  return neg ? -q : q
}

export function scaledToString(v: bigint, scale: number): string {
  const neg = v < 0n
  const s = (neg ? -v : v).toString().padStart(scale + 1, '0')
  const out = scale ? `${s.slice(0, -scale)}.${s.slice(-scale)}` : s
  return neg ? `-${out}` : out
}

const CENTS = 2
const PCT = 6 // numeric(9,6)
const FX = 10 // numeric(20,10)
const PCT_DIV = 100n * 10n ** BigInt(PCT) // percent stored as e.g. 12.5

export type Figures = {
  ourGross: string | null
  commission: string | null
  brokerage: string | null
  deductions: string | null
  ourNet: string | null
  ourSumInsured: string | null
  ourLimit: string | null
  ourGrossUsd: string | null
  ourNetUsd: string | null
}

/** Same formulas as the submissions_v view. All inputs as decimal strings / numbers. */
export function calcFigures(input: {
  grossPremium100: string | number | null | undefined
  sumInsured100?: string | number | null
  limit100?: string | number | null
  sharePct: string | number | null | undefined
  commissionPct: string | number | null | undefined
  brokeragePct: string | number | null | undefined
  fxRateToUsd?: string | number | null
}): Figures {
  const share = toScaled(input.sharePct ?? null, PCT)
  const gp = toScaled(input.grossPremium100 ?? null, CENTS)
  const si = toScaled(input.sumInsured100 ?? null, CENTS)
  const lim = toScaled(input.limit100 ?? null, CENTS)
  const comm = toScaled(input.commissionPct ?? '0', PCT) ?? 0n
  const brok = toScaled(input.brokeragePct ?? '0', PCT) ?? 0n
  const fx = toScaled(input.fxRateToUsd ?? null, FX)

  const ofShare = (v: bigint | null) => (v === null || share === null ? null : roundDiv(v * share, PCT_DIV))
  const ourGross = ofShare(gp)
  const commission = ourGross === null ? null : roundDiv(ourGross * comm, PCT_DIV)
  const brokerage = ourGross === null ? null : roundDiv(ourGross * brok, PCT_DIV)
  const deductions = commission === null || brokerage === null ? null : commission + brokerage
  const ourNet = ourGross === null || deductions === null ? null : ourGross - deductions
  const usd = (v: bigint | null) => (v === null || fx === null ? null : roundDiv(v * fx, 10n ** BigInt(FX)))

  const str = (v: bigint | null) => (v === null ? null : scaledToString(v, CENTS))
  return {
    ourGross: str(ourGross),
    commission: str(commission),
    brokerage: str(brokerage),
    deductions: str(deductions),
    ourNet: str(ourNet),
    ourSumInsured: str(ofShare(si)),
    ourLimit: str(ofShare(lim)),
    ourGrossUsd: str(usd(ourGross)),
    ourNetUsd: str(usd(ourNet)),
  }
}
