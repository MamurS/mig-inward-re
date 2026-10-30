/**
 * Which search the top bar runs on which page: the scope (fields, words),
 * where its rows are filtered (server spec or none = in the browser), the
 * placeholder, the filter builder's controls and the help examples. A page
 * without a list of its own (dashboard, a record, a form) searches
 * submissions: Enter opens the register.
 */
import type { BuilderSpec } from './builder'
import type { Scope } from './query'
import type { ServerSpec } from './postgrest'
import { SUBMISSIONS, SUBMISSIONS_SERVER } from './scopes'

export type PageSearch = {
  scope: Scope
  server?: ServerSpec
  /** the list page this search filters */
  path: string
  /** extra URL params that select this list on its page (an admin tab) */
  params?: Record<string, string>
  /** i18n keys under search.page.<id>: placeholder, label, help examples */
  builder: BuilderSpec
  /** quick suggestions while typing a bare word: these list fields */
  suggest: string[]
  /** direct hits (open a record) — the register only */
  records?: boolean
  /** help popover: example queries; descriptions at search.help.<scope>.<key> */
  examples: { q: string; key: string }[]
}

export const SUBMISSIONS_PAGE: PageSearch = {
  scope: SUBMISSIONS,
  server: SUBMISSIONS_SERVER,
  path: '/submissions',
  builder: {
    items: [
      { kind: 'chips', field: 'status' },
      { kind: 'multi', field: 'mga' },
      { kind: 'multi', field: 'broker' },
      { kind: 'multi', field: 'lob' },
      { kind: 'multi', field: 'country' },
      { kind: 'chips', field: 'ccy' },
      { kind: 'multi', field: 'uw' },
      { kind: 'chips', field: 'type' },
      { kind: 'range', field: 'premium' },
      { kind: 'dates', field: 'received' },
      { kind: 'dates', field: 'inception' },
      { kind: 'dates', field: 'expiry' },
    ],
    toggles: [{ flag: 'overdue' }, { flag: 'expired' }, { field: 'status', value: 'no_response', labelKey: 'status.no_response' }],
  },
  suggest: ['status', 'mga', 'broker', 'lob', 'ccy'],
  records: true,
  examples: [
    { q: 'evon', key: 'text' },
    { q: '"Yigit Agro"', key: 'phrase' },
    { q: 'Sevil, property, bound', key: 'and' },
    { q: 'Sevil, bound; IUC, offered', key: 'or' },
    { q: 'status:offered|bound', key: 'pipe' },
    { q: '-declined', key: 'exclude' },
    { q: 'mga:Sevil, ccy:USD', key: 'fields' },
    { q: 'premium>100k, share>=10', key: 'numbers' },
    { q: 'received>=2026-10-01', key: 'dates' },
    { q: 'expiry<30d', key: 'within' },
    { q: 'overdue, mine', key: 'keywords' },
  ],
}

export const PAGE_SEARCHES: PageSearch[] = [SUBMISSIONS_PAGE]

/** The search for this location: the page's own list, or (here: false) the register. */
export function pageSearchFor(pathname: string, search: string): { page: PageSearch; here: boolean } {
  const params = new URLSearchParams(search)
  const hit = PAGE_SEARCHES.find((p) => p.path === pathname && Object.entries(p.params ?? {}).every(([k, v]) => (params.get(k) ?? v) === v))
  return hit ? { page: hit, here: true } : { page: SUBMISSIONS_PAGE, here: false }
}

/** The link to a page's list with a query. */
export function pageLink(page: PageSearch, q: string, extra?: Record<string, string>): string {
  const p = new URLSearchParams({ ...(page.params ?? {}), ...(extra ?? {}) })
  if (q) p.set('q', q)
  const s = p.toString()
  return s ? `${page.path}?${s}` : page.path
}
