/**
 * Premium figures for the dashboard, the counterparty page and the
 * Receivables page — one set of rules everywhere:
 * - receivable (what MGAs owe us) and payable (return premium we owe them)
 *   are never added together;
 * - USD totals use each installment's own rate; an installment with no FX
 *   rate yet is left out of the USD totals and counted, so the screen can say so.
 * The rows come through RLS, so demo rows are in only for a user in Demo mode.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { AGING_BUCKETS } from '@/features/search/scopes'
import type { InstallmentRow } from './api'

type Bucket = (typeof AGING_BUCKETS)[number]
const round2 = (n: number) => Math.round(n * 100) / 100

/** Outstanding in USD by ageing bucket (not yet due first); rows without an FX rate are counted apart. */
export function ageing(rows: InstallmentRow[]) {
  const buckets: Record<'current' | Bucket, number> = { current: 0, '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
  let total = 0
  let missingRate = 0
  for (const r of rows) {
    if (r.type === 'return' || !r.outstanding_amount) continue
    if (r.outstanding_usd === null) {
      missingRate++
      continue
    }
    const key = (r.aging_bucket as keyof typeof buckets | null) ?? 'current'
    buckets[key] = round2(buckets[key] + r.outstanding_usd)
    total = round2(total + r.outstanding_usd)
  }
  return { buckets, total, missingRate }
}

export type PremiumRow = Pick<
  InstallmentRow,
  | 'id' | 'submission_id' | 'installment_no' | 'type' | 'due_date' | 'currency' | 'outstanding_amount' | 'outstanding_usd' | 'days_overdue'
  | 'aging_bucket' | 'payable_amount' | 'payable_usd' | 'ref_no' | 'insured_name' | 'mga_id' | 'mga_name' | 'broker_id' | 'broker_name'
>
export type ReceiptLite = { received_date: string | null; amount_usd: number | null }

/** Everything the premium tiles need, from the open installments and this year's receipts. */
export function premiumSummary(rows: PremiumRow[], receipts: ReceiptLite[], today: string) {
  const age = ageing(rows as InstallmentRow[])
  const overdueUsd = round2(age.total - age.buckets.current)
  const overdueRows = rows.filter((r) => r.type !== 'return' && (r.days_overdue ?? 0) > 0 && (r.outstanding_amount ?? 0) > 0)

  // payable stays apart
  const payables = rows.filter((r) => (r.payable_amount ?? 0) > 0)
  const payableUsd = round2(payables.reduce((s, r) => s + (r.payable_usd ?? 0), 0))
  const payableMissingRate = payables.filter((r) => r.payable_usd === null).length

  // top MGAs by overdue (USD)
  const byMga = new Map<string, { id: string; name: string; usd: number; count: number }>()
  for (const r of overdueRows) {
    if (r.outstanding_usd === null || !r.mga_id) continue
    const e = byMga.get(r.mga_id) ?? { id: r.mga_id, name: r.mga_name ?? '—', usd: 0, count: 0 }
    e.usd = round2(e.usd + r.outstanding_usd)
    e.count++
    byMga.set(r.mga_id, e)
  }
  const topMgas = [...byMga.values()].sort((a, b) => b.usd - a.usd).slice(0, 8)

  const mostOverdue = overdueRows.slice().sort((a, b) => (b.days_overdue ?? 0) - (a.days_overdue ?? 0) || a.due_date!.localeCompare(b.due_date!)).slice(0, 10)

  // cash received (USD) this month / this year
  const month = today.slice(0, 7)
  const year = today.slice(0, 4)
  let receivedMonthUsd = 0
  let receivedYearUsd = 0
  let receiptsMissingRate = 0
  for (const r of receipts) {
    if (!r.received_date?.startsWith(year)) continue
    if (r.amount_usd === null) {
      receiptsMissingRate++
      continue
    }
    receivedYearUsd = round2(receivedYearUsd + r.amount_usd)
    if (r.received_date.startsWith(month)) receivedMonthUsd = round2(receivedMonthUsd + r.amount_usd)
  }

  return {
    outstandingUsd: age.total,
    notDueUsd: age.buckets.current,
    overdueUsd,
    overdueCount: overdueRows.length,
    buckets: age.buckets,
    missingRate: age.missingRate,
    payableUsd,
    payableCount: payables.length,
    payableMissingRate,
    topMgas,
    mostOverdue,
    receivedMonthUsd,
    receivedYearUsd,
    receiptsMissingRate,
  }
}

const COLUMNS =
  'id, submission_id, installment_no, type, due_date, currency, outstanding_amount, outstanding_usd, days_overdue, aging_bucket, payable_amount, payable_usd, ref_no, insured_name, mga_id, mga_name, broker_id, broker_name'

/**
 * Open receivables and payables (optionally one counterparty's) plus this
 * year's receipts, paged so the totals are always complete.
 */
export function usePremiumOverview(party?: { id: string; type: string } | null, enabled = true) {
  return useQuery({
    queryKey: ['premium', 'overview', party?.id ?? 'all'],
    enabled,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const rows: PremiumRow[] = []
      for (let from = 0; ; from += 1000) {
        let q = supabase.from('premium_installments_v').select(COLUMNS).or('outstanding_amount.gt.0,payable_amount.gt.0')
        if (party) q = party.type === 'broker' ? q.eq('broker_id', party.id) : q.eq('mga_id', party.id)
        const { data, error } = await q.order('due_date').range(from, from + 999)
        if (error) throw error
        rows.push(...((data ?? []) as PremiumRow[]))
        if (!data || data.length < 1000) break
      }
      const yearStart = `${new Date().getFullYear()}-01-01`
      const receipts: ReceiptLite[] = []
      for (let from = 0; ; from += 1000) {
        let q = supabase.from('premium_receipts_v').select('received_date, amount_usd').gte('received_date', yearStart)
        if (party) q = q.eq('payer_id', party.id)
        const { data, error } = await q.order('received_date').range(from, from + 999)
        if (error) throw error
        receipts.push(...((data ?? []) as ReceiptLite[]))
        if (!data || data.length < 1000) break
      }
      return { rows, receipts }
    },
  })
}
