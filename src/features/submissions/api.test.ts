import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LIST_COLUMNS } from './api'

describe('LIST_COLUMNS', () => {
  it('is every column of submissions_v except search_text', () => {
    const types = readFileSync('src/lib/database.types.ts', 'utf8')
    const start = types.indexOf('      submissions_v: {')
    const row = types.slice(types.indexOf('Row: {', start) + 6, types.indexOf('}', types.indexOf('Row: {', start)))
    const viewColumns = [...row.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]).filter((c) => c !== 'search_text')
    expect(LIST_COLUMNS.split(',').map((c) => c.trim()).sort()).toEqual(viewColumns.sort())
  })
})
