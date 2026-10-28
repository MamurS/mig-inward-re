/**
 * Exact decimal arithmetic for money and shares using BigInt fixed-point.
 * Mirrors Postgres numeric + round(x, 2) (half away from zero) so the live
 * figures in the form match the database view `submissions_v` exactly.
 */

const DECIMAL_RE = /^-?\d+(\.\d+)?$/

/** Normalise user input: drop spaces / thin spaces / thousands commas. */
export function cleanDecimal(input: string): string {
  return input.replace(/[\s  ,]/g, '')
}

export function isDecimal(input: string, maxScale: number): boolean {
  const s = cleanDecimal(input)
  if (!DECIMAL_RE.test(s)) return false
  const frac = s.split('.')[1]
  return !frac || frac.length <= maxScale
}

/** Parse to a BigInt scaled by 10^scale (rounds half away from zero if more digits). */
export function toScaled(value: string | number | null | undefined, scale: number): bigint | null {
  if (value === null || value === undefined || value === '') return null
  const s = typeof value === 'number' ? value.toFixed(Math.min(scale + 2, 20)) : cleanDecimal(value)
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
