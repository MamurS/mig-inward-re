import { describe, expect, it } from 'vitest'
import { confidenceLevel, findDuplicates, keyWord, matchParty, normName, similarity } from './match'

const parties = [
  { id: 'm1', name: 'Silk Road Underwriting Agency', type: 'mga' },
  { id: 'm2', name: 'Caspian Specialty MGA', type: 'mga' },
  { id: 'm3', name: 'Meridian Risk Partners', type: 'mga' },
  { id: 'b1', name: 'Tashkent Re Brokers', type: 'broker' },
  { id: 'b2', name: 'Gulf Placement Partners', type: 'broker' },
]

describe('names', () => {
  it('drops legal forms, punctuation and case; transliterates Cyrillic', () => {
    expect(normName('«Caspian Specialty MGA» LLP')).toBe('caspian specialty mga')
    expect(normName('ООО "Ташкент Ре Брокерс"')).toBe('tashkent re brokers')
    expect(normName('Navoiyazot JSC')).toBe('navoiyazot')
  })
  it('scores the same company high and different ones low', () => {
    expect(similarity('Caspian Specialty MGA LLP', 'Caspian Specialty MGA')).toBe(1)
    expect(similarity('Caspian Specialty', 'Caspian Specialty MGA')).toBeGreaterThanOrEqual(0.85)
    expect(similarity('Silk Road Underwriting', 'Silk Road Underwriting Agency')).toBeGreaterThanOrEqual(0.85)
    expect(similarity('Caspian Specialty MGA', 'Meridian Risk Partners')).toBeLessThan(0.3)
    expect(similarity('', 'x')).toBe(0)
  })
})

describe('matchParty', () => {
  it('finds the MGA a slip names, only among MGAs', () => {
    const m = matchParty('CASPIAN SPECIALTY MGA, LLP (Almaty)', parties, 'mga')
    expect(m[0].party.id).toBe('m2')
    expect(m[0].score).toBeGreaterThanOrEqual(0.8)
    expect(matchParty('Tashkent Re Brokers', parties, 'mga')).toEqual([])
  })
  it('finds a broker written in Russian', () => {
    expect(matchParty('ООО «Ташкент Ре Брокерс»', parties, 'broker')[0].party.id).toBe('b1')
  })
  it('returns nothing for an unknown name', () => {
    expect(matchParty('Andijan Mutual Insurance', parties, 'mga')).toEqual([])
    expect(matchParty(null, parties, 'mga')).toEqual([])
  })
})

describe('findDuplicates', () => {
  const rows = [
    { id: 's1', ref_no: 'SUB-2026-0001', insured_name: 'Navoiyazot Chemical Plant', mga_id: 'm1', period_from: '2026-01-01', status: 'bound' },
    { id: 's2', ref_no: 'SUB-2026-0002', insured_name: 'Tashkent City Mall', mga_id: 'm1', period_from: '2025-03-01', status: 'bound' },
    { id: 's3', ref_no: 'SUB-2025-0009', insured_name: 'Navoiyazot Chemical Plant', mga_id: 'm2', period_from: '2024-01-01', status: 'declined' },
  ]
  it('flags the same insured with the same MGA or an overlapping year', () => {
    const d = findDuplicates({ insured_name: 'JSC Navoiyazot Chemical Plant', mga_id: 'm1', period_from: '2026-02-01' }, rows)
    expect(d.map((x) => x.row.id)).toEqual(['s1', 's3'])
    expect(d[0].reasons).toEqual(['name', 'mga', 'period'])
  })
  it('ignores different insureds', () => {
    expect(findDuplicates({ insured_name: 'Samarkand Textile', mga_id: 'm1', period_from: '2026-01-01' }, rows)).toEqual([])
    expect(findDuplicates({ insured_name: null, mga_id: 'm1', period_from: null }, rows)).toEqual([])
  })
})

describe('helpers', () => {
  it('picks the longest word for a pre-filter and labels confidence', () => {
    expect(keyWord('JSC Navoiyazot Chemical Plant')).toBe('navoiyazot')
    expect(keyWord('ab')).toBeNull()
    expect([0.95, 0.8, 0.6, 0.2].map(confidenceLevel)).toEqual(['high', 'high', 'medium', 'low'])
  })
})
