import { describe, expect, it } from 'vitest'
import { columnLetter, headersOf, parseCsv } from './parse'
import { applyTemplate, autoMap, checkRows, dupKey, linesTotal, parseAmount, parseDate, periodOf, toPayload, type CheckContext } from './validate'

const binder: CheckContext['binder'] = {
  period_from: '2026-01-15',
  period_to: '2027-01-14',
  currency: 'USD',
  limit_per_risk: 5000000,
  territories: ['UZ', 'KZ'],
  lobs: [{ id: 'lob-cargo', code: 'CARGO', name: 'Cargo', limit_100: 4000000 }],
}
const ctx = (kind: CheckContext['kind'], existing: string[] = []): CheckContext => ({
  kind,
  binder,
  periodStart: '2026-02-01',
  periodEnd: '2026-02-28',
  existing: new Set(existing),
  currencies: new Set(['USD', 'EUR', 'UZS']),
  countries: new Map([['uzbekistan', 'UZ'], ['узбекистан', 'UZ'], ['kazakhstan', 'KZ']]),
})

describe('parseCsv', () => {
  it('guesses the delimiter and keeps quoted fields', () => {
    expect(parseCsv('a;b;c\n1;"x;y";\n')).toEqual([['a', 'b', 'c'], ['1', 'x;y', null]])
    expect(parseCsv('﻿Policy,Premium\r\n"P ""1""","1,234.50"\r\n\r\n')).toEqual([['Policy', 'Premium'], ['P "1"', '1,234.50']])
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']])
  })
  it('names blank headers by column letter', () => {
    expect(headersOf([['Policy', null, 'Premium'], ['P1', 'x', 1, 'extra']], 1)).toEqual(['Policy', 'B', 'Premium', 'D'])
    expect(columnLetter(0)).toBe('A')
    expect(columnLetter(27)).toBe('AB')
  })
})

describe('parsing values', () => {
  it('reads dates in ISO, day-first and Excel serial form, and refuses nonsense', () => {
    expect(parseDate('2026-02-03')).toBe('2026-02-03')
    expect(parseDate('03.02.2026')).toBe('2026-02-03')
    expect(parseDate('3/2/2026')).toBe('2026-02-03')
    expect(parseDate(new Date(Date.UTC(2026, 1, 3)))).toBe('2026-02-03')
    expect(parseDate(46056)).toBe('2026-02-03')
    expect(parseDate('31.02.2026')).toBeUndefined()
    expect(parseDate('soon')).toBeUndefined()
    expect(parseDate(null)).toBeNull()
  })
  it('reads amounts exactly in every common notation', () => {
    expect(parseAmount('1 234,56')).toBe('1234.56')
    expect(parseAmount('1,234.56')).toBe('1234.56')
    expect(parseAmount('1.234.567,8')).toBe('1234567.80')
    expect(parseAmount('(1,000)')).toBe('-1000.00')
    expect(parseAmount('USD 250000')).toBe('250000.00')
    expect(parseAmount(0.1 + 0.2)).toBe('0.30')
    expect(parseAmount('12a')).toBeUndefined()
    expect(parseAmount('')).toBeNull()
  })
})

describe('mapping', () => {
  it('guesses columns from their titles in EN and RU and keeps a template’s choices that still exist', () => {
    const headers = ['Certificate No', 'Assured', 'Страна', 'Inception', 'Currency', 'Limit 100%', 'Notes']
    const m = autoMap(headers, 'risk')
    expect(m).toMatchObject({ policy_ref: 'Certificate No', insured_name: 'Assured', insured_country: 'Страна', period_from: 'Inception', currency: 'Currency', limit_100: 'Limit 100%' })
    expect(applyTemplate({ policy_ref: 'Certificate No', limit_100: 'Gone' }, headers)).toEqual({ policy_ref: 'Certificate No' })
  })
})

describe('checking risk lines', () => {
  const headers = ['Policy', 'Country', 'Class', 'Inception', 'Ccy', 'Limit']
  const map = { policy_ref: 'Policy', insured_country: 'Country', lob: 'Class', period_from: 'Inception', currency: 'Ccy', limit_100: 'Limit' }
  const rows = [
    headers,
    ['P1', 'UZ', 'CARGO', '2026-02-05', 'USD', 1000000], // ok
    ['P2', 'Uzbekistan', 'cargo', '10.03.2026', 'USD', '2 000 000'], // outside the month → warning
    ['P3', 'RU', 'CARGO', '2026-02-06', 'USD', 1000], // territory → error
    ['P4', 'KZ', 'FIRE', '2026-02-06', 'USD', 1000], // line not in binder → error
    ['P5', 'KZ', 'CARGO', '2025-12-01', 'USD', 1000], // before the binder → error
    ['P6', 'KZ', 'CARGO', '2026-02-07', 'USD', 6000000], // above the limit per risk (and the line's) → error
    ['P7', 'KZ', 'CARGO', '2026-02-07', 'USD', 4500000], // above the line's limit only → error
    ['P8', 'KZ', null, '2026-02-08', 'EUR', 100], // other currency → warning
    ['P1', 'UZ', 'CARGO', '2026-02-05', 'USD', 5], // same as line 2 → error
    [null, null, null, null, null, null], // blank: skipped
    ['P9', 'UZ', 'CARGO', '2026-02-09', 'XXX', 5], // unknown currency → error
    ['P10', 'UZ', 'CARGO', '2026-02-10', 'USD', 1], // seen on an earlier bordereau → error
  ]
  const lines = checkRows(rows, headers, 1, map, ctx('risk', ['P10|2026-02-10']))
  const by = (p: string) => lines.filter((l) => l.values.policy_ref === p)
  const codes = (p: string, i = 0) => by(p)[i].issues.map((x) => x.code)

  it('passes a clean line and fills its line of business', () => {
    expect(by('P1')[0]).toMatchObject({ status: 'ok', line_no: 2, lob_id: 'lob-cargo', dup_key: 'P1|2026-02-05' })
    expect(by('P1')[0].values).toMatchObject({ insured_country: 'UZ', limit_100: '1000000.00' })
  })
  it('warns for another month and another currency', () => {
    expect(by('P2')[0].status).toBe('warning')
    expect(codes('P2')).toEqual(['outsidePeriod'])
    expect(by('P2')[0].values.insured_country).toBe('UZ')
    expect(codes('P8')).toEqual(['otherCurrency'])
  })
  it('stops territory, line, binder period, limits, currency and duplicates', () => {
    expect(codes('P3')).toEqual(['territory'])
    expect(codes('P4')).toEqual(['lobNotInBinder'])
    expect(codes('P5')).toEqual(['outsideBinder'])
    expect(codes('P6')).toEqual(['aboveLimit', 'aboveLobLimit'])
    expect(codes('P7')).toEqual(['aboveLobLimit'])
    expect(codes('P1', 1)).toEqual(['duplicateInFile'])
    expect(codes('P9')).toEqual(['badCurrency'])
    expect(codes('P10')).toEqual(['duplicateEarlier'])
    expect(lines.filter((l) => l.status === 'error')).toHaveLength(8)
  })
  it('skips blank rows and numbers lines by their spreadsheet row', () => {
    expect(lines).toHaveLength(11)
    expect(by('P10')[0].line_no).toBe(13)
  })
  it('totals limits exactly and builds the import payload without helper fields', () => {
    expect(linesTotal('risk', [by('P1')[0], by('P2')[0]])).toBe('3000000.00')
    const p = toPayload(by('P2')[0], '  Inception moved by the MGA ')
    expect(p).toMatchObject({ line_no: 3, status: 'warning', comment: 'Inception moved by the MGA', lob_id: 'lob-cargo', period_from: '2026-03-10', messages: ['outsidePeriod'] })
    expect(p).not.toHaveProperty('lob')
  })
})

describe('premium and claims lines', () => {
  it('requires premium and flags return premium', () => {
    const lines = checkRows(
      [['Policy', 'Ccy', 'Premium', 'Type'], ['P1', 'USD', '1,000.00', 'AP'], ['P2', 'USD', '-200', null], ['P3', 'USD', null, null]],
      ['Policy', 'Ccy', 'Premium', 'Type'], 1, { policy_ref: 'Policy', currency: 'Ccy', gross_premium_100: 'Premium', transaction: 'Type' }, ctx('premium'))
    expect(lines.map((l) => l.status)).toEqual(['ok', 'warning', 'error'])
    expect(lines[0].dup_key).toBe('P1|AP')
    expect(lines[1].dup_key).toBe('P2|NB')
    expect(linesTotal('premium', lines.slice(0, 2))).toBe('800.00')
  })
  it('keys claims by claim and month, warns on a loss outside the binder, totals paid + outstanding', () => {
    const lines = checkRows(
      [['Claim', 'DOL', 'Ccy', 'Paid', 'OS'], ['C1', '2026-02-10', 'USD', 100, '50.5'], ['C2', '2025-01-01', 'USD', null, null]],
      ['Claim', 'DOL', 'Ccy', 'Paid', 'OS'], 1, { claim_ref: 'Claim', date_of_loss: 'DOL', currency: 'Ccy', paid_100: 'Paid', outstanding_100: 'OS' }, ctx('claims'))
    expect(lines[0]).toMatchObject({ status: 'ok', dup_key: 'C1|2026-02-01' })
    expect(lines[1].issues.map((i) => i.code)).toEqual(['lossOutsideBinder', 'noAmounts'])
    expect(linesTotal('claims', lines)).toBe('150.50')
    expect(dupKey('claims', { claim_ref: 'C1' }, '2026-03-01')).toBe('C1|2026-03-01')
  })
})

describe('periodOf', () => {
  it('gives the calendar month or quarter', () => {
    expect(periodOf('2026-02-14', 'monthly')).toEqual(['2026-02-01', '2026-02-28'])
    expect(periodOf('2024-02-14', 'monthly')).toEqual(['2024-02-01', '2024-02-29'])
    expect(periodOf('2026-05-14', 'quarterly')).toEqual(['2026-04-01', '2026-06-30'])
  })
})
