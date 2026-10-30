import { describe, expect, it } from 'vitest'
import { parseQuery, type SearchContext } from '@/features/search/query'
import { RECEIVABLES } from '@/features/search/scopes'
import { receivablesBase } from './ReceivablesPage'
import { ageing } from './summary'
import type { InstallmentRow } from './api'

const row = (r: Partial<InstallmentRow>) => ({ type: 'original', outstanding_amount: 100, outstanding_usd: 100, aging_bucket: null, ...r }) as InstallmentRow
const ctx: SearchContext = { today: '2026-10-30', userId: null, counterparties: [], lobs: [], countries: [], currencies: ['USD'], users: [] }

describe('receivables', () => {
  it('ageing sums outstanding USD by bucket; return premium and paid rows stay out; no rate is counted apart', () => {
    const a = ageing([
      row({ aging_bucket: null, outstanding_usd: 10.1 }),
      row({ aging_bucket: '0-30', outstanding_usd: 20.2 }),
      row({ aging_bucket: '0-30', outstanding_usd: 0.1 }),
      row({ aging_bucket: '90+', outstanding_usd: 5 }),
      row({ aging_bucket: '61-90', outstanding_usd: null }),
      row({ type: 'return', outstanding_amount: 0, outstanding_usd: 0 }),
      row({ outstanding_amount: 0, outstanding_usd: 0 }),
    ])
    expect(a.buckets).toEqual({ current: 10.1, '0-30': 20.3, '31-60': 0, '61-90': 0, '90+': 5 })
    expect(a.total).toBe(35.4)
    expect(a.missingRate).toBe(1)
  })

  it('what a query looks at: open by default, any receivable with a status, return premium with payable', () => {
    const base = (text: string) => receivablesBase(parseQuery(text, ctx, RECEIVABLES))
    expect(base('')).toBe('open')
    expect(base('overdue>45')).toBe('open')
    expect(base('status:paid')).toBe('receivable')
    expect(base('payable')).toBe(null)
    expect(base('-payable')).toBe('open')
  })
})
