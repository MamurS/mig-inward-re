import { describe, expect, it } from 'vitest'
import { autoAllocate, checkRate, convert, inverseRate, maxFor, referenceRate, total } from './receipts'

describe('receipt allocation maths (mirrors the database)', () => {
  it('converts like round(amount × fx_rate, 2)', () => {
    // the step-3 database test: USD 7,604.56 at 0.9205 EUR per USD → EUR 7,000.00
    expect(convert('7604.56', '0.9205')).toBe('7000.00')
    expect(convert('12000', '0.9205')).toBe('11046.00')
    expect(convert('500', '1.1')).toBe('550.00')
    expect(convert('0.01', '0.5')).toBe('0.01') // half away from zero
    expect(convert('1,000.00', '12850.5')).toBe('12850500.00')
  })
  it('shows the rate both ways', () => {
    expect(inverseRate('0.9205')).toBe('1.0863661054')
    expect(inverseRate('1')).toBe('1')
    expect(inverseRate('0')).toBeNull()
  })
  it('reference rate from the USD rates', () => {
    const usd = (c: string) => ({ EUR: 1.0864, UZS: 0.0000785, GBP: 1.27 })[c] ?? null
    expect(referenceRate('USD', 'EUR', usd)).toBe('0.9204712813')
    expect(referenceRate('EUR', 'USD', usd)).toBe('1.0864')
    expect(referenceRate('USD', 'UZS', usd)).toBe('12738.8535031847') // 10 decimals, like numeric(20,10)
    expect(referenceRate('EUR', 'EUR', usd)).toBe('1')
    expect(referenceRate('USD', 'KZT', usd)).toBeNull()
  })
  it('flags an inverted or far-off rate before saving', () => {
    expect(checkRate('0.9205', '0.9204712813')).toBe('ok')
    expect(checkRate('1.0864', '0.9204712813')).toBe('inverted')
    expect(checkRate('0.0000785', '12738.85')).toBe('inverted')
    expect(checkRate('0.7', '0.92')).toBe('far')
    expect(checkRate('1.02', '1')).toBe('ok')
    expect(checkRate('1.5', null)).toBeNull()
  })
  it('the most that fits an installment', () => {
    expect(maxFor('7000.00', '0.9205')).toBe('7604.56')
    expect(convert(maxFor('7000.00', '0.9205')!, '0.9205')).toBe('7000.00')
    expect(maxFor('3500', '1')).toBe('3500.00')
    expect(maxFor('0', '1')).toBeNull()
  })
  it('auto-allocates oldest first until the receipt is used', () => {
    const rows = [
      { id: 'a', outstanding: '3500.00', rate: '1' },
      { id: 'b', outstanding: '7000.00', rate: '0.9205' },
      { id: 'c', outstanding: '100.00', rate: null }, // no rate yet: skipped
      { id: 'd', outstanding: '2000.00', rate: '1' },
    ]
    expect(autoAllocate('12000.00', rows)).toEqual({ a: '3500.00', b: '7604.56', d: '895.44' })
    expect(autoAllocate('1000', rows)).toEqual({ a: '1000.00' })
    expect(total(['3500.00', '7604.56', '895.44'])).toBe('12000.00')
  })
})
