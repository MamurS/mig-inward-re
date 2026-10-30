/**
 * Reading an MGA's bordereau file into plain rows: Excel (.xlsx, every sheet)
 * or CSV (comma, semicolon or tab, quoted fields). Cells stay as the file has
 * them (text, number, date, boolean); mapping and checking happen in validate.ts.
 */

export type Cell = string | number | boolean | Date | null
export type SheetRows = { name: string; rows: Cell[][] }

export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const MAX_ROWS = 5000

export async function readTable(file: File): Promise<SheetRows[]> {
  if (file.size > MAX_FILE_BYTES) throw new Error('too-big')
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.txt') || file.type === 'text/csv') {
    return [{ name: file.name.replace(/\.[^.]+$/, ''), rows: parseCsv(await file.text()) }]
  }
  if (!name.endsWith('.xlsx')) throw new Error('bad-type')
  const { default: readXlsxFile } = await import('read-excel-file/browser')
  const sheets = await readXlsxFile(file)
  return sheets.map((s) => ({ name: s.sheet, rows: s.data.map((r) => r.map((c) => (c === undefined ? null : (c as Cell)))) }))
}

/** CSV with the delimiter guessed from the first line; "" escapes a quote; empty trailing lines dropped. */
export function parseCsv(text: string): Cell[][] {
  const src = text.replace(/^﻿/, '')
  const first = src.split(/\r?\n/, 1)[0] ?? ''
  const delim = [';', '\t', ','].map((d) => ({ d, n: countOutsideQuotes(first, d) })).sort((a, b) => b.n - a.n)[0]
  const sep = delim && delim.n > 0 ? delim.d : ','
  const rows: Cell[][] = []
  let row: Cell[] = []
  let field = ''
  let quoted = false
  let wasQuoted = false
  const push = () => {
    row.push(wasQuoted ? field : field.trim() === '' ? null : field.trim())
    field = ''
    wasQuoted = false
  }
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"' && field.trim() === '') {
      quoted = true
      wasQuoted = true
      field = ''
    } else if (ch === sep) push()
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      push()
      rows.push(row)
      row = []
    } else field += ch
  }
  if (field !== '' || row.length) {
    push()
    rows.push(row)
  }
  while (rows.length && rows[rows.length - 1].every((c) => c === null || c === '')) rows.pop()
  return rows
}

function countOutsideQuotes(line: string, d: string) {
  let n = 0
  let q = false
  for (const ch of line) {
    if (ch === '"') q = !q
    else if (ch === d && !q) n++
  }
  return n
}

/** The header row's titles (1-based row number), blank titles named by column letter. */
export function headersOf(rows: Cell[][], headerRow: number): string[] {
  const head = rows[headerRow - 1] ?? []
  const width = Math.max(head.length, ...rows.slice(headerRow, headerRow + 50).map((r) => r.length))
  return Array.from({ length: width }, (_, i) => {
    const v = head[i]
    const s = v instanceof Date ? v.toISOString().slice(0, 10) : v === null || v === undefined ? '' : String(v).trim()
    return s || columnLetter(i)
  })
}

export function columnLetter(i: number): string {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}
