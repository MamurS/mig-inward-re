/** A reference row with its names (lines of business, countries, currencies). */
export type Named = { name: string; name_ru?: string | null; name_uz?: string | null }

/** A line of business also has short names, for tables, chips and charts. */
export type ShortNamed = Named & { short_name?: string | null; short_name_ru?: string | null; short_name_uz?: string | null }

/** The RU / UZ name of a reference row in that language; the English name when it is empty (or for EN). */
export function pickName(row: Named | undefined | null, lang: string | undefined) {
  if (!row) return '—'
  if (lang === 'ru' && row.name_ru?.trim()) return row.name_ru
  if (lang === 'uz' && row.name_uz?.trim()) return row.name_uz
  return row.name
}

/**
 * The short name for tables, chips and charts: in the UI language, else the
 * English short name, else the full name (pickName). The full name goes in
 * forms, detail pages and the tooltip (title=) of a short name.
 */
export function pickShortName(row: ShortNamed | undefined | null, lang: string | undefined) {
  if (!row) return '—'
  if (lang === 'ru' && row.short_name_ru?.trim()) return row.short_name_ru
  if (lang === 'uz' && row.short_name_uz?.trim()) return row.short_name_uz
  if (row.short_name?.trim()) return row.short_name
  return pickName(row, lang)
}
