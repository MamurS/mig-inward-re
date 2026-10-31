import { describe, expect, it } from 'vitest'
import { pickName, pickShortName } from './refName'

describe('pickName', () => {
  const lob = { name: 'Property', name_ru: 'Имущество', name_uz: 'Mulk' }
  it('names a reference row in the UI language', () => {
    expect(pickName(lob, 'ru')).toBe('Имущество')
    expect(pickName(lob, 'uz')).toBe('Mulk')
    expect(pickName(lob, 'en')).toBe('Property')
  })
  it('falls back to English when the RU / UZ name is empty or missing', () => {
    expect(pickName({ name: 'Euro', name_ru: null, name_uz: '  ' }, 'ru')).toBe('Euro')
    expect(pickName({ name: 'Euro', name_ru: null, name_uz: '  ' }, 'uz')).toBe('Euro')
    expect(pickName({ name: 'Euro' }, 'ru')).toBe('Euro')
  })
  it('shows a dash for no row', () => {
    expect(pickName(undefined, 'ru')).toBe('—')
  })
})

describe('pickShortName', () => {
  const eng = {
    name: 'Engineering & Construction', name_ru: 'Строительно-монтажные риски', name_uz: 'Muhandislik va qurilish',
    short_name: 'Engineering', short_name_ru: 'Строительство', short_name_uz: 'Qurilish',
  }
  it('takes the short name in the UI language', () => {
    expect(pickShortName(eng, 'ru')).toBe('Строительство')
    expect(pickShortName(eng, 'uz')).toBe('Qurilish')
    expect(pickShortName(eng, 'en')).toBe('Engineering')
  })
  it('falls back to the English short name when the RU / UZ one is empty', () => {
    const row = { ...eng, short_name_ru: null, short_name_uz: ' ' }
    expect(pickShortName(row, 'ru')).toBe('Engineering')
    expect(pickShortName(row, 'uz')).toBe('Engineering')
  })
  it('then to the full name in the UI language (and its English fallback)', () => {
    const row = { ...eng, short_name: null, short_name_ru: null, short_name_uz: '' }
    expect(pickShortName(row, 'ru')).toBe('Строительно-монтажные риски')
    expect(pickShortName(row, 'en')).toBe('Engineering & Construction')
    expect(pickShortName({ name: 'Cyber', name_uz: null }, 'uz')).toBe('Cyber')
  })
  it('shows a dash for no row', () => {
    expect(pickShortName(null, 'en')).toBe('—')
  })
})
