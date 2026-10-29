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
