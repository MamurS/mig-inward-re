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
import { AGENDA, CLAIMS, CLAIMS_SERVER, COUNTERPARTIES, FX, FX_SERVER, RECEIPTS, RECEIPTS_SERVER, RECEIVABLES, RECEIVABLES_SERVER, REFERENCE, SUBMISSIONS, SUBMISSIONS_SERVER, USERS } from './scopes'

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

export const COUNTERPARTIES_PAGE: PageSearch = {
  scope: COUNTERPARTIES,
  path: '/counterparties',
  builder: { items: [{ kind: 'chips', field: 'type' }, { kind: 'multi', field: 'country' }], toggles: [{ flag: 'inactive' }] },
  suggest: ['type', 'country'],
  examples: [
    { q: 'silk', key: 'text' },
    { q: 'type:mga|broker', key: 'type' },
    { q: 'country:UZ', key: 'country' },
    { q: 'broker, -country:UZ', key: 'exclude' },
    { q: 'inactive', key: 'inactive' },
  ],
}

export const AGENDA_PAGE: PageSearch = {
  scope: AGENDA,
  path: '/agenda',
  builder: { items: [{ kind: 'multi', field: 'assignee' }, { kind: 'chips', field: 'type' }, { kind: 'dates', field: 'due' }], toggles: [{ flag: 'overdue' }] },
  suggest: ['type', 'assignee'],
  examples: [
    { q: 'tashkent', key: 'text' },
    { q: 'overdue', key: 'overdue' },
    { q: 'type:premium_overdue', key: 'type' },
    { q: 'due<7d', key: 'due' },
    { q: 'assignee:all', key: 'assignee' },
  ],
}

export const USERS_PAGE: PageSearch = {
  scope: USERS,
  path: '/admin',
  params: { tab: 'users' },
  builder: { items: [{ kind: 'chips', field: 'role' }], toggles: [{ flag: 'active' }, { flag: 'inactive' }] },
  suggest: ['role'],
  examples: [
    { q: 'malika', key: 'text' },
    { q: 'role:underwriter|finance', key: 'role' },
    { q: 'inactive', key: 'inactive' },
  ],
}

export const REFERENCE_PAGE: PageSearch = {
  scope: REFERENCE,
  path: '/admin',
  params: { tab: 'reference' },
  builder: { items: [], toggles: [{ flag: 'active' }, { flag: 'inactive' }] },
  suggest: [],
  examples: [
    { q: 'cargo', key: 'text' },
    { q: 'inactive', key: 'inactive' },
  ],
}

export const FX_PAGE: PageSearch = {
  scope: FX,
  server: FX_SERVER,
  path: '/admin',
  params: { tab: 'fx' },
  builder: { items: [{ kind: 'chips', field: 'ccy' }, { kind: 'dates', field: 'date' }], toggles: [] },
  suggest: ['ccy'],
  examples: [
    { q: 'EUR', key: 'ccy' },
    { q: 'ccy:EUR|UZS, date>=2026-10-01', key: 'dates' },
    { q: 'source:manual', key: 'source' },
  ],
}

export const RECEIPTS_PAGE: PageSearch = {
  scope: RECEIPTS,
  server: RECEIPTS_SERVER,
  path: '/receipts',
  builder: {
    items: [{ kind: 'multi', field: 'payer' }, { kind: 'chips', field: 'ccy' }, { kind: 'dates', field: 'received' }, { kind: 'range', field: 'amount' }],
    toggles: [{ flag: 'unallocated' }, { flag: 'allocated' }],
  },
  suggest: ['payer', 'ccy'],
  examples: [
    { q: 'MT103', key: 'text' },
    { q: 'unallocated', key: 'unallocated' },
    { q: 'payer:"Silk Road", ccy:USD', key: 'payer' },
    { q: 'received>=2026-10-01, amount>10k', key: 'dates' },
    { q: 'RCP-2026-0001', key: 'ref' },
  ],
}

export const RECEIVABLES_PAGE: PageSearch = {
  scope: RECEIVABLES,
  server: RECEIVABLES_SERVER,
  path: '/receivables',
  builder: {
    items: [
      { kind: 'chips', field: 'bucket' },
      { kind: 'multi', field: 'mga' },
      { kind: 'multi', field: 'broker' },
      { kind: 'chips', field: 'ccy' },
      { kind: 'chips', field: 'status' },
      { kind: 'multi', field: 'uw' },
      { kind: 'range', field: 'overdue' },
      { kind: 'dates', field: 'due' },
    ],
    toggles: [{ flag: 'overdue' }, { flag: 'payable' }],
  },
  suggest: ['mga', 'broker', 'bucket', 'ccy'],
  examples: [
    { q: 'tashkent', key: 'text' },
    { q: 'overdue>45', key: 'days' },
    { q: 'bucket:61-90|90+', key: 'bucket' },
    { q: 'mga:"Silk Road", overdue', key: 'mga' },
    { q: 'due<30d', key: 'due' },
    { q: 'payable', key: 'payable' },
  ],
}

export const CLAIMS_PAGE: PageSearch = {
  scope: CLAIMS,
  server: CLAIMS_SERVER,
  path: '/claims',
  builder: {
    items: [
      { kind: 'chips', field: 'status' },
      { kind: 'multi', field: 'mga' },
      { kind: 'multi', field: 'lob' },
      { kind: 'multi', field: 'handler' },
      { kind: 'chips', field: 'ccy' },
      { kind: 'dates', field: 'dol' },
      { kind: 'range', field: 'outstanding' },
    ],
    toggles: [{ flag: 'large' }, { flag: 'cashcall' }, { flag: 'review' }],
  },
  suggest: ['status', 'mga', 'lob', 'handler'],
  examples: [
    { q: 'fire', key: 'text' },
    { q: 'status:open|reopened', key: 'status' },
    { q: 'large', key: 'large' },
    { q: 'cashcall', key: 'cashcall' },
    { q: 'dol:2026-01-01..2026-06-30', key: 'dol' },
    { q: 'outstanding>50k', key: 'outstanding' },
    { q: 'mga:"Silk Road", lob:PROP', key: 'mga' },
  ],
}

export const PAGE_SEARCHES: PageSearch[] = [SUBMISSIONS_PAGE, COUNTERPARTIES_PAGE, AGENDA_PAGE, USERS_PAGE, REFERENCE_PAGE, FX_PAGE, RECEIPTS_PAGE, RECEIVABLES_PAGE, CLAIMS_PAGE]

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
