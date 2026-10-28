import type { SubmissionStatus } from '@/lib/status'
import { STATUSES } from '@/lib/status'

/** Register filters, stored in the URL so dashboard tiles and links can pre-filter the register. */
export type SubmissionFilters = {
  q: string
  status: SubmissionStatus[]
  mga: string
  broker: string
  lob: string
  uw: string
  ccy: string
  from: string // received from (YYYY-MM-DD)
  to: string
  boundFrom: string // bound date from
  boundTo: string
  overdue: boolean // follow-up overdue
  expired: boolean // offer validity passed
  sort: SortKey
  dir: 'asc' | 'desc'
}

export const SORT_KEYS = [
  'ref_no', 'received_at', 'insured_name', 'mga_name', 'broker_name', 'lob_name', 'status', 'currency',
  'gross_premium_100', 'share_pct', 'our_gross_premium', 'our_gross_premium_usd', 'underwriter_name', 'next_follow_up_at',
] as const
export type SortKey = (typeof SORT_KEYS)[number]

export const EMPTY_FILTERS: SubmissionFilters = {
  q: '', status: [], mga: '', broker: '', lob: '', uw: '', ccy: '', from: '', to: '', boundFrom: '', boundTo: '',
  overdue: false, expired: false, sort: 'received_at', dir: 'desc',
}

export function parseFilters(p: URLSearchParams): SubmissionFilters {
  const sort = p.get('sort') as SortKey | null
  return {
    q: p.get('q') ?? '',
    status: (p.get('status') ?? '').split(',').filter((s): s is SubmissionStatus => STATUSES.includes(s as SubmissionStatus)),
    mga: p.get('mga') ?? '',
    broker: p.get('broker') ?? '',
    lob: p.get('lob') ?? '',
    uw: p.get('uw') ?? '',
    ccy: p.get('ccy') ?? '',
    from: p.get('from') ?? '',
    to: p.get('to') ?? '',
    boundFrom: p.get('boundFrom') ?? '',
    boundTo: p.get('boundTo') ?? '',
    overdue: p.get('overdue') === '1',
    expired: p.get('expired') === '1',
    sort: sort && SORT_KEYS.includes(sort) ? sort : 'received_at',
    dir: p.get('dir') === 'asc' ? 'asc' : 'desc',
  }
}

export function filtersToParams(f: SubmissionFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.status.length) p.set('status', f.status.join(','))
  for (const k of ['mga', 'broker', 'lob', 'uw', 'ccy', 'from', 'to', 'boundFrom', 'boundTo'] as const) if (f[k]) p.set(k, f[k])
  if (f.overdue) p.set('overdue', '1')
  if (f.expired) p.set('expired', '1')
  if (f.sort !== 'received_at') p.set('sort', f.sort)
  if (f.dir !== 'desc') p.set('dir', f.dir)
  return p
}

export function activeFilterCount(f: SubmissionFilters) {
  return (
    (f.q ? 1 : 0) + (f.status.length ? 1 : 0) +
    (['mga', 'broker', 'lob', 'uw', 'ccy', 'from', 'to', 'boundFrom', 'boundTo'] as const).filter((k) => f[k]).length +
    (f.overdue ? 1 : 0) + (f.expired ? 1 : 0)
  )
}
