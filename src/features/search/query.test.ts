import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { NORM_DROP, NORM_FROM, NORM_TO, norm } from './normalize'
import { currentToken as currentTokenIn, parseQuery, removeTerm, tidy, type DateTerm, type FieldTerm, type NumTerm, type SearchContext, type Term } from './query'
import { toPostgrestFilter } from './postgrest'
import { SUBMISSIONS, SUBMISSIONS_SERVER } from './scopes'

const currentToken = (text: string) => currentTokenIn(text, SUBMISSIONS)

const ctx: SearchContext = {
  today: '2026-10-30', // a Friday
  userId: 'u1',
  counterparties: [
    { id: 'm1', name: 'Sevil', type: 'mga' },
    { id: 'm2', name: 'IUC Underwriting Agency', type: 'mga' },
    { id: 'm3', name: 'Silk Road Underwriting Agency', type: 'mga' },
    { id: 'b1', name: 'Marsh Kazakhstan', type: 'broker' },
    { id: 's1', name: 'Yigit Agro', type: 'insured' },
  ],
  lobs: [
    { id: 'l1', code: 'PROP', name: 'Property', name_ru: 'Имущество', name_uz: 'Mulk' },
    { id: 'l2', code: 'CARGO', name: 'Cargo', name_ru: 'Грузы', name_uz: 'Yuk' },
  ],
  countries: [
    { code: 'UZ', name: 'Uzbekistan', name_ru: 'Узбекистан', name_uz: 'Oʻzbekiston' },
    { code: 'TR', name: 'Turkey', name_ru: 'Турция', name_uz: 'Turkiya' },
  ],
  currencies: ['USD', 'EUR', 'UZS'],
  users: [{ id: 'u1', name: 'Malika Karimova' }, { id: 'u2', name: 'Bekzod Usmanov' }],
}

const p = (text: string) => parseQuery(text, ctx, SUBMISSIONS)
const only = (text: string) => {
  const q = p(text)
  expect(q.groups).toHaveLength(1)
  expect(q.groups[0].terms).toHaveLength(1)
  return q.groups[0].terms[0]
}
const field = (t: Term) => {
  expect(t.kind).toBe('field')
  return t as FieldTerm
}
const summary = (t: Term) =>
  t.kind === 'field' ? `${t.neg ? '-' : ''}${t.field}:${t.values.join('|')}`
    : t.kind === 'text' ? `${t.neg ? '-' : ''}text:${t.words.join('+')}${t.phrase ? '(phrase)' : ''}${t.asText ? '(asText)' : ''}`
    : t.kind === 'flag' ? `${t.neg ? '-' : ''}${t.flag}`
    : `${t.neg ? '-' : ''}${t.field}${JSON.stringify(t.range)}`
const shape = (text: string) => p(text).groups.map((g) => g.terms.map(summary))

describe('normalisation', () => {
  it('maps letters one to one and matches the SQL function', () => {
    expect([...NORM_FROM]).toHaveLength([...NORM_TO].length)
    const file = readdirSync('supabase/migrations').find((f) => f.endsWith('_search_text.sql'))!
    const sql = readFileSync(`supabase/migrations/${file}`, 'utf8')
    const m = /translate\(lower\(t\), '((?:[^']|'')*)', '([^']*)'\)/.exec(sql)!
    expect(m[1].replace(/''/g, "'")).toBe(NORM_FROM + NORM_DROP)
    expect(m[2]).toBe(NORM_TO)
  })
  it('ignores case, diacritics and apostrophes', () => {
    expect(norm('Koʻrib')).toBe('korib')
    expect(norm("bog‘langan")).toBe(norm("bog'langan"))
    expect(norm('Çukurova Şişli')).toBe('cukurova sisli')
    expect(norm('ЁЛКА')).toBe('елка')
  })
})

describe('the examples', () => {
  it('free text, partial words', () => {
    expect(shape('evon')).toEqual([['text:evon']])
    expect(shape('Yigit Agro')).toEqual([['text:Yigit+Agro']])
  })
  it(', is AND', () => {
    expect(shape('Sevil, property, bound')).toEqual([['mga:m1', 'lob:l1', 'status:bound']])
  })
  it('; is OR between groups', () => {
    expect(shape('Sevil, bound; IUC, offered')).toEqual([['mga:m1', 'status:bound'], ['text:IUC', 'status:offered']])
  })
  it('| gives several values', () => {
    expect(field(only('status:offered|bound')).values).toEqual(['offered', 'bound'])
  })
  it('- excludes', () => {
    expect(shape('-declined')).toEqual([['-status:declined']])
    expect(shape('-mga:Sevil')).toEqual([['-mga:m1']])
    expect(shape('-evonik')).toEqual([['-text:evonik']])
  })
  it('quotes are an exact phrase', () => {
    expect(shape('"Yigit Agro"')).toEqual([['text:Yigit Agro(phrase)']])
  })
  it('field filters, every alias', () => {
    expect(shape('mga:"Silk Road Underwriting Agency"')).toEqual([['mga:m3']])
    expect(shape('mga:underwriting')).toEqual([['mga:m2|m3']])
    expect(shape('broker:marsh')).toEqual([['broker:b1']])
    expect(shape('broker:none')).toEqual([['broker:none']])
    expect(shape('lob:property')).toEqual([['lob:l1']])
    expect(shape('country:TR')).toEqual([['country:TR']])
    expect(shape('ccy:usd')).toEqual([['ccy:USD']])
    expect(shape('currency:EUR')).toEqual([['ccy:EUR']])
    expect(shape('uw:Malika')).toEqual([['uw:u1']])
    expect(shape('underwriter:bekzod')).toEqual([['uw:u2']])
    expect(shape('type:binder')).toEqual([['type:binder']])
    expect(shape('type:fac')).toEqual([['type:facultative']])
    expect(shape('ref:2026-0012')).toEqual([['ref:2026-0012']])
  })
  it('numbers', () => {
    expect((only('premium>100000') as NumTerm).range).toEqual({ gt: '100000' })
    expect((only('share>=10') as NumTerm).range).toEqual({ gte: '10' })
    expect((only('si>5m') as NumTerm).range).toEqual({ gt: '5000000' })
    expect((only('si<1.5bn') as NumTerm).range).toEqual({ lt: '1500000000' })
    expect((only('premium:100k..500k') as NumTerm).range).toEqual({ gte: '100000', lte: '500000' })
  })
  it('dates', () => {
    expect((only('received>=2026-10-01') as DateTerm).range).toEqual({ gte: '2026-10-01' })
    expect((only('inception:2026-01-01..2026-06-30') as DateTerm).range).toEqual({ gte: '2026-01-01', lte: '2026-06-30' })
    expect((only('expiry<30d') as DateTerm).range).toEqual({ gte: '2026-10-30', lte: '2026-11-29' })
    expect((only('received<7d') as DateTerm).range).toEqual({ gte: '2026-10-23', lte: '2026-10-30' })
    expect((only('received:2026-10') as DateTerm).range).toEqual({ gte: '2026-10-01', lte: '2026-10-31' })
    expect((only('received:2026') as DateTerm).range).toEqual({ gte: '2026-01-01', lte: '2026-12-31' })
    expect((only('received>=01.10.2026') as DateTerm).range).toEqual({ gte: '2026-10-01' })
    expect((only('bound>2026-06') as DateTerm).range).toEqual({ gt: '2026-06-30' })
  })
  it('keywords', () => {
    expect(shape('overdue')).toEqual([['overdue']])
    expect(shape('expired')).toEqual([['expired']])
    expect(shape('noresponse')).toEqual([['status:no_response']])
    expect(shape('mine')).toEqual([['mine']])
    expect((only('today') as DateTerm).range).toEqual({ gte: '2026-10-30', lte: '2026-10-30' })
    expect((only('thisweek') as DateTerm).range).toEqual({ gte: '2026-10-26', lte: '2026-11-01' })
    expect((only('thismonth') as DateTerm).range).toEqual({ gte: '2026-10-01', lte: '2026-10-31' })
  })
  it('a word that names a status, MGA or currency exactly is that filter', () => {
    expect(shape('bound')).toEqual([['status:bound']])
    expect(shape('USD')).toEqual([['ccy:USD']])
    expect(shape('Sevil')).toEqual([['mga:m1']])
    expect(shape('Silk Road Underwriting Agency')).toEqual([['mga:m3']])
    expect(shape('Sev')).toEqual([['text:Sev']]) // not exact: text (still matches the MGA name)
  })
})

describe('Russian and Uzbek', () => {
  it('status words', () => {
    for (const w of ['bound', 'связан', 'связана', 'Подтверждена', 'bog‘langan', "bog'langan", 'boglangan', 'Tasdiqlandi']) {
      expect(shape(w), w).toEqual([['status:bound']])
    }
    expect(shape('на рассмотрении')).toEqual([['status:under_review']])
    expect(shape('Koʻrib chiqilmoqda')).toEqual([['status:under_review']])
    expect(shape('нет ответа')).toEqual([['status:no_response']])
  })
  it('field names', () => {
    expect(shape('статус:связан')).toEqual([['status:bound']])
    expect(shape('holat:taklif')).toEqual([['status:offered']])
    expect(shape('валюта:usd')).toEqual([['ccy:USD']])
    expect(shape('страна:Турция')).toEqual([['country:TR']])
    expect(shape('mamlakat:Oʻzbekiston')).toEqual([['country:UZ']])
    expect(shape("mamlakat:o'zbekiston")).toEqual([['country:UZ']])
    expect(shape('вид:имущество')).toEqual([['lob:l1']])
    expect(shape('премия>100к')).toMatchObject([[expect.stringContaining('premium{"gt":"100000"}')]])
    expect(shape('доля>=10')).toMatchObject([[expect.stringContaining('share{"gte":"10"}')]])
    expect(shape('-брокер:нет')).toEqual([['-broker:none']])
  })
  it('keywords', () => {
    expect(shape('просрочено')).toEqual([['overdue']])
    expect(shape('kechikkan')).toEqual([['overdue']])
    expect(shape('истекло')).toEqual([['expired']])
    expect(shape('мои')).toEqual([['mine']])
    expect((only('сегодня') as DateTerm).range).toEqual({ gte: '2026-10-30', lte: '2026-10-30' })
    expect((only('bugun') as DateTerm).range).toEqual({ gte: '2026-10-30', lte: '2026-10-30' })
    expect((only('в этом месяце') as DateTerm).keyword).toBe('thismonth')
  })
})

describe('messy input never throws', () => {
  it('extra spaces and empty parts', () => {
    expect(shape('   Sevil  ,,  bound ,  ')).toEqual([['mga:m1', 'status:bound']])
    expect(shape(' ; ; ')).toEqual([])
    expect(shape('Sevil;')).toEqual([['mga:m1']])
    expect(shape('')).toEqual([])
  })
  it('unknown fields and values are searched as text, and say so', () => {
    expect(shape('foo:bar')).toEqual([['text:foo+bar(asText)']])
    expect(shape('mga:Nowhere')).toEqual([['text:Nowhere(asText)']])
    expect(shape('premium>lots')).toEqual([['text:lots(asText)']])
    expect(shape('received>yesterday-ish')).toEqual([['text:yesterday-ish(asText)']])
  })
  it('an unclosed quote is a phrase to the end, marked', () => {
    expect(shape('"Yigit Agro')).toEqual([['text:Yigit Agro(phrase)(asText)']])
    expect(shape('Sevil, "bound; offered')).toEqual([['mga:m1', 'text:bound; offered(phrase)(asText)']])
  })
  it('a weak synonym inside a longer name stays text', () => {
    expect(shape('New York Life')).toEqual([['text:New+York+Life']])
    expect(shape('new')).toEqual([['status:received']])
  })
  it('syntax characters never reach the database unescaped', () => {
    const f = toPostgrestFilter(p('a(b)*c%d"e\\f'), SUBMISSIONS_SERVER, 'u1')!
    expect(f).toBe('and(search_text.ilike."*abcdef*")')
  })
})

describe('editing', () => {
  it('removing a chip removes its text', () => {
    const q = p('Sevil, property, bound')
    expect(removeTerm(q.text, q.groups[0].terms[1])).toBe('Sevil, bound')
    const o = p('Sevil, bound; IUC, offered')
    expect(removeTerm(o.text, o.groups[1].terms[0])).toBe('Sevil, bound; offered')
    expect(removeTerm(o.text, o.groups[1].terms[1])).toBe('Sevil, bound; IUC')
    const s = p('status:bound received>=2026-01-01')
    expect(removeTerm(s.text, s.groups[0].terms[0])).toBe('received>=2026-01-01')
    const last = p('bound')
    expect(removeTerm(last.text, last.groups[0].terms[0])).toBe('')
  })
  it('tidy keeps quoted text intact', () => {
    expect(tidy(' a ,, "x   y"  ;; b ')).toBe('a, "x   y"; b')
  })
  it('the token being typed', () => {
    expect(currentToken('Sevil, sta')).toMatchObject({ start: 7, field: null, value: 'sta' })
    expect(currentToken('mga:sil')).toMatchObject({ start: 0, field: 'mga', value: 'sil' })
    expect(currentToken('status:offered|bo')).toMatchObject({ field: 'status', value: 'bo' })
    expect(currentToken('-mga:"Silk Ro')).toMatchObject({ neg: true, field: 'mga', value: 'Silk Ro' })
  })
})

describe('database filter', () => {
  const f = (text: string) => toPostgrestFilter(p(text), SUBMISSIONS_SERVER, 'u1')
  it('groups are OR, parts AND', () => {
    expect(f('Sevil, bound; IUC, offered')).toBe(
      'and(mga_id.in.("m1"),status.in.("bound")),and(search_text.ilike."*iuc*",status.in.("offered"))',
    )
  })
  it('text is normalised like the view', () => {
    expect(f("bog‘langan agro")).toBe('and(status.in.("bound"),search_text.ilike."*agro*")')
    expect(f('Çukurova Koʻrib')).toBe('and(search_text.ilike."*cukurova*",search_text.ilike."*korib*")')
  })
  it('exclusions keep rows without a value', () => {
    expect(f('-mga:Sevil')).toBe('and(or(mga_id.is.null,mga_id.not.in.("m1")))')
    expect(f('-broker:none')).toBe('and(broker_id.not.is.null)')
    expect(f('broker:none|marsh')).toBe('and(or(broker_id.in.("b1"),broker_id.is.null))')
    expect(f('-declined')).toBe('and(or(status.is.null,status.not.in.("declined")))')
  })
  it('numbers, dates, flags', () => {
    expect(f('premium>100k, share>=10')).toBe('and(our_gross_premium_usd.gt.100000,share_pct.gte.10)')
    expect(f('inception:2026-01-01..2026-06-30')).toBe('and(period_from.gte.2026-01-01,period_from.lt.2026-07-01)')
    expect(f('bound>2026-06')).toBe('and(bound_at.gte.2026-07-01)')
    expect(f('-premium>100k')).toBe('and(our_gross_premium_usd.not.gt.100000)')
    expect(f('overdue, -expired, mine')).toBe('and(follow_up_overdue.is.true,offer_expired.not.is.true,underwriter_id.eq.u1)')
  })
  it('nothing to filter → null', () => {
    expect(f('')).toBeNull()
    expect(f(' , ; ')).toBeNull()
  })
})
