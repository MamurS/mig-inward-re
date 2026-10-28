import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

const STALE = 5 * 60_000

export function useCurrencies() {
  return useQuery({
    queryKey: ['ref', 'currencies'],
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase.from('currencies').select('*').order('sort_order').order('code')
      if (error) throw error
      return data
    },
  })
}

export function useCountries() {
  return useQuery({
    queryKey: ['ref', 'countries'],
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase.from('countries').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useLinesOfBusiness() {
  return useQuery({
    queryKey: ['ref', 'lob'],
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase.from('lines_of_business').select('*').order('sort_order')
      if (error) throw error
      return data
    },
  })
}

export function useCounterparties() {
  return useQuery({
    queryKey: ['ref', 'counterparties'],
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase.from('counterparties').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

/** All users with a role (for underwriter / assignee pickers and name lookups). */
export function useUsers() {
  return useQuery({
    queryKey: ['ref', 'users'],
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, email, full_name, role, active').order('full_name')
      if (error) throw error
      return data
    },
  })
}

export function userName(u: Pick<Tables<'profiles'>, 'full_name' | 'email'> | undefined | null) {
  return u ? u.full_name || u.email : '—'
}

/** Pick the RU / UZ name of a reference row when available. */
export function useLocalName() {
  const { i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  return (row: { name: string; name_ru?: string | null; name_uz?: string | null } | undefined | null) => {
    if (!row) return '—'
    if (lang === 'ru' && row.name_ru) return row.name_ru
    if (lang === 'uz' && row.name_uz) return row.name_uz
    return row.name
  }
}
