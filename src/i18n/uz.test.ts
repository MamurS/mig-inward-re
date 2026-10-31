import { describe, expect, it } from 'vitest'
import uz from '@/locales/uz.json'
import { LANGUAGES } from './index'

/** Every string in a locale tree, with its key path. */
function strings(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') return [[path, node]]
  if (node && typeof node === 'object') return Object.entries(node).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k))
  return []
}

describe('Uzbek spelling', () => {
  it('writes oʻ / gʻ with ʻ (U+02BB), never with a straight or curly apostrophe or a backtick', () => {
    const wrong = strings(uz).filter(([, s]) => /[oOgG]['‘’`ʼ´](?=\p{L})/u.test(s))
    expect(wrong.map(([k, s]) => `${k}: ${s}`)).toEqual([])
  })
  it('the language menu says Oʻzbekcha', () => {
    expect(LANGUAGES.find((l) => l.code === 'uz')?.label).toBe('Oʻzbekcha')
  })
})
