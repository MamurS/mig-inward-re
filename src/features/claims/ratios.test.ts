import { describe, expect, it } from 'vitest'
import { earnedFraction, lossRatios, type ClaimLite, type RiskLite } from './ratios'

describe('earned premium', () => {
  it('runs pro rata by day, both ends included, between 0 and 1', () => {
    expect(earnedFraction('2026-01-01', '2026-12-31', '2025-12-31')).toBe(0)
    expect(earnedFraction('2026-01-01', '2026-12-31', '2026-01-01')).toBeCloseTo(1 / 365)
    expect(earnedFraction('2026-01-01', '2026-12-31', '2026-07-02')).toBeCloseTo(183 / 365)
    expect(earnedFraction('2026-01-01', '2026-12-31', '2026-12-31')).toBe(1)
    expect(earnedFraction('2026-01-01', '2026-12-31', '2027-06-01')).toBe(1)
    expect(earnedFraction(null, '2026-12-31', '2026-06-01')).toBeNull()
  })
})

describe('loss ratios', () => {
  const risk = (r: Partial<RiskLite>): RiskLite => ({
    id: 'x', status: 'bound', period_from: '2026-01-01', period_to: '2026-12-31', our_net_premium_usd: 100_000,
    mga_id: 'm1', mga_name: 'Silk Road', lob_code: 'PROP', lob_name: 'Property', ...r,
  })
  const claim = (c: Partial<ClaimLite>): ClaimLite => ({ submission_id: 'x', incurred_usd: 30_000, mga_id: 'm1', mga_name: 'Silk Road', lob_code: 'PROP', lob_name: 'Property', underwriting_year: 2026, ...c })

  it('incurred over written and over earned, by MGA; unbound risks do not count; no-rate items are counted apart', () => {
    const r = lossRatios(
      [risk({}), risk({ id: 'y', our_net_premium_usd: 100_000 }), risk({ id: 'z', status: 'offered' }), risk({ id: 'n', our_net_premium_usd: null }), risk({ id: 'k', mga_id: 'm2', mga_name: 'Caspian' })],
      [claim({}), claim({ incurred_usd: 10_000 }), claim({ incurred_usd: null }), claim({ mga_id: 'm2', mga_name: 'Caspian', incurred_usd: 150_000 })],
      'mga',
      '2026-07-02',
    )
    const silk = r.rows.find((x) => x.key === 'm1')!
    expect(silk.written).toBe(200_000)
    expect(silk.earned).toBeCloseTo(200_000 * 183 / 365, 1)
    expect(silk.incurred).toBe(40_000)
    expect(silk.lrWritten).toBeCloseTo(0.2)
    expect(silk.lrEarned).toBeCloseTo(40_000 / (200_000 * 183 / 365), 3)
    expect(r.rows[0].key).toBe('m2') // most incurred first
    expect(r.missingRate).toBe(2)
    expect(r.total.incurred).toBe(190_000)
    expect(r.total.lrWritten).toBeCloseTo(190_000 / 300_000)
  })

  it('by line and by underwriting year; no premium → no ratio', () => {
    expect(lossRatios([risk({})], [claim({ lob_code: 'ENG', lob_name: 'Engineering' })], 'lob', '2026-12-31').rows.find((x) => x.key === 'ENG')!.lrWritten).toBeNull()
    const years = lossRatios([risk({}), risk({ id: 'o', period_from: '2025-01-01', period_to: '2025-12-31' })], [claim({ underwriting_year: 2025 })], 'year', '2026-12-31')
    expect(years.rows.map((x) => x.key)).toEqual(['2026', '2025'])
    expect(years.rows[1].lrEarned).toBeCloseTo(0.3)
  })
})
