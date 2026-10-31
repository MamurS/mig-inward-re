import { useMemo } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/auth/AuthProvider'
import { isoDate } from '@/lib/format'
import { useCounterparties, useCountries, useCurrencies, useLinesOfBusiness, useLocalName, useLocalShortName, useUsers, userName } from '@/hooks/useReference'
import { parseQuery, type ParsedQuery, type SearchContext } from './query'
import { toPostgrestFilter } from './postgrest'
import { pageSearchFor, type PageSearch } from './pages'

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
  const localShortName = useLocalShortName()
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
      users: users.data.map((u) => ({ id: u.id, name: userName(u), role: u.role })),
      t: (key: string) => t(key),
      localName,
      localShortName,
    }
    // localName / localShortName follow the language, as t does
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cps.data, lobs.data, countries.data, currencies.data, users.data, userId, today, t])
}

/** The page search for the current location. */
export function usePageSearch(): { page: PageSearch; here: boolean } {
  const location = useLocation()
  return useMemo(() => pageSearchFor(location.pathname, location.search), [location.pathname, location.search])
}

/** Text → parsed query → database filter (for server-side pages; null filter = everything). */
export function useParsedQuery(text: string, page: PageSearch): { ctx: SearchContext | null; parsed: ParsedQuery | null; filter: string | null } {
  const ctx = useSearchContext()
  return useMemo(() => {
    if (!ctx) return { ctx, parsed: null, filter: null }
    const parsed = parseQuery(text, ctx, page.scope)
    return { ctx, parsed, filter: page.server ? toPostgrestFilter(parsed, page.server, ctx.userId) : null }
  }, [text, ctx, page])
}

// ---------------------------------------------------------------------------
// Recent searches — this user's, per page, in this browser
// ---------------------------------------------------------------------------

const MAX_RECENT = 8
const recentKey = (userId: string | null, scope: string) => `mig.search.recent.${scope === 'submissions' ? '' : `${scope}.`}${userId ?? 'anon'}`

export function readRecent(userId: string | null, scope = 'submissions'): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(recentKey(userId, scope)) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

function writeRecent(userId: string | null, scope: string, list: string[]) {
  try {
    localStorage.setItem(recentKey(userId, scope), JSON.stringify(list.slice(0, MAX_RECENT)))
  } catch {
    /* storage unavailable: recent searches are a convenience */
  }
}

export function rememberSearch(userId: string | null, text: string, scope = 'submissions') {
  const q = text.trim()
  if (!q) return
  writeRecent(userId, scope, [q, ...readRecent(userId, scope).filter((x) => x !== q)])
}

export function forgetSearch(userId: string | null, text: string, scope = 'submissions') {
  writeRecent(userId, scope, readRecent(userId, scope).filter((x) => x !== text))
}

/**
 * A list page's search state: the bar's text from the URL (?q=), parsed with
 * the page's scope, and a setter for chips (× writes the new text back).
 */
export function useListSearch(page: PageSearch) {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const { ctx, parsed, filter } = useParsedQuery(q, page)
  const setQ = (text: string) => {
    // the browser's current params, not this render's (the bar writes them too)
    const next = new URLSearchParams(window.location.search)
    if (text) next.set('q', text)
    else next.delete('q')
    setParams(next)
  }
  return { q, ctx, parsed, filter, setQ }
}
