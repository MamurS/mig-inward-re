import { describe, expect, it, vi } from 'vitest'

const lang = vi.hoisted(() => ({ current: 'ru' }))
vi.mock('@/i18n', () => ({ default: { get resolvedLanguage() { return lang.current } } }))
const { formatDateInput, parseDateInput, formatMonthYear, weekdaysShort } = await import('./format')

describe('the app date field', () => {
  it('shows ISO dates the way the UI language writes them', () => {
    lang.current = 'ru'
    expect(formatDateInput('2027-12-31')).toBe('31.12.2027')
    lang.current = 'uz'
    expect(formatDateInput('2027-12-31')).toBe('31.12.2027')
    lang.current = 'en'
    expect(formatDateInput('2027-12-31')).toBe('31/12/2027')
    expect(formatDateInput('')).toBe('')
    expect(formatDateInput(null)).toBe('')
  })

  it('takes typed dates day first, and ISO', () => {
    expect(parseDateInput('31.12.2027')).toBe('2027-12-31')
    expect(parseDateInput('31/12/2027')).toBe('2027-12-31')
    expect(parseDateInput('1-2-2027')).toBe('2027-02-01')
    expect(parseDateInput(' 5.3.27 ')).toBe('2027-03-05')
    expect(parseDateInput('2027-12-31')).toBe('2027-12-31')
  })

  it('refuses what is not a real date', () => {
    for (const s of ['', '31.02.2027', '00.01.2027', '12.13.2027', '2027-02-30', '31.12', 'tomorrow', '1.1.1800']) expect(parseDateInput(s)).toBeNull()
    expect(parseDateInput('29.02.2028')).toBe('2028-02-29')
  })

  it('names months and weekdays in the UI language, Monday first', () => {
    lang.current = 'uz'
    expect(formatMonthYear(2026, 9)).toBe('Oktabr 2026')
    expect(weekdaysShort()).toEqual(['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'])
    lang.current = 'en'
    expect(formatMonthYear(2026, 9)).toBe('October 2026')
    expect(weekdaysShort()[0]).toBe('Mo')
    lang.current = 'ru'
    expect(formatMonthYear(2026, 9)).toMatch(/^Октябрь 2026$/)
    expect(weekdaysShort()[0]).toBe('Пн')
  })
})
