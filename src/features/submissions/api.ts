import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Enums } from '@/lib/database.types'
import type { SortKey } from './filters'

export const MAX_ROWS = 5000

/** What the register shows: the search bar's database filter (search/postgrest.ts) and the sort. */
export type RegisterQuery = { filter: string | null; sort: SortKey; dir: 'asc' | 'desc' }

/**
 * Every column of submissions_v except search_text: that one only serves the
 * search filter and is the dearest to build (half the query time at 10,000
 * submissions), so the register never downloads it.
 */
export const LIST_COLUMNS =
  'id, ref_no, received_at, source_party_id, mga_id, broker_id, business_type, insured_name, insured_country, risk_description, lob_id, ' +
  'period_from, period_to, currency, sum_insured_100, limit_100, deductible, gross_premium_100, commission_pct, brokerage_pct, written_share_pct, ' +
  'signed_share_pct, offer_valid_until, payment_terms_days, ppw_date, status, decision_reason, underwriter_id, next_follow_up_at, status_changed_at, ' +
  'offered_at, bound_at, notes, created_at, created_by, updated_at, updated_by, share_pct, fx_rate_to_usd, our_gross_premium, our_sum_insured, ' +
  'our_limit, commission_amount, brokerage_amount, deductions_amount, our_net_premium, gross_premium_100_usd, our_gross_premium_usd, ' +
  'our_net_premium_usd, sum_insured_100_usd, mga_name, broker_name, source_party_name, source_party_type, lob_code, lob_name, underwriter_name, ' +
  'offer_expired, follow_up_overdue, days_since_offered'

/** The register's query — the table and the Excel export use this same one, so they always agree. */
export function buildSubmissionsQuery(r: RegisterQuery, columns = LIST_COLUMNS) {
  let q = supabase.from('submissions_v').select(columns, { count: 'exact' })
  if (r.filter) q = q.or(r.filter)
  return q.order(r.sort, { ascending: r.dir === 'asc', nullsFirst: false }).order('ref_no', { ascending: false }).limit(MAX_ROWS)
}

export function useSubmissionsList(r: RegisterQuery, enabled = true) {
  return useQuery({
    queryKey: ['submissions', 'list', r],
    enabled,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error, count } = await buildSubmissionsQuery(r)
      if (error) throw error
      return { rows: data as unknown as SubmissionRow[], count: count ?? 0 }
    },
  })
}

export type SubmissionRow = import('@/lib/database.types').Tables<'submissions_v'>

export function useSubmission(id: string | undefined) {
  return useQuery({
    queryKey: ['submissions', 'one', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('submissions_v').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useSubmissionHistory(id: string | undefined) {
  return useQuery({
    queryKey: ['submissions', 'history', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('submission_status_history')
        .select('*')
        .eq('submission_id', id!)
        .order('changed_at', { ascending: false })
        .order('id', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useEntityDocuments(entityType: Enums<'entity_type'>, id: string | undefined) {
  return useQuery({
    queryKey: ['documents', entityType, id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', id!)
        .order('uploaded_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useEntityFollowUps(entityType: Enums<'entity_type'>, id: string | undefined) {
  return useQuery({
    queryKey: ['follow_ups', entityType, id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follow_ups')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', id!)
        .order('done_at', { ascending: false, nullsFirst: true })
        .order('due_at', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useAuditLog(table: string, id: string | undefined) {
  return useQuery({
    queryKey: ['audit', table, id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('table_name', table)
        .eq('record_id', id!)
        .order('changed_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data
    },
  })
}
