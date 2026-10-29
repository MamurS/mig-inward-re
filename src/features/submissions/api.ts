import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { SubmissionFilters } from './filters'

export const MAX_ROWS = 5000

/** Characters with meaning in PostgREST filter syntax are removed from free-text search. */
export function cleanSearch(q: string) {
  return q.replace(/[,()*%\\:"']/g, ' ').trim()
}

export function buildSubmissionsQuery(f: SubmissionFilters, columns = '*') {
  let q = supabase.from('submissions_v').select(columns, { count: 'exact' })
  const s = cleanSearch(f.q)
  if (s) q = q.or(`ref_no.ilike.*${s}*,insured_name.ilike.*${s}*,risk_description.ilike.*${s}*`)
  if (f.status.length) q = q.in('status', f.status)
  if (f.mga) q = q.eq('mga_id', f.mga)
  if (f.broker) q = f.broker === 'none' ? q.is('broker_id', null) : q.eq('broker_id', f.broker)
  if (f.lob) q = q.eq('lob_id', f.lob)
  if (f.uw) q = q.eq('underwriter_id', f.uw)
  if (f.ccy) q = q.eq('currency', f.ccy)
  if (f.from) q = q.gte('received_at', f.from)
  if (f.to) q = q.lte('received_at', f.to)
  if (f.boundFrom) q = q.gte('bound_at', f.boundFrom)
  if (f.boundTo) q = q.lt('bound_at', `${f.boundTo}T23:59:59.999`)
  if (f.overdue) q = q.eq('follow_up_overdue', true)
  if (f.expired) q = q.eq('offer_expired', true)
  return q.order(f.sort, { ascending: f.dir === 'asc', nullsFirst: false }).order('ref_no', { ascending: false }).limit(MAX_ROWS)
}

export function useSubmissionsList(f: SubmissionFilters) {
  return useQuery({
    queryKey: ['submissions', 'list', f],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error, count } = await buildSubmissionsQuery(f)
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

export function useEntityDocuments(entityType: 'submission', id: string | undefined) {
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

export function useEntityFollowUps(entityType: 'submission', id: string | undefined) {
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
