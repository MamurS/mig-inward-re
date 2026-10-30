import { describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n', () => ({ default: { resolvedLanguage: 'ru' } }))
const { compactNumber, formatHuman } = await import('./format')

/** Intl writes a narrow no-break space between groups and before units in some locales; compare on plain spaces. */
const plain = (s: string) => s.replace(/[  ]/g, ' ')

describe('compactNumber', () => {
  it('always shows two decimals once a figure is scaled', () => {
    expect(plain(compactNumber(12_000, 'ru-RU'))).toBe('12,00 тыс.')
    expect(plain(compactNumber(83_012, 'ru-RU'))).toBe('83,01 тыс.')
    expect(plain(compactNumber(1_250_000, 'ru-RU'))).toBe('1,25 млн')
    expect(compactNumber(1_400, 'en-GB')).toBe('1.40K')
    expect(compactNumber(2_000_000, 'en-GB')).toBe('2.00M')
    expect(plain(compactNumber(65_680, 'uz-Latn-UZ'))).toMatch(/^65,68 /)
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
