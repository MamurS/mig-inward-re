import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/auth/AuthProvider'
import { isoDate } from '@/lib/format'
import { useCounterparties, useCountries, useCurrencies, useLinesOfBusiness, useLocalName, useUsers, userName } from '@/hooks/useReference'
import { parseQuery, type ParsedQuery, type SearchContext, type StatusKey } from './query'
import { toPostgrestFilter } from './postgrest'

/** The reference data the parser resolves names against; null until it has loaded. */
export function useSearchContext(): SearchContext | null {
  const { t } = useTranslation()
  const { session } = useAuth()
  const cps = useCounterparties()
  const lobs = useLinesOfBusiness()
  const countries = useCountries()
  const currencies = useCurrencies()
  const users = useUsers()
  const localName = useLocalName()
  const userId = session?.user.id ?? null
  const today = isoDate()
  return useMemo(() => {
    if (!cps.data || !lobs.data || !countries.data || !currencies.data || !users.data) return null
    return {
      today,
      userId,
      counterparties: cps.data.map((c) => ({ id: c.id, name: c.name, type: c.type })),
      lobs: lobs.data,
      countries: countries.data,
      currencies: currencies.data.map((c) => c.code),
      users: users.data.map((u) => ({ id: u.id, name: userName(u) })),
      statusLabel: (s: StatusKey) => t(`status.${s}`),
      localName,
    }
    // localName follows the language, as t does
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cps.data, lobs.data, countries.data, currencies.data, users.data, userId, today, t])
}

/** Text → parsed query → database filter (null filter = everything). */
export function useParsedQuery(text: string): { ctx: SearchContext | null; parsed: ParsedQuery | null; filter: string | null } {
  const ctx = useSearchContext()
  return useMemo(() => {
    if (!ctx) return { ctx, parsed: null, filter: null }
    const parsed = parseQuery(text, ctx)
    return { ctx, parsed, filter: toPostgrestFilter(parsed, ctx.userId) }
  }, [text, ctx])
}

// ---------------------------------------------------------------------------
// Recent searches — this user's, in this browser
// ---------------------------------------------------------------------------

const MAX_RECENT = 8
const recentKey = (userId: string | null) => `mig.search.recent.${userId ?? 'anon'}`

export function readRecent(userId: string | null): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(recentKey(userId)) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

function writeRecent(userId: string | null, list: string[]) {
  try {
    localStorage.setItem(recentKey(userId), JSON.stringify(list.slice(0, MAX_RECENT)))
  } catch {
    /* storage unavailable: recent searches are a convenience */
  }
}

export function rememberSearch(userId: string | null, text: string) {
  const q = text.trim()
  if (!q) return
  writeRecent(userId, [q, ...readRecent(userId).filter((x) => x !== q)])
}

export function forgetSearch(userId: string | null, text: string) {
  writeRecent(userId, readRecent(userId).filter((x) => x !== text))
}
