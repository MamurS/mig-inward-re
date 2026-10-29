import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('keeps a type-scale size next to a text colour', () => {
    expect(cn('text-headline text-foreground')).toBe('text-headline text-foreground')
    expect(cn('text-body text-muted-foreground', 'text-danger-700')).toBe('text-body text-danger-700')
  })
  it('lets a later size win over an earlier one', () => {
    expect(cn('text-caption', 'text-title')).toBe('text-title')
  })
})
