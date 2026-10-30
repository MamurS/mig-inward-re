import { describe, expect, it } from 'vitest'
import { parseQuery, type SearchContext } from './query'
import { builderFromQuery, builderToText, emptyBuilder } from './builder'
import { SUBMISSIONS_PAGE } from './pages'

const ctx: SearchContext = {
  today: '2026-10-30',
  userId: 'u1',
  counterparties: [
    { id: 'm1', name: 'Sevil', type: 'mga' },
    { id: 'm3', name: 'Silk Road Underwriting Agency', type: 'mga' },
    { id: 'b1', name: 'Marsh Kazakhstan', type: 'broker' },
  ],
  lobs: [{ id: 'l1', code: 'PROP', name: 'Property', name_ru: 'Имущество', name_uz: 'Mulk' }],
  countries: [{ code: 'UZ', name: 'Uzbekistan', name_ru: 'Узбекистан', name_uz: 'Oʻzbekiston' }],
  currencies: ['USD', 'EUR'],
  users: [{ id: 'u1', name: 'Malika Karimova' }],
}
const page = SUBMISSIONS_PAGE
const from = (text: string) => builderFromQuery(parseQuery(text, ctx, page.scope), page.builder)
const roundTrip = (text: string) => builderToText(from(text), page.scope, page.builder, ctx)

describe('filter builder ⇄ query text', () => {
  it('reads the bar into controls', () => {
    const s = from('evon, status:offered|bound, mga:"Silk Road Underwriting Agency", ccy:USD, premium:100k..500k, received>=2026-10-01, overdue')
    expect(s.text).toBe('evon')
    expect(s.lists.status).toEqual(['offered', 'bound'])
    expect(s.lists.mga).toEqual(['m3'])
    expect(s.lists.ccy).toEqual(['USD'])
    expect(s.ranges.premium).toEqual({ from: '100k', to: '500k' })
    expect(s.ranges.received).toEqual({ from: '2026-10-01', to: '' })
    expect(s.flags.overdue).toBe(true)
    expect(s.kept).toEqual([])
  })
  it('writes controls as the query language, in a fixed order', () => {
    const s = { ...emptyBuilder(), text: 'cargo', lists: { status: ['bound'], mga: ['m3', 'm1'], ccy: ['USD'] }, ranges: { premium: { from: '10k', to: '' }, inception: { from: '2026-01-01', to: '2026-06-30' } }, flags: { expired: true } }
    expect(builderToText(s, page.scope, page.builder, ctx)).toBe(
      'cargo, status:bound, mga:"Silk Road Underwriting Agency"|Sevil, ccy:USD, premium>=10k, inception:2026-01-01..2026-06-30, expired',
    )
  })
  it('round-trips what it can show, and keeps the rest exactly as typed', () => {
    expect(roundTrip('Sevil, property, bound')).toBe('status:bound, mga:Sevil, lob:Property')
    expect(roundTrip('-declined, ref:2026-00, expiry<30d, status:offered')).toBe('status:offered, -declined, ref:2026-00, expiry<30d')
    expect(from('-declined, thismonth').kept).toEqual(['-declined', 'thismonth'])
    expect(roundTrip('premium>100k')).toBe('premium>100k') // open-ended strict comparison: kept as typed
  })
  it('the No response switch is the status value', () => {
    const s = from('noresponse')
    expect(s.lists.status).toEqual(['no_response'])
    expect(builderToText(s, page.scope, page.builder, ctx)).toBe('status:no_response')
  })
  it('a search with OR groups is not shown as controls', () => {
    expect(from('Sevil; bound').orGroups).toBe(true)
  })
  it('what it writes parses back to the same filters', () => {
    const text = roundTrip('bog‘langan, валюта:usd, Silk Road Underwriting Agency, received:2026-01-01..2026-03-31')
    const q = parseQuery(text, ctx, page.scope)
    expect(q.groups[0].terms.map((t) => (t.kind === 'field' ? `${t.field}:${t.values}` : t.kind))).toEqual(['status:bound', 'mga:m3', 'ccy:USD', 'date'])
  })
})
