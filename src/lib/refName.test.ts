import { describe, expect, it } from 'vitest'
import { pickName } from './refName'

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
