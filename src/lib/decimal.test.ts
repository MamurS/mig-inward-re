import { describe, expect, it } from 'vitest'
import { cleanDecimal, formatDecimalInput, isDecimal, parseDecimalInput as parse, reformatDecimalInput, toScaled, type NumberKind } from './decimal'

const LANGS = ['en', 'ru', 'uz'] as const

describe('parseDecimalInput — the same in every language', () => {
  const cases: [string, NumberKind, string | null][] = [
    // pasted amounts
    ['1 234 567,89', 'amount', '1234567.89'],
    ['1,234,567.89', 'amount', '1234567.89'],
    ['1.234.567,89', 'amount', '1234567.89'],
    ['1234567.89', 'amount', '1234567.89'],
    ['1234567,89', 'amount', '1234567.89'],
    ['1 234 567,89', 'amount', '1234567.89'],
    ['1 234 567,89', 'amount', '1234567.89'],
    ["1'234'567.89", 'amount', '1234567.89'],
    ['1,234,567', 'amount', '1234567'],
    ['1.234.567', 'amount', '1234567'],
    ['1 234 567', 'amount', '1234567'],
    ['  1 000  ', 'amount', '1000'],
    ['1,5', 'amount', '1.5'],
    ['12,5', 'amount', '12.5'],
    ['12.50', 'amount', '12.50'],
    ['1,23', 'amount', '1.23'],
    ['0,500', 'amount', '0.500'], // a leading zero never groups thousands
    ['1234,567', 'amount', '1234.567'], // four digits before: not a thousands group
    [',5', 'amount', '0.5'],
    ['5,', 'amount', '5'],
    ['007', 'amount', '7'],
    // negatives
    ['-1 234,5', 'amount', '-1234.5'],
    ['−1 234,5', 'amount', '-1234.5'],
    ['-1,234,567.89', 'amount', '-1234567.89'],
    ['+12,5', 'amount', '12.5'],
    ['-0', 'amount', '0'],
    // percentages: a single separator is always decimal, «%» allowed
    ['12,5 %', 'pct', '12.5'],
    ['12.5%', 'pct', '12.5'],
    ['1,234', 'pct', '1.234'],
    ['1.234', 'pct', '1.234'],
    ['100', 'pct', '100'],
    // FX rates
    ['0,0000785', 'rate', '0.0000785'],
    ['12 650,5', 'rate', '12650.5'],
    ['12,650', 'rate', '12.650'],
    ['12,650.25', 'rate', '12650.25'],
    // empty and garbage
    ['', 'amount', null],
    ['   ', 'amount', null],
    ['abc', 'amount', null],
    ['12abc', 'amount', null],
    ['1e5', 'amount', null],
    [',', 'amount', null],
    ['-', 'amount', null],
    ['1,2,3', 'amount', null],
    ['1.234,567.89', 'amount', null],
    ['12 %', 'amount', null],
    ['1,23,456.7', 'amount', null],
  ]
  for (const lang of LANGS) {
    it.each(cases)(`${lang}: %j (%s) → %j`, (input, kind, out) => {
      expect(parse(input, kind, lang)).toBe(out)
    })
  }
})

describe('parseDecimalInput — «1,234» depends on the language for amounts only', () => {
  it('English reads a single comma before three digits as thousands in an amount', () => {
    expect(parse('1,234', 'amount', 'en')).toBe('1234')
    expect(parse('999,000', 'amount', 'en')).toBe('999000')
    expect(parse('1,234', 'int', 'en')).toBe('1234')
    expect(parse('1.234', 'amount', 'en')).toBe('1.234') // the dot is the English decimal mark
  })
  it('Russian and Uzbek read it as a decimal comma', () => {
    for (const lang of ['ru', 'uz']) {
      expect(parse('1,234', 'amount', lang)).toBe('1.234')
      expect(parse('1.234', 'amount', lang)).toBe('1.234')
    }
  })
  it('percentages and rates always read a single separator as decimal', () => {
    for (const lang of LANGS) {
      expect(parse('1,234', 'pct', lang)).toBe('1.234')
      expect(parse('1,234', 'rate', lang)).toBe('1.234')
    }
  })
})

describe('formatDecimalInput', () => {
  it('writes amounts in the interface language', () => {
    expect(formatDecimalInput('1234567.89', 'amount', 'ru')).toBe('1 234 567,89')
    expect(formatDecimalInput('1234567.89', 'amount', 'uz')).toBe('1 234 567,89')
    expect(formatDecimalInput('1234567.89', 'amount', 'en')).toBe('1,234,567.89')
    expect(formatDecimalInput('-1234.5', 'amount', 'ru')).toBe('-1 234,5')
    expect(formatDecimalInput('999', 'amount', 'en')).toBe('999')
    expect(formatDecimalInput('0.50', 'amount', 'ru')).toBe('0,50')
  })
  it('does not group English percentages and rates', () => {
    expect(formatDecimalInput('12650.5', 'rate', 'en')).toBe('12650.5')
    expect(formatDecimalInput('12650.5', 'rate', 'ru')).toBe('12 650,5')
    expect(formatDecimalInput('12.5', 'pct', 'en')).toBe('12.5')
    expect(formatDecimalInput('12.5', 'pct', 'ru')).toBe('12,5')
  })
  it('leaves anything that is not a plain decimal alone', () => {
    expect(formatDecimalInput('abc', 'amount', 'ru')).toBe('abc')
  })
})

describe('blur round trip: what the field shows reads back as the same number', () => {
  const values: [string, NumberKind][] = [
    ['1234567.89', 'amount'], ['1234', 'amount'], ['1.234', 'amount'], ['-1234.5', 'amount'], ['0.5', 'amount'], ['1000000', 'int'],
    ['12.5', 'pct'], ['1.234', 'pct'], ['100', 'pct'], ['0.0000785', 'rate'], ['12650', 'rate'], ['12650.5', 'rate'], ['1.234', 'rate'],
  ]
  for (const lang of LANGS) {
    it.each(values)(`${lang}: %s (%s)`, (v, kind) => {
      const shown = formatDecimalInput(v, kind, lang)
      expect(parse(shown, kind, lang)).toBe(v)
      expect(reformatDecimalInput(shown, kind, lang)).toBe(shown)
    })
  }
  it('typed text is shown back read', () => {
    expect(reformatDecimalInput('1 234 567,89', 'amount', 'ru')).toBe('1 234 567,89')
    expect(reformatDecimalInput('1,234,567.89', 'amount', 'ru')).toBe('1 234 567,89')
    expect(reformatDecimalInput('1 234 567,89', 'amount', 'en')).toBe('1,234,567.89')
    expect(reformatDecimalInput('1,5', 'pct', 'ru')).toBe('1,5')
    expect(reformatDecimalInput('1,5', 'pct', 'en')).toBe('1.5')
    expect(reformatDecimalInput('12,5 %', 'pct', 'uz')).toBe('12,5')
    expect(reformatDecimalInput('garbage', 'amount', 'ru')).toBe('garbage')
    expect(reformatDecimalInput('', 'amount', 'ru')).toBe('')
  })
})

describe('cleanDecimal / isDecimal / toScaled use the interface language', () => {
  it('reads the current language (English by default in tests)', () => {
    expect(cleanDecimal('1,5')).toBe('1.5')
    expect(cleanDecimal('1 234 567,89')).toBe('1234567.89')
    expect(cleanDecimal('1,234')).toBe('1234')
    expect(cleanDecimal('1,234', 'pct')).toBe('1.234')
  })
  it('keeps the scale checks', () => {
    expect(isDecimal('1 234,56', 2)).toBe(true)
    expect(isDecimal('1,234', 6)).toBe(true) // percent: 1.234
    expect(isDecimal('1,2345', 2)).toBe(false)
    expect(isDecimal('abc', 2)).toBe(false)
    expect(isDecimal('', 2)).toBe(false)
    expect(isDecimal('0,0000785', 10)).toBe(true)
  })
  it('scales exactly, without floats', () => {
    expect(toScaled('1 234 567,89', 2)).toBe(123456789n)
    expect(toScaled('12,5', 6)).toBe(12_500_000n)
    expect(toScaled('-1 234,5', 2)).toBe(-123450n)
    expect(toScaled('99999999999999999,99', 2)).toBe(9999999999999999999n)
  })
})
