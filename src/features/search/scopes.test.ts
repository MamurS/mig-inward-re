import { describe, expect, it } from 'vitest'
import { norm } from './normalize'
import { parseQuery, type SearchContext, type Term } from './query'
import { hasFlag, matchesQuery, type ClientSpec } from './client'
import { toPostgrestFilter } from './postgrest'
import { AGENDA, COUNTERPARTIES, FX, FX_SERVER, RECEIPTS, RECEIPTS_SERVER, RECEIVABLES, RECEIVABLES_SERVER, REFERENCE, USERS } from './scopes'

const ctx: SearchContext = {
  today: '2026-10-30',
  userId: 'u1',
  counterparties: [],
  lobs: [],
  countries: [
    { code: 'UZ', name: 'Uzbekistan', name_ru: 'Узбекистан', name_uz: 'Oʻzbekiston' },
    { code: 'AE', name: 'United Arab Emirates', name_ru: 'ОАЭ', name_uz: 'BAA' },
  ],
  currencies: ['USD', 'EUR', 'UZS'],
  users: [{ id: 'u1', name: 'Malika Karimova', role: 'underwriter' }, { id: 'u2', name: 'Nodira Saidova', role: 'finance' }, { id: 'u3', name: 'Ex Employee', role: null }],
}
const summary = (t: Term) =>
  t.kind === 'field' ? `${t.neg ? '-' : ''}${t.field}:${t.values.join('|')}` : t.kind === 'flag' ? `${t.neg ? '-' : ''}${t.flag}` : t.kind === 'text' ? `text:${t.words.join('+')}${t.asText ? '?' : ''}` : `${t.field}${JSON.stringify(t.range)}`

describe('counterparties', () => {
  const shape = (text: string) => parseQuery(text, ctx, COUNTERPARTIES).groups.map((g) => g.terms.map(summary))
  type Cp = { name: string; type: string; country_code: string | null; active: boolean }
  const rows: Cp[] = [
    { name: 'Silk Road Underwriting Agency', type: 'mga', country_code: 'AE', active: true },
    { name: 'Tashkent Re Brokers', type: 'broker', country_code: 'UZ', active: true },
    { name: 'Anadolu Re', type: 'cedent', country_code: null, active: false },
  ]
  const spec: ClientSpec<Cp> = { text: (c) => norm(c.name), list: { type: (c) => c.type, country: (c) => c.country_code }, flags: { inactive: () => true } }
  const show = (text: string) => {
    const q = parseQuery(text, ctx, COUNTERPARTIES)
    return rows.filter((c) => (hasFlag(q, 'inactive') || c.active) && matchesQuery(q, c, spec)).map((c) => c.name.split(' ')[0])
  }
  it('type, country and inactive in EN / RU / UZ', () => {
    for (const w of ['broker', 'брокер', 'type:broker', 'тип:брокер', 'turi:broker']) expect(shape(w), w).toEqual([['type:broker']])
    expect(shape('type:mga|broker')).toEqual([['type:mga|broker']])
    for (const w of ['country:UZ', 'страна:Узбекистан', "mamlakat:o'zbekiston", 'Uzbekistan']) expect(shape(w), w).toEqual([['country:UZ']])
    for (const w of ['inactive', 'неактивные', 'nofaol']) expect(shape(w), w).toEqual([['inactive']])
  })
  it('filters the rows; inactive only with «inactive»', () => {
    expect(show('')).toEqual(['Silk', 'Tashkent'])
    expect(show('inactive')).toEqual(['Silk', 'Tashkent', 'Anadolu'])
    expect(show('road')).toEqual(['Silk'])
    expect(show('re')).toEqual(['Tashkent']) // part of a word («Re»)
    expect(show('-country:UZ')).toEqual(['Silk']) // no country is kept, but Anadolu is inactive
    expect(show('-country:UZ, inactive')).toEqual(['Silk', 'Anadolu'])
    expect(show('cedent; mga')).toEqual(['Silk'])
    expect(show('cedent, inactive; mga')).toEqual(['Silk', 'Anadolu'])
  })
})

describe('agenda', () => {
  const shape = (text: string) => parseQuery(text, ctx, AGENDA).groups.map((g) => g.terms.map(summary))
  it('assignee (incl. all / mine), type, due, overdue', () => {
    for (const w of ['assignee:all', 'кто:все', 'kim:hamma']) expect(shape(w), w).toEqual([['assignee:all']])
    expect(shape('assignee:mine')).toEqual([['assignee:u1']])
    expect(shape('assignee:nodira')).toEqual([['assignee:u2']])
    expect(shape('assignee:ex')).toEqual([['text:ex?']]) // no role: not someone to assign to
    expect(shape('type:premium')).toEqual([['type:premium_overdue']])
    expect(shape('due<7d')).toEqual([['due{"gte":"2026-10-30","lte":"2026-11-06"}']])
    expect(shape('today')).toEqual([['due{"gte":"2026-10-30","lte":"2026-10-30"}']])
    for (const w of ['overdue', 'просрочено', 'kechikkan']) expect(shape(w), w).toEqual([['overdue']])
  })
  it('client filtering by due date and assignee', () => {
    type F = { title: string; assigned_to: string; due_at: string; is_overdue: boolean }
    const fs: F[] = [
      { title: 'Chase offer', assigned_to: 'u1', due_at: '2026-10-29T09:00:00Z', is_overdue: true },
      { title: 'Ask for remittance', assigned_to: 'u2', due_at: '2026-11-03T09:00:00Z', is_overdue: false },
    ]
    const spec: ClientSpec<F> = { text: (f) => norm(f.title), list: { assignee: (f) => [f.assigned_to, 'all'] }, date: { due: (f) => f.due_at }, flags: { overdue: (f) => f.is_overdue } }
    const show = (text: string) => fs.filter((f) => matchesQuery(parseQuery(text, ctx, AGENDA), f, spec)).map((f) => f.title)
    expect(show('overdue')).toEqual(['Chase offer'])
    expect(show('due<7d')).toEqual(['Ask for remittance'])
    expect(show('assignee:all')).toEqual(['Chase offer', 'Ask for remittance'])
    expect(show('assignee:nodira')).toEqual(['Ask for remittance'])
    expect(show('-overdue, remittance')).toEqual(['Ask for remittance'])
  })
})

describe('admin lists', () => {
  it('users: role and active / inactive', () => {
    const s = (text: string) => parseQuery(text, ctx, USERS).groups.map((g) => g.terms.map(summary))
    for (const w of ['finance', 'role:finance', 'роль:финансы', 'rol:moliya']) expect(s(w), w).toEqual([['role:finance']])
    expect(s('inactive')).toEqual([['inactive']])
    expect(s('active')).toEqual([['active']])
  })
  it('reference data: text and active flags only', () => {
    const s = (text: string) => parseQuery(text, ctx, REFERENCE).groups.map((g) => g.terms.map(summary))
    expect(s('cargo, неактивные')).toEqual([['text:cargo', 'inactive']])
  })
  it('FX rates filter in the database', () => {
    const f = (text: string) => toPostgrestFilter(parseQuery(text, ctx, FX), FX_SERVER, 'u1')
    expect(f('EUR')).toBe('and(currency.in.("EUR"))')
    expect(f('ccy:EUR|UZS, date>=2026-10-01')).toBe('and(currency.in.("EUR","UZS"),rate_date.gte.2026-10-01)')
    expect(f('source:manual')).toBe('and(source.ilike."*manual*")')
    expect(f('валюта:uzs; дата:2026-10')).toBe('and(currency.in.("UZS")),and(rate_date.gte.2026-10-01,rate_date.lt.2026-11-01)')
    expect(f('ccy:USD')).toBe('and(currency.ilike."*usd*")') // USD has no rate to itself: searched as text
  })
})

describe('receipts', () => {
  const rctx = { ...ctx, counterparties: [{ id: 'm1', name: 'Meridian Risk Partners', type: 'mga' }, { id: 'b1', name: 'Tashkent Re Brokers', type: 'broker' }] }
  const f = (text: string) => toPostgrestFilter(parseQuery(text, rctx, RECEIPTS), RECEIPTS_SERVER, 'u1')
  it('payer, currency, dates, amounts and allocation state in the database', () => {
    expect(f('payer:meridian, ccy:USD')).toBe('and(payer_id.in.("m1"),currency.in.("USD"))')
    expect(f('received>=2026-10-01, amount>10k')).toBe('and(received_date.gte.2026-10-01,amount.gt.10000)')
    expect(f('unallocated')).toBe('and(unallocated_amount.gt.0)')
    expect(f('-unallocated')).toBe('and(unallocated_amount.lte.0)')
    for (const w of ['нераспределено', 'taqsimlanmagan']) expect(f(w), w).toBe('and(unallocated_amount.gt.0)')
    expect(f('Tashkent Re Brokers')).toBe('and(payer_id.in.("b1"))') // a payer named exactly
  })
  it('free text looks at ref no., bank reference, payer and notes', () => {
    expect(f('mt103')).toBe('and(or(ref_no.ilike."*mt103*",bank_reference.ilike."*mt103*",payer_name.ilike."*mt103*",notes.ilike."*mt103*"))')
    expect(f('-mt103')).toBe(
      'and(or(ref_no.is.null,ref_no.not.ilike."*mt103*"),or(bank_reference.is.null,bank_reference.not.ilike."*mt103*"),or(payer_name.is.null,payer_name.not.ilike."*mt103*"),or(notes.is.null,notes.not.ilike."*mt103*"))',
    )
  })
})

describe('receivables', () => {
  const rctx: SearchContext = { ...ctx, counterparties: [{ id: 'm1', name: 'Silk Road Underwriting Agency', type: 'mga' }, { id: 'b1', name: 'Tashkent Re Brokers', type: 'broker' }] }
  const shape = (text: string) => parseQuery(text, rctx, RECEIVABLES).groups.map((g) => g.terms.map(summary))
  const filter = (text: string) => toPostgrestFilter(parseQuery(text, rctx, RECEIVABLES), RECEIVABLES_SERVER, 'u1')

  it('days overdue, ageing buckets and payable, in EN / RU / UZ', () => {
    for (const w of ['overdue>45', 'просрочено>45', 'kechikkan>45', 'days>45']) expect(shape(w), w).toEqual([['overdue{"gt":"45"}']])
    for (const w of ['bucket:61-90', 'корзина:61-90', 'yosh:61-90', '61-90']) expect(shape(w), w).toEqual([['bucket:61-90']])
    expect(shape('bucket:61-90|90+')).toEqual([['bucket:61-90|90+']])
    for (const w of ['payable', 'возврат', 'qaytarish']) expect(shape(w), w).toEqual([['payable']])
    // the bare word is the flag; with a number it is the field
    expect(shape('overdue')).toEqual([['overdue']])
    expect(shape('mga:silk, overdue')).toEqual([['mga:m1', 'overdue']])
  })

  it('reaches the view’s columns', () => {
    expect(filter('overdue>45')).toBe('and(days_overdue.gt.45)')
    expect(filter('bucket:61-90|90+')).toBe('and(aging_bucket.in.("61-90","90+"))')
    expect(filter('payable')).toBe('and(payable_amount.gt.0)')
    expect(filter('overdue')).toBe('and(days_overdue.gt.0)')
    expect(filter('due<30d')).toBe('and(due_date.gte.2026-10-30,due_date.lt.2026-11-30)')
    expect(filter('tashkent')).toBe('and(or(ref_no.ilike."*tashkent*",insured_name.ilike."*tashkent*",mga_name.ilike."*tashkent*",broker_name.ilike."*tashkent*"))')
  })
})
