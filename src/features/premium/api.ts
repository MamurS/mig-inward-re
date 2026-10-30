import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import type { Tables } from '@/lib/database.types'
import type { ScheduleRow } from './schedule'

export type InstallmentRow = Tables<'premium_installments_v'>
export type ScheduleCheck = Tables<'premium_schedule_check_v'>
export type AllocationRow = Tables<'premium_allocations'> & {
  premium_receipts: Pick<Tables<'premium_receipts'>, 'ref_no' | 'received_date' | 'currency' | 'bank_reference'> | null
}

export function usePremiumInstallments(submissionId: string | undefined) {
  return useQuery({
    queryKey: ['premium', 'installments', submissionId],
    enabled: Boolean(submissionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('premium_installments_v')
        .select('*')
        .eq('submission_id', submissionId!)
        .order('installment_no', { ascending: true })
      if (error) throw error
      return data as InstallmentRow[]
    },
  })
}

export function useScheduleCheck(submissionId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['premium', 'check', submissionId],
    enabled: Boolean(submissionId) && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('premium_schedule_check_v').select('*').eq('submission_id', submissionId!).maybeSingle()
      if (error) throw error
      return data as ScheduleCheck | null
    },
  })
}

/** Receipts allocated to the given installments, newest first. */
export function useInstallmentAllocations(installmentIds: string[]) {
  return useQuery({
    queryKey: ['premium', 'allocations', installmentIds],
    enabled: installmentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('premium_allocations')
        .select('*, premium_receipts(ref_no, received_date, currency, bank_reference)')
        .in('installment_id', installmentIds)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as AllocationRow[]
    },
  })
}

export function useInvalidatePremium() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['premium'] }),
      qc.invalidateQueries({ queryKey: ['audit'] }),
      qc.invalidateQueries({ queryKey: ['follow_ups'] }),
      qc.invalidateQueries({ queryKey: ['agenda'] }),
    ])
}

export async function generateSchedule(submissionId: string, rows: ScheduleRow[] | null) {
  const { error } = await supabase.rpc('generate_premium_schedule', { p_submission_id: submissionId, p_installments: rows ?? undefined })
  if (error) throw error
}

/**
 * Who may change a submission's schedule — mirrors can_edit_premium_schedule():
 * finance, admin, or the submission's own underwriter.
 */
export function useCanEditSchedule() {
  const { role, profile } = useAuth()
  return (underwriterId: string | null | undefined) =>
    role === 'admin' || role === 'finance' || (role === 'underwriter' && Boolean(profile?.id) && underwriterId === profile?.id)
}

// ---------------------------------------------------------------------------
// Receipts (step 3)
// ---------------------------------------------------------------------------

export type ReceiptRow = Tables<'premium_receipts_v'>
export const MAX_RECEIPTS = 2000

/** The receipts register: the search bar's database filter, newest first. */
export function useReceipts(filter: string | null, enabled = true) {
  return useQuery({
    queryKey: ['premium', 'receipts', filter],
    enabled,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let q = supabase.from('premium_receipts_v').select('*', { count: 'exact' })
      if (filter) q = q.or(filter)
      const { data, error, count } = await q.order('received_date', { ascending: false }).order('ref_no', { ascending: false }).limit(MAX_RECEIPTS)
      if (error) throw error
      return { rows: data as ReceiptRow[], count: count ?? 0 }
    },
  })
}

/** One receipt's allocations, with the installment and submission each one pays. */
export function useReceiptAllocations(receiptId: string | null) {
  return useQuery({
    queryKey: ['premium', 'receipt-allocations', receiptId],
    enabled: Boolean(receiptId),
    queryFn: async () => {
      const { data, error } = await supabase.from('premium_allocations').select('*').eq('receipt_id', receiptId!).order('created_at')
      if (error) throw error
      const allocations = data as Tables<'premium_allocations'>[]
      const ids = allocations.map((a) => a.installment_id)
      const inst = ids.length ? await supabase.from('premium_installments_v').select('*').in('id', ids) : { data: [], error: null }
      if (inst.error) throw inst.error
      const byId = new Map((inst.data as InstallmentRow[]).map((i) => [i.id, i]))
      return allocations.map((a) => ({ ...a, installment: byId.get(a.installment_id) ?? null }))
    },
  })
}

/** Installments that can still take money: receivable, not paid or written off — oldest due first. */
export function useOpenInstallments(enabled = true) {
  return useQuery({
    queryKey: ['premium', 'open-installments'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('premium_installments_v')
        .select('*')
        .neq('type', 'return')
        .in('status', ['open', 'partially_paid'])
        .gt('outstanding_amount', 0)
        .order('due_date', { ascending: true })
        .limit(2000)
      if (error) throw error
      return data as InstallmentRow[]
    },
  })
}

/** USD rates on a date for the given currencies (for the reference cross rate). */
export function useUsdRates(currencies: string[], date: string) {
  const list = [...new Set(currencies.filter((c) => c && c !== 'USD'))].sort()
  return useQuery({
    queryKey: ['fx', 'usd', list, date],
    enabled: list.length > 0 && Boolean(date),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const out: Record<string, number | null> = { USD: 1 }
      for (const c of list) {
        const { data, error } = await supabase.rpc('fx_rate_to_usd', { p_currency: c, p_date: date })
        if (error) throw error
        out[c] = (data as number | null) ?? null
      }
      return out
    },
  })
}

export type NewAllocation = { installment_id: string; amount: string; fx_rate: string | null }

/** Records a receipt and its allocations in one transaction (create_premium_receipt). */
export async function createReceipt(
  receipt: { received_date: string; payer_id: string; currency: string; amount: string; bank_reference: string; notes: string },
  allocations: NewAllocation[],
) {
  const { data, error } = await supabase.rpc('create_premium_receipt', { p_receipt: receipt, p_allocations: allocations })
  if (error) throw error
  return data as unknown as Tables<'premium_receipts'>
}

/** Allocates more of an existing receipt (one insert: all or nothing). */
export async function addAllocations(receiptId: string, allocations: NewAllocation[]) {
  // installment_amount is set by the trigger (amount × fx_rate); amounts go as exact decimal strings
  const { error } = await supabase.from('premium_allocations').insert(allocations.map((a) => ({ receipt_id: receiptId, ...a })) as never)
  if (error) throw error
}

export async function removeAllocation(id: string) {
  const { error } = await supabase.from('premium_allocations').delete().eq('id', id)
  if (error) throw error
}
