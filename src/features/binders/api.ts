import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Enums, Tables } from '@/lib/database.types'
import type { Mapping } from './validate'

export type BinderRow = Tables<'binders_v'>
export type BinderLob = { lob_id: string; limit_100: number | null; code: string; name: string; name_ru: string | null; name_uz: string | null }
export type BordereauRow = Tables<'bordereaux'>
export type BordereauLine = Tables<'bordereau_lines'>
export type TemplateRow = Tables<'bordereau_templates'>
export type BinderStatus = Enums<'binder_status'>
export type BordereauKind = Enums<'bordereau_kind'>
export type PeriodRow = { period_start: string; period_end: string; kind: BordereauKind; due_date: string; state: 'received' | 'late' | 'missing' | 'upcoming'; bordereau_id: string | null; ref_no: string | null; received_date: string | null }

export const MAX_BINDERS = 1000
export const BORDEREAU_KINDS: BordereauKind[] = ['risk', 'premium', 'claims']

/** The binders register: the search bar's database filter, latest inception first. */
export function useBinders(filter: string | null, enabled = true) {
  return useQuery({
    queryKey: ['binders', 'list', filter],
    enabled,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let q = supabase.from('binders_v').select('*', { count: 'exact' })
      if (filter) q = q.or(filter)
      const { data, error, count } = await q.order('period_from', { ascending: false }).order('binder_ref').limit(MAX_BINDERS)
      if (error) throw error
      return { rows: data as BinderRow[], count: count ?? 0 }
    },
  })
}

/** Every binder the user may see (dashboard, counterparty card, the submission form's picker). */
export function useAllBinders(enabled = true, mgaId?: string) {
  return useQuery({
    queryKey: ['binders', 'all', mgaId ?? ''],
    enabled,
    queryFn: async () => {
      let q = supabase.from('binders_v').select('*')
      if (mgaId) q = q.eq('mga_id', mgaId)
      const { data, error } = await q.order('period_from', { ascending: false }).limit(MAX_BINDERS)
      if (error) throw error
      return data as BinderRow[]
    },
  })
}

export function useBinder(id: string | undefined) {
  return useQuery({
    queryKey: ['binders', 'one', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const [b, l] = await Promise.all([
        supabase.from('binders_v').select('*').eq('id', id!).maybeSingle(),
        supabase.from('binder_lobs').select('lob_id, limit_100, lines_of_business(code, name, name_ru, name_uz)').eq('binder_id', id!),
      ])
      if (b.error) throw b.error
      if (l.error) throw l.error
      type L = { lob_id: string; limit_100: number | null; lines_of_business: { code: string; name: string; name_ru: string | null; name_uz: string | null } | null }
      const lobs: BinderLob[] = ((l.data ?? []) as unknown as L[])
        .map((x) => ({ lob_id: x.lob_id, limit_100: x.limit_100, code: x.lines_of_business?.code ?? '', name: x.lines_of_business?.name ?? '', name_ru: x.lines_of_business?.name_ru ?? null, name_uz: x.lines_of_business?.name_uz ?? null }))
        .sort((a, b2) => a.code.localeCompare(b2.code))
      return b.data ? { binder: b.data as BinderRow, lobs } : null
    },
  })
}

/** Expected bordereaux per period and kind: received, late, missing or upcoming. */
export function useBinderPeriods(id: string | undefined) {
  return useQuery({
    queryKey: ['binders', 'periods', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('binder_periods', { p_binder_id: id! })
      if (error) throw error
      return (data ?? []) as PeriodRow[]
    },
  })
}

export function useBordereaux(binderId: string | undefined) {
  return useQuery({
    queryKey: ['binders', 'bordereaux', binderId],
    enabled: Boolean(binderId),
    queryFn: async () => {
      const { data, error } = await supabase.from('bordereaux').select('*').eq('binder_id', binderId!).order('period_start', { ascending: false }).order('kind')
      if (error) throw error
      return data as BordereauRow[]
    },
  })
}

export function useBordereauLines(bordereauId: string | null) {
  return useQuery({
    queryKey: ['binders', 'lines', bordereauId],
    enabled: Boolean(bordereauId),
    queryFn: async () => {
      const { data, error } = await supabase.from('bordereau_lines').select('*').eq('bordereau_id', bordereauId!).order('line_no').limit(5000)
      if (error) throw error
      return data as BordereauLine[]
    },
  })
}

/** Duplicate keys already imported on this binder for this kind (never imported twice). */
export async function fetchExistingKeys(binderId: string, kind: BordereauKind): Promise<Set<string>> {
  const keys = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('bordereau_lines').select('dup_key').eq('binder_id', binderId).eq('kind', kind).range(from, from + 999)
    if (error) throw error
    for (const r of data ?? []) keys.add(r.dup_key)
    if (!data || data.length < 1000) break
  }
  return keys
}

export function useTemplates(mgaId: string | null | undefined, kind: BordereauKind) {
  return useQuery({
    queryKey: ['binders', 'templates', mgaId, kind],
    enabled: Boolean(mgaId),
    queryFn: async () => {
      const { data, error } = await supabase.from('bordereau_templates').select('*').eq('mga_id', mgaId!).eq('kind', kind).order('updated_at', { ascending: false })
      if (error) throw error
      return data as TemplateRow[]
    },
  })
}

export async function saveTemplate(t: { id?: string; mga_id: string; kind: BordereauKind; name: string; mapping: Mapping; header_row: number; sheet: string | null }) {
  if (t.id) {
    const { error } = await supabase.from('bordereau_templates').update({ name: t.name, mapping: t.mapping, header_row: t.header_row, sheet: t.sheet, updated_at: new Date().toISOString() }).eq('id', t.id)
    if (error) throw error
    return t.id
  }
  const { data, error } = await supabase.from('bordereau_templates').insert({ mga_id: t.mga_id, kind: t.kind, name: t.name, mapping: t.mapping, header_row: t.header_row, sheet: t.sheet }).select('id').single()
  if (error) throw error
  return data.id as string
}

export type BinderInput = {
  binder_ref: string
  mga_id: string
  broker_id: string | null
  underwriter_id: string | null
  period_from: string
  period_to: string
  currency: string
  our_share_pct: string
  commission_pct: string
  brokerage_pct: string
  limit_per_risk: string | null
  aggregate_limit: string | null
  territories: string[]
  bordereau_frequency: Enums<'bordereau_frequency'>
  bordereau_due_days: number
  bordereau_kinds: BordereauKind[]
  status: BinderStatus
  notes: string | null
}

/** Create or update a binder and replace its lines of business. */
export async function saveBinder(id: string | null, b: BinderInput, lobs: { lob_id: string; limit_100: string | null }[]) {
  let binderId = id
  if (id) {
    const { mga_id: _mga, ...patch } = b
    const { error } = await supabase.from('binders').update(patch as never).eq('id', id)
    if (error) throw error
  } else {
    const { data, error } = await supabase.from('binders').insert(b as never).select('id').single()
    if (error) throw error
    binderId = data.id
  }
  const { data: current, error: e1 } = await supabase.from('binder_lobs').select('lob_id').eq('binder_id', binderId!)
  if (e1) throw e1
  const keep = new Set(lobs.map((l) => l.lob_id))
  const gone = (current ?? []).map((r) => r.lob_id).filter((x) => !keep.has(x))
  if (gone.length) {
    const { error } = await supabase.from('binder_lobs').delete().eq('binder_id', binderId!).in('lob_id', gone)
    if (error) throw error
  }
  if (lobs.length) {
    const { error } = await supabase.from('binder_lobs').upsert(lobs.map((l) => ({ binder_id: binderId!, lob_id: l.lob_id, limit_100: l.limit_100 as never })), { onConflict: 'binder_id,lob_id' })
    if (error) throw error
  }
  return binderId!
}

export type ImportHeader = {
  binder_id: string
  kind: BordereauKind
  period_start: string
  period_end: string
  received_date: string
  template_id: string | null
  file_name: string
  stated_total: string | null
  computed_total: string
  totals_comment: string | null
  notes: string | null
}

export async function importBordereau(header: ImportHeader, lines: unknown[], rejected: number) {
  const { data, error } = await supabase.rpc('import_bordereau', { p_bordereau: header as never, p_lines: lines as never, p_rejected: rejected })
  if (error) throw error
  return data as unknown as BordereauRow
}

export function useInvalidateBinders() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['binders'] }),
      qc.invalidateQueries({ queryKey: ['premium'] }),
      qc.invalidateQueries({ queryKey: ['claims'] }),
      qc.invalidateQueries({ queryKey: ['documents'] }),
      qc.invalidateQueries({ queryKey: ['follow_ups'] }),
      qc.invalidateQueries({ queryKey: ['agenda'] }),
      qc.invalidateQueries({ queryKey: ['audit'] }),
      qc.invalidateQueries({ queryKey: ['submissions'] }),
    ])
}
