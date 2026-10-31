import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'
import { pickName, pickShortName, type Named, type ShortNamed } from '@/lib/refName'

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

/** The short name of a line of business in the UI language (tables, chips, charts); see pickShortName. */
export function useLocalShortName() {
  const { i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  return (row: ShortNamed | undefined | null) => pickShortName(row, lang)
}

/**
 * Reference names in the UI language, from the cached reference lists: a line
 * of business by id or code, a country or a currency by code. Falls back to
 * the English name (or the given fallback, e.g. a view's `lob_name`) while the
 * lists load or when the RU / UZ name is empty. Views keep their English
 * columns; the screen maps ids and codes here. `lobShort` / `lobShortByCode`
 * give the short name (tables, chips, charts; the full name goes in title=).
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
    const pickShort = (row: ShortNamed | undefined, fallback?: string | null) => (row ? pickShortName(row, lang) : fallback || null)
    const lobRow = (id: string | null | undefined, code?: string | null) => (id ? lobById.get(id) : undefined) ?? (code ? lobByCode.get(code) : undefined)
    return {
      /** A line of business by id (the code as a second key); `fallback` is the view's English name. */
      lob: (id: string | null | undefined, fallback?: string | null, code?: string | null) => pick(lobRow(id, code), fallback),
      lobByCode: (code: string | null | undefined, fallback?: string | null) => pick(lobRow(null, code), fallback),
      /** The short name of a line of business by id (the code as a second key); `fallback` as for `lob`. */
      lobShort: (id: string | null | undefined, fallback?: string | null, code?: string | null) => pickShort(lobRow(id, code), fallback),
      lobShortByCode: (code: string | null | undefined, fallback?: string | null) => pickShort(lobRow(null, code), fallback),
      country: (code: string | null | undefined, fallback?: string | null) => pick(code ? countryByCode.get(code) : undefined, fallback ?? code),
      currency: (code: string | null | undefined) => pick(code ? ccyByCode.get(code) : undefined, code),
    }
  }, [lobs.data, countries.data, currencies.data, lang])
}
