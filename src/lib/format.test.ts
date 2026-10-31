import { afterEach, describe, expect, it, vi } from 'vitest'

const lang = vi.hoisted(() => ({ resolvedLanguage: 'ru' }))
vi.mock('@/i18n', () => ({ default: lang }))
const { compactNumber, formatAmount, formatHuman, formatNumber, formatPct } = await import('./format')

/** Intl writes a narrow no-break space between groups and before units in some locales; compare on plain spaces. */
const plain = (s: string) => s.replace(/[  ]/g, ' ')

describe('compactNumber', () => {
  it('always shows two decimals once a figure is scaled', () => {
    expect(plain(compactNumber(12_000, 'ru-RU'))).toBe('12,00 тыс.')
    expect(plain(compactNumber(83_012, 'ru-RU'))).toBe('83,01 тыс.')
    expect(plain(compactNumber(1_250_000, 'ru-RU'))).toBe('1,25 млн')
    expect(compactNumber(1_400, 'en-GB')).toBe('1.40K')
    expect(compactNumber(2_000_000, 'en-GB')).toBe('2.00M')
    expect(plain(compactNumber(65_680, 'uz-Latn-UZ'))).toBe('65,68 ming')
  })
  it('keeps small figures as they are (up to two decimals)', () => {
    expect(compactNumber(0, 'ru-RU')).toBe('0')
    expect(compactNumber(512.5, 'en-GB')).toBe('512.5')
  })
  it('a figure that rounds up to a thousand is scaled with decimals too', () => {
    expect(compactNumber(999.999, 'en-GB')).toBe('1.00K')
  })
  it('negative figures keep the format', () => {
    expect(compactNumber(-12_000, 'en-GB')).toBe('-12.00K')
  })
})

describe('formatHuman', () => {
  it('uses the interface language', () => {
    expect(plain(formatHuman(12_000))).toBe('12,00 тыс.')
  })
})

describe('Uzbek numbers (written the Russian way)', () => {
  afterEach(() => {
    lang.resolvedLanguage = 'ru'
  })
  it('scales with Uzbek words, comma decimals and space thousands', () => {
    expect(plain(compactNumber(83_012, 'uz-Latn-UZ'))).toBe('83,01 ming')
    expect(plain(compactNumber(1_250_000, 'uz-Latn-UZ'))).toBe('1,25 mln')
    expect(plain(compactNumber(2_500_000_000, 'uz-Latn-UZ'))).toBe('2,50 mlrd')
    expect(plain(compactNumber(3_000_000_000_000, 'uz-Latn-UZ'))).toBe('3,00 trln')
    expect(plain(compactNumber(-12_000, 'uz-Latn-UZ'))).toBe('-12,00 ming')
    expect(plain(compactNumber(512.5, 'uz-Latn-UZ'))).toBe('512,5')
  })
  it('a figure that rounds up to the next scale moves to it', () => {
    expect(plain(compactNumber(999.999, 'uz-Latn-UZ'))).toBe('1,00 ming')
    expect(plain(compactNumber(999_999, 'uz-Latn-UZ'))).toBe('1,00 mln')
  })
  it('amounts, percents and plain figures in the interface language', () => {
    lang.resolvedLanguage = 'uz'
    expect(plain(formatAmount(1234.378))).toBe('1 234,38')
    expect(plain(formatAmount('1234567.5'))).toBe('1 234 567,50')
    expect(plain(formatHuman(83_012))).toBe('83,01 ming')
    expect(plain(formatPct(12.5))).toBe('12,5 %')
    expect(plain(formatNumber(0.25, { style: 'percent' }))).toBe('25 %')
    expect(plain(formatNumber(1.5, { minimumFractionDigits: 1 }))).toBe('1,5')
  })
  it('matches the Russian format', () => {
    lang.resolvedLanguage = 'ru'
    const ru = [formatAmount(1234.378), formatPct(7.25)]
    lang.resolvedLanguage = 'uz'
    expect([formatAmount(1234.378), formatPct(7.25)]).toEqual(ru)
  })
})
