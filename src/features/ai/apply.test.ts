import { describe, expect, it } from 'vitest'
import { defaultPicks, toSuggestions, type AiSubmission } from './apply'

const lists = {
  lobs: [{ id: 'lob-cargo', code: 'CARGO', name: 'Marine Cargo' }, { id: 'lob-prop', code: 'PROP', name: 'Property' }],
  countries: [{ code: 'UZ' }, { code: 'KZ' }],
  currencies: [{ code: 'USD' }, { code: 'EUR' }],
  parties: [
    { id: 'm2', name: 'Caspian Specialty MGA', type: 'mga', active: true },
    { id: 'b1', name: 'Tashkent Re Brokers', type: 'broker', active: true },
    { id: 'b9', name: 'Old Broker', type: 'broker', active: false },
  ],
}
const f = (value: string | null, confidence = 0.9, source: string | null = value) => ({ value, confidence, source })

describe('toSuggestions', () => {
  const ai: AiSubmission = {
    notes: [],
    fields: {
      insured_name: f('Almalyk MMC'),
      insured_country: f('uz'),
      mga_name: f('CASPIAN SPECIALTY MGA LLP', 0.95),
      broker_name: f('Somebody Unknown Brokers'),
      lob_code: f('cargo'),
      period_from: f('2026-01-01'),
      period_to: f('31.12.2026'),
      currency: f('usd'),
      sum_insured_100: f('40,000,000'),
      gross_premium_100: f('410 000.50', 0.4),
      commission_pct: f('27.5%'),
      written_share_pct: f('120'),
      payment_terms_days: f('60'),
      deductible: f(null, 0),
      insured_country_extra: f('ignored'),
    },
  }
  const s = toSuggestions(ai, lists)
  const by = (k: string) => s.find((x) => x.form === k)!

  it('checks values against the system’s lists', () => {
    expect(by('insured_country').value).toBe('UZ')
    expect(by('currency').value).toBe('USD')
    expect(by('lob_id')).toMatchObject({ value: 'lob-cargo', display: 'CARGO · Marine Cargo' })
  })
  it('matches the MGA by name and never guesses a broker', () => {
    expect(by('mga_id')).toMatchObject({ value: 'm2', display: 'Caspian Specialty MGA', problem: null })
    expect(by('mga_id').confidence).toBeGreaterThan(0.8)
    expect(by('broker_id')).toMatchObject({ value: '', problem: 'noMatch' })
  })
  it('keeps exact numbers and refuses what does not fit', () => {
    expect(by('sum_insured_100').value).toBe('40000000')
    expect(by('gross_premium_100').value).toBe('410000.50')
    expect(by('commission_pct').value).toBe('27.5')
    expect(by('written_share_pct')).toMatchObject({ value: '', problem: 'badNumber' })
    expect(by('period_to')).toMatchObject({ value: '', problem: 'badDate', raw: '31.12.2026' })
    expect(by('payment_terms_days').value).toBe('60')
  })
  it('leaves out empty fields and fields it does not know', () => {
    expect(s.find((x) => x.form === 'deductible')).toBeUndefined()
    expect(s).toHaveLength(13)
  })
  it('ticks by default only usable values of at least medium confidence', () => {
    const picks = defaultPicks(s)
    expect(picks.has('insured_name')).toBe(true)
    expect(picks.has('gross_premium_100')).toBe(false) // 0.4
    expect(picks.has('broker_id')).toBe(false) // no match
    expect(picks.has('period_to')).toBe(false) // bad date
  })
})
