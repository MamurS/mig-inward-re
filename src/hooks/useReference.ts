import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'
import { pickName, type Named } from '@/lib/refName'

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
  return (row: Named | undefined | null) => pickName(row, lang)
}

/**
 * Reference names in the UI language, from the cached reference lists: a line
 * of business by id or code, a country or a currency by code. Falls back to
 * the English name (or the given fallback, e.g. a view's `lob_name`) while the
 * lists load or when the RU / UZ name is empty. Views keep their English
 * columns; the screen maps ids and codes here.
 */
export function useRefNames() {
  const lobs = useLinesOfBusiness()
  const countries = useCountries()
  const currencies = useCurrencies()
  const { i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  return useMemo(() => {
    const lobById = new Map((lobs.data ?? []).map((l) => [l.id, l]))
    const lobByCode = new Map((lobs.data ?? []).map((l) => [l.code, l]))
    const countryByCode = new Map((countries.data ?? []).map((c) => [c.code, c]))
    const ccyByCode = new Map((currencies.data ?? []).map((c) => [c.code, c]))
    const pick = (row: Named | undefined, fallback?: string | null) => (row ? pickName(row, lang) : fallback || null)
    return {
      /** A line of business by id (the code as a second key); `fallback` is the view's English name. */
      lob: (id: string | null | undefined, fallback?: string | null, code?: string | null) =>
        pick((id ? lobById.get(id) : undefined) ?? (code ? lobByCode.get(code) : undefined), fallback),
      lobByCode: (code: string | null | undefined, fallback?: string | null) => pick(code ? lobByCode.get(code) : undefined, fallback),
      country: (code: string | null | undefined, fallback?: string | null) => pick(code ? countryByCode.get(code) : undefined, fallback ?? code),
      currency: (code: string | null | undefined) => pick(code ? ccyByCode.get(code) : undefined, code),
    }
  }, [lobs.data, countries.data, currencies.data, lang])
}
