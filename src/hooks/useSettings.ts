import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** All settings (readable by every user; admins change them in Admin › Settings). */
export function useSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('settings').select('*')
      if (error) throw error
      return data
    },
  })
}

/** One number setting, with the database's own fallback while loading or if unset. */
export function useNumberSetting(key: string, fallback: number): number {
  const v = useSettings().data?.find((s) => s.key === key)?.value
  const n = Number(v)
  return v === undefined || v === null || !Number.isFinite(n) ? fallback : n
}
