import { quoteValue, type SearchContext } from '@/features/search/query'

/**
 * The register's URL state: the search bar's text (`q`) and the sort. Every
 * filter is part of `q` (src/features/search/query.ts), so a search can be
 * bookmarked or sent to a colleague, and Back / Forward step through searches.
 */
export type RegisterState = { q: string; sort: SortKey; dir: 'asc' | 'desc' }

export const SORT_KEYS = [
  'ref_no', 'received_at', 'insured_name', 'mga_name', 'broker_name', 'lob_name', 'status', 'currency',
  'gross_premium_100', 'share_pct', 'our_gross_premium', 'our_gross_premium_usd', 'underwriter_name', 'next_follow_up_at',
] as const
export type SortKey = (typeof SORT_KEYS)[number]

export function parseRegister(p: URLSearchParams): RegisterState {
  const sort = p.get('sort') as SortKey | null
  return {
    q: p.get('q') ?? '',
    sort: sort && SORT_KEYS.includes(sort) ? sort : 'received_at',
    dir: p.get('dir') === 'asc' ? 'asc' : 'desc',
  }
}

export function registerParams(s: RegisterState): URLSearchParams {
  const p = new URLSearchParams()
  if (s.q) p.set('q', s.q)
  if (s.sort !== 'received_at') p.set('sort', s.sort)
  if (s.dir !== 'desc') p.set('dir', s.dir)
  return p
}

/** The link to the register for a query (dashboard tiles, counterparty pages). */
export function registerLink(q: string, sort?: { sort: SortKey; dir: 'asc' | 'desc' }): string {
  const p = registerParams({ q, sort: sort?.sort ?? 'received_at', dir: sort?.dir ?? 'desc' })
  const s = p.toString()
  return s ? `/submissions?${s}` : '/submissions'
}

const LEGACY = ['status', 'mga', 'broker', 'lob', 'uw', 'ccy', 'from', 'to', 'boundFrom', 'boundTo', 'overdue', 'expired'] as const

export const hasLegacyFilters = (p: URLSearchParams) => LEGACY.some((k) => p.has(k))

/** Old bookmarks (?status=…&mga=<id>&overdue=1) → the same search written in the query language. */
export function legacyToQuery(p: URLSearchParams, ctx: SearchContext): string {
  const parts: string[] = []
  const name = (list: { id: string; name: string }[], id: string | null) => list.find((x) => x.id === id)?.name
  if (p.get('q')) parts.push(p.get('q')!)
  const status = (p.get('status') ?? '').split(',').filter(Boolean)
  if (status.length) parts.push(`status:${status.join('|')}`)
  const mga = name(ctx.counterparties, p.get('mga'))
  if (mga) parts.push(`mga:${quoteValue(mga)}`)
  const broker = p.get('broker') === 'none' ? 'none' : name(ctx.counterparties, p.get('broker'))
  if (broker) parts.push(`broker:${quoteValue(broker)}`)
  const lob = ctx.lobs.find((l) => l.id === p.get('lob'))
  if (lob) parts.push(`lob:${quoteValue(lob.name)}`)
  const uw = name(ctx.users, p.get('uw'))
  if (uw) parts.push(`uw:${quoteValue(uw)}`)
  if (p.get('ccy')) parts.push(`ccy:${p.get('ccy')}`)
  const range = (field: string, from: string | null, to: string | null) => {
    if (from && to) parts.push(`${field}:${from}..${to}`)
    else if (from) parts.push(`${field}>=${from}`)
    else if (to) parts.push(`${field}<=${to}`)
  }
  range('received', p.get('from'), p.get('to'))
  range('bound', p.get('boundFrom'), p.get('boundTo'))
  if (p.get('overdue') === '1') parts.push('overdue')
  if (p.get('expired') === '1') parts.push('expired')
  return parts.join(', ')
}
