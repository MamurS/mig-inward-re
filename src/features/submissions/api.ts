import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { SortKey } from './filters'

export const MAX_ROWS = 5000

/** What the register shows: the search bar's database filter (search/postgrest.ts) and the sort. */
export type RegisterQuery = { filter: string | null; sort: SortKey; dir: 'asc' | 'desc' }

/** The register's query — the table and the Excel export use this same one, so they always agree. */
export function buildSubmissionsQuery(r: RegisterQuery, columns = '*') {
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
