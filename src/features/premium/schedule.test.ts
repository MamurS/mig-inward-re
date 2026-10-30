import { describe, expect, it } from 'vitest'
import { addMonthsIso, defaultDueDate, equalSchedule, rowDeductions, splitEqual, subMoney, sumMoney } from './schedule'

describe('premium schedule maths (mirrors generate_premium_schedule)', () => {
  it('splits into equal cents with the remainder on the last row', () => {
    expect(splitEqual('10000.00', 3)).toEqual(['3333.33', '3333.33', '3333.34'])
    expect(splitEqual('0.05', 2)).toEqual(['0.02', '0.03'])
    expect(sumMoney(splitEqual('123456.78', 7))).toBe('123456.78')
  })

  it('rounds commission and brokerage per row, last row takes the difference (same as the DB test)', () => {
    const rows = rowDeductions(['3333.33', '3333.33', '3333.34'], 25, 5)
    expect(rows.map((r) => r.commission)).toEqual(['833.33', '833.33', '833.34'])
    expect(rows.map((r) => r.brokerage)).toEqual(['166.67', '166.67', '166.66'])
    expect(sumMoney(rows.map((r) => r.commission))).toBe('2500.00')
    expect(sumMoney(rows.map((r) => r.net))).toBe('7000.00')
  })

  it('handles fractional percentages exactly', () => {
    const [r] = rowDeductions(['1000.00'], '12.345678', 0)
    expect(r.commission).toBe('123.46')
    expect(r.net).toBe('876.54')
  })

  it('dates: default due date and month steps that clamp to month end', () => {
    expect(defaultDueDate({ ppw_date: null, period_from: '2026-01-01', bound_at: null, payment_terms_days: 30 })).toBe('2026-01-31')
    expect(defaultDueDate({ ppw_date: '2026-03-15', period_from: '2026-01-01', bound_at: null, payment_terms_days: 30 })).toBe('2026-03-15')
    // no terms on the submission: the premium_default_terms_days setting (60 unless changed)
    expect(defaultDueDate({ ppw_date: null, period_from: '2026-01-01', bound_at: null, payment_terms_days: null })).toBe('2026-03-02')
    expect(defaultDueDate({ ppw_date: null, period_from: '2026-01-01', bound_at: null, payment_terms_days: null }, 45)).toBe('2026-02-15')
    expect(addMonthsIso('2026-01-31', 1)).toBe('2026-02-28')
    expect(equalSchedule('900', 3, '2026-01-31', 3).map((r) => r.due_date)).toEqual(['2026-01-31', '2026-04-30', '2026-07-31'])
  })

  it('subtracts money exactly', () => {
    expect(subMoney('7000.00', '6999.99')).toBe('0.01')
    expect(subMoney('0.1', '0.3')).toBe('-0.20')
  })
})
