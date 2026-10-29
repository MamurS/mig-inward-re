/**
 * Premium schedule maths, shared by the schedule editor's live preview and the
 * offline test mock. Mirrors public.generate_premium_schedule() exactly:
 * money in cents (BigInt), commission and brokerage rounded per row with the
 * rounding difference on the last row, so the preview equals what is saved.
 */
import { roundDiv, scaledToString, toScaled } from '../../lib/decimal'

const PCT_DIV = 100n * 10n ** 6n // percent stored as numeric(9,6), e.g. 12.5

const cents = (v: string | number | null | undefined) => toScaled(v ?? null, 2) ?? 0n
const money = (v: bigint) => scaledToString(v, 2)

/** Adds money values exactly; returns a 2-decimal string. */
export function sumMoney(values: (string | number | null | undefined)[]): string {
  return money(values.reduce<bigint>((s, v) => s + cents(v), 0n))
}

export function subMoney(a: string | number | null | undefined, b: string | number | null | undefined): string {
  return money(cents(a) - cents(b))
}

export function isZeroMoney(v: string | number | null | undefined): boolean {
  return cents(v) === 0n
}

/** Splits `total` into `n` parts of equal cents; the remainder goes to the last part. */
export function splitEqual(total: string | number, n: number): string[] {
  const t = cents(total)
  if (n < 1) return []
  const part = t / BigInt(n)
  return Array.from({ length: n }, (_, i) => money(i < n - 1 ? part : t - part * BigInt(n - 1)))
}

/** Commission and brokerage per row, as the database computes them. */
export function rowDeductions(
  grosses: (string | number)[],
  commissionPct: string | number | null,
  brokeragePct: string | number | null,
): { commission: string; brokerage: string; net: string }[] {
  const comm = toScaled(commissionPct ?? '0', 6) ?? 0n
  const brok = toScaled(brokeragePct ?? '0', 6) ?? 0n
  const gs = grosses.map(cents)
  const total = gs.reduce((s, g) => s + g, 0n)
  const commTotal = roundDiv(total * comm, PCT_DIV)
  const brokTotal = roundDiv(total * brok, PCT_DIV)
  let commSum = 0n
  let brokSum = 0n
  return gs.map((g, i) => {
    const last = i === gs.length - 1
    const c = last ? commTotal - commSum : roundDiv(g * comm, PCT_DIV)
    const b = last ? brokTotal - brokSum : roundDiv(g * brok, PCT_DIV)
    commSum += c
    brokSum += b
    return { commission: money(c), brokerage: money(b), net: money(g - c - b) }
  })
}

/** YYYY-MM-DD plus whole days / months (month ends clamp: 31 Jan + 1 month = 28/29 Feb). */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

/** The database's default first due date: PPW date, else inception (else bound date) + payment terms. */
export function defaultDueDate(s: {
  ppw_date: string | null
  period_from: string | null
  bound_at: string | null
  payment_terms_days: number | null
}): string {
  if (s.ppw_date) return s.ppw_date
  const start = s.period_from ?? (s.bound_at ? s.bound_at.slice(0, 10) : new Date().toISOString().slice(0, 10))
  return addDaysIso(start, s.payment_terms_days ?? 0)
}

export type ScheduleRow = { due_date: string; gross_amount: string }

/** `n` equal installments, `everyMonths` apart, starting on `firstDue`. */
export function equalSchedule(total: string | number, n: number, firstDue: string, everyMonths: number): ScheduleRow[] {
  return splitEqual(total, n).map((gross_amount, i) => ({ due_date: addMonthsIso(firstDue, i * everyMonths), gross_amount }))
}
