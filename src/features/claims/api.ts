import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Enums, Tables } from '@/lib/database.types'

export type ClaimRow = Tables<'claims_v'>
export type ReserveRow = Tables<'claim_reserves'>
export type PaymentRow = Tables<'claim_payments_v'>
export type RecoveryRow = Tables<'claim_recoveries'>
export type ClaimStatus = Enums<'claim_status'>

export const MAX_CLAIMS = 2000

/** The claims register: the search bar's database filter, newest notification first. */
export function useClaims(filter: string | null, enabled = true) {
  return useQuery({
    queryKey: ['claims', 'list', filter],
    enabled,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let q = supabase.from('claims_v').select('*', { count: 'exact' })
      if (filter) q = q.or(filter)
      const { data, error, count } = await q.order('notified_date', { ascending: false }).order('claim_no', { ascending: false }).limit(MAX_CLAIMS)
      if (error) throw error
      return { rows: data as ClaimRow[], count: count ?? 0 }
    },
  })
}

/** Every claim the user may see (dashboard, counterparty, ratios), paged so totals are complete. */
export function useAllClaims(where?: { column: 'mga_id' | 'broker_id' | 'submission_id'; value: string }, enabled = true) {
  return useQuery({
    queryKey: ['claims', 'all', where?.column ?? '', where?.value ?? ''],
    enabled,
    queryFn: async () => {
      const rows: ClaimRow[] = []
      for (let from = 0; ; from += 1000) {
        let q = supabase.from('claims_v').select('*')
        if (where) q = q.eq(where.column, where.value)
        const { data, error } = await q.order('notified_date').range(from, from + 999)
        if (error) throw error
        rows.push(...((data ?? []) as ClaimRow[]))
        if (!data || data.length < 1000) break
      }
      return rows
    },
  })
}

export function useClaim(id: string | undefined) {
  return useQuery({
    queryKey: ['claims', 'one', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('claims_v').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      return data as ClaimRow | null
    },
  })
}

/** Reserve movements, payments and recoveries of one claim, oldest first. */
export function useClaimMovements(id: string | undefined) {
  return useQuery({
    queryKey: ['claims', 'movements', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const [r, p, rc] = await Promise.all([
        supabase.from('claim_reserves').select('*').eq('claim_id', id!).order('movement_date').order('created_at'),
        supabase.from('claim_payments_v').select('*').eq('claim_id', id!).order('payment_date').order('created_at'),
        supabase.from('claim_recoveries').select('*').eq('claim_id', id!).order('recovery_date').order('created_at'),
      ])
      if (r.error) throw r.error
      if (p.error) throw p.error
      if (rc.error) throw rc.error
      return { reserves: r.data as ReserveRow[], payments: p.data as PaymentRow[], recoveries: rc.data as RecoveryRow[] }
    },
  })
}

/** Payments with USD on the payment date (dashboard: paid this year). */
export function useClaimPayments(sinceDate: string, enabled = true) {
  return useQuery({
    queryKey: ['claims', 'payments-since', sinceDate],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('claim_payments_v').select('id, claim_id, payment_date, amount, currency, amount_usd, mga_id').gte('payment_date', sinceDate)
      if (error) throw error
      return data as Pick<PaymentRow, 'id' | 'claim_id' | 'payment_date' | 'amount' | 'currency' | 'amount_usd' | 'mga_id'>[]
    },
  })
}

/** The coverage check the database runs on save (codes; empty = fine). */
export function useCoverageCheck(submissionId: string | null, dateOfLoss: string, currency: string) {
  return useQuery({
    queryKey: ['claims', 'coverage', submissionId, dateOfLoss, currency],
    enabled: Boolean(submissionId && /^\d{4}-\d{2}-\d{2}$/.test(dateOfLoss) && currency),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('claim_coverage_issues', { p_submission_id: submissionId!, p_date_of_loss: dateOfLoss, p_currency: currency })
      if (error) throw error
      return (data ?? []) as string[]
    },
  })
}

export function useInvalidateClaims() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['claims'] }),
      qc.invalidateQueries({ queryKey: ['premium'] }),
      qc.invalidateQueries({ queryKey: ['audit'] }),
      qc.invalidateQueries({ queryKey: ['follow_ups'] }),
      qc.invalidateQueries({ queryKey: ['agenda'] }),
      qc.invalidateQueries({ queryKey: ['my-overdue'] }),
    ])
}

export type NewClaim = {
  submission_id: string
  notified_date: string
  date_of_loss: string
  currency: string
  estimate_100: string | null
  cause: string | null
  location: string | null
  description: string | null
  cedent_claim_ref: string | null
  handler_id: string | null
  coverage_comment: string | null
  notes: string | null
}

export async function createClaim(c: NewClaim) {
  const { data, error } = await supabase.from('claims').insert(c as never).select('id, claim_no').single()
  if (error) throw error
  return data as { id: string; claim_no: string }
}

export async function addReserve(claimId: string, movementDate: string, amount: string, reason: string) {
  const { error } = await supabase.from('claim_reserves').insert({ claim_id: claimId, movement_date: movementDate, amount: amount as never, reason })
  if (error) throw error
}

export async function addRecovery(claimId: string, r: { recovery_date: string; type: Enums<'claim_recovery_type'>; amount: string; notes: string | null }) {
  const { error } = await supabase.from('claim_recoveries').insert({ claim_id: claimId, ...r, amount: r.amount as never })
  if (error) throw error
}

export async function createClaimPayment(
  p: { claim_id: string; payment_date: string; amount: string; type: Enums<'claim_payment_type'>; payee_id: string | null; method: Enums<'claim_payment_method'>; bank_reference: string | null; notes: string | null },
  allocations: { installment_id: string; amount: string; fx_rate: string | null }[] = [],
) {
  const { data, error } = await supabase.rpc('create_claim_payment', { p_payment: p as never, p_allocations: allocations as never })
  if (error) throw error
  return data
}

export async function changeClaimStatus(id: string, patch: { status: ClaimStatus; decline_reason?: string | null; close_comment?: string | null }) {
  const { error } = await supabase.from('claims').update(patch).eq('id', id)
  if (error) throw error
}

export async function updateClaim(id: string, patch: Partial<Omit<NewClaim, 'submission_id'>>) {
  const { error } = await supabase.from('claims').update(patch as never).eq('id', id)
  if (error) throw error
}

/** Bound risks with our signed net premium (USD) — the written / earned side of the loss ratios. */
export function useRatioRisks(mgaId?: string, enabled = true) {
  return useQuery({
    queryKey: ['claims', 'ratio-risks', mgaId ?? 'all'],
    enabled,
    queryFn: async () => {
      const rows: import('./ratios').RiskLite[] = []
      for (let from = 0; ; from += 1000) {
        let q = supabase.from('submissions_v').select('id, status, period_from, period_to, our_net_premium_usd, mga_id, mga_name, lob_code, lob_name').eq('status', 'bound')
        if (mgaId) q = q.eq('mga_id', mgaId)
        const { data, error } = await q.order('received_at').range(from, from + 999)
        if (error) throw error
        rows.push(...((data ?? []) as import('./ratios').RiskLite[]))
        if (!data || data.length < 1000) break
      }
      return rows
    },
  })
}
