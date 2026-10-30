/**
 * Demo mode (profiles.ui_demo_mode). The database does the hiding: a
 * restrictive RLS policy shows a user only the rows of their own world
 * (is_demo = demo_mode()), so lists, search, dashboard totals and exports
 * follow by themselves. Switching drops every cached query, so nothing of the
 * other world stays on screen.
 */
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthProvider'
import { supabase } from '@/lib/supabase'

export function useDemoMode() {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const on = Boolean(profile?.ui_demo_mode)

  async function set(next: boolean) {
    if (!profile) return
    const { error } = await supabase.from('profiles').update({ ui_demo_mode: next }).eq('id', profile.id)
    if (error) throw error
    qc.setQueryData(['profile', profile.id], { ...profile, ui_demo_mode: next })
    await qc.resetQueries({ predicate: (q) => q.queryKey[0] !== 'profile' })
  }

  return { on, set }
}
