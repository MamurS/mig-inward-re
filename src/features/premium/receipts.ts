/**
 * Receipt allocation maths, shared by the New receipt form's live preview and
 * the offline test mock. Mirrors the database exactly: an allocation's amount
 * is in the receipt's currency, fx_rate is installment currency per 1 receipt
 * currency (numeric(20,10)), and installment_amount = round(amount × fx_rate, 2)
 * (premium_allocations_before_write).
 */
import { roundDiv, scaledToString, toScaled } from '../../lib/decimal'

const FX = 10
const FX_ONE = 10n ** 10n
const cents = (v: string | number | null | undefined) => toScaled(v ?? null, 2)
const fx = (v: string | number | null | undefined) => toScaled(v ?? null, FX)
const money = (v: bigint) => scaledToString(v, 2)

/** amount (receipt currency) × rate → installment currency, rounded like the database. */
export function convert(amount: string | number, rate: string | number): string | null {
  const a = cents(amount)
  const r = fx(rate)
  if (a === null || r === null) return null
  return money(roundDiv(a * r, FX_ONE))
}

/** The same rate the other way round (receipt currency per 1 installment currency). */
export function inverseRate(rate: string | number): string | null {
  const r = fx(rate)
  if (r === null || r <= 0n) return null
  return trimRate(scaledToString(roundDiv(FX_ONE * FX_ONE, r), FX))
}

/** 0.9205000000 → 0.9205 */
export function trimRate(rate: string): string {
  return rate.includes('.') ? rate.replace(/0+$/, '').replace(/\.$/, '') : rate
}

/** The reference rate from the stored USD rates: `to` per 1 `from`. */
export function referenceRate(from: string, to: string, rateToUsd: (ccy: string) => number | string | null | undefined): string | null {
  if (from === to) return '1'
  const f = fx(from === 'USD' ? 1 : (rateToUsd(from) ?? null))
  const t = fx(to === 'USD' ? 1 : (rateToUsd(to) ?? null))
  if (f === null || t === null || f <= 0n || t <= 0n) return null
  return trimRate(scaledToString(roundDiv(f * FX_ONE, t), FX))
}

export type RateCheck = 'ok' | 'far' | 'inverted'

/**
 * Is an entered rate plausible against the reference? «inverted» when it is
 * close to 1 / reference (the commonest slip), «far» when it is more than 10 %
 * away from the reference. No reference → no opinion.
 */
export function checkRate(entered: string | number, reference: string | null): RateCheck | null {
  const e = Number(entered)
  const r = reference === null ? NaN : Number(reference)
  if (!(e > 0) || !(r > 0)) return null
  const near = (a: number, b: number, tol: number) => Math.abs(a - b) / b <= tol
  if (near(e, r, 0.1)) return 'ok'
  if (Math.abs(r - 1) > 0.05 && near(e, 1 / r, 0.15)) return 'inverted'
  return 'far'
}

/** The largest amount (receipt currency) whose conversion does not exceed `outstanding`. */
export function maxFor(outstanding: string | number, rate: string | number): string | null {
  const o = cents(outstanding)
  const r = fx(rate)
  if (o === null || r === null || r <= 0n || o <= 0n) return null
  let a = roundDiv(o * FX_ONE, r)
  // step down a cent until the rounded conversion fits (the database caps at the outstanding)
  while (a > 0n && roundDiv(a * r, FX_ONE) > o) a -= 1n
  // and up while one more cent still fits exactly
  while (roundDiv((a + 1n) * r, FX_ONE) <= o) a += 1n
  return money(a)
}

export type AllocRow = { id: string; outstanding: string | number; rate: string | null }

/** Oldest first: fills each installment until the receipt is used up. Rows without a rate are skipped. */
export function autoAllocate(receiptAmount: string | number, rows: AllocRow[]): Record<string, string> {
  let left = cents(receiptAmount) ?? 0n
  const out: Record<string, string> = {}
  for (const row of rows) {
    if (left <= 0n || !row.rate) continue
    const max = cents(maxFor(row.outstanding, row.rate) ?? '0') ?? 0n
    const take = max < left ? max : left
    if (take > 0n) {
      out[row.id] = money(take)
      left -= take
    }
  }
  return out
}

/** Sum of money strings (receipt currency). */
export function total(amounts: (string | number | null | undefined)[]): string {
  return money(amounts.reduce<bigint>((s, v) => s + (cents(v) ?? 0n), 0n))
}
