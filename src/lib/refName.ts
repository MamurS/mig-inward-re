/** A reference row with its names (lines of business, countries, currencies). */
export type Named = { name: string; name_ru?: string | null; name_uz?: string | null }

/** The RU / UZ name of a reference row in that language; the English name when it is empty (or for EN). */
export function pickName(row: Named | undefined | null, lang: string | undefined) {
  if (!row) return '—'
  if (lang === 'ru' && row.name_ru?.trim()) return row.name_ru
  if (lang === 'uz' && row.name_uz?.trim()) return row.name_uz
  return row.name
}

