/**
 * Fuzzy matching for names read from a document: which counterparty is the
 * «Caspian Specialty MGA LLP» on the slip, and is this risk already in the
 * register? Pure functions — no React, no Supabase.
 */

/** Legal forms and filler words that do not tell companies apart (EN / RU / UZ, Latin and Cyrillic). */
const NOISE = new Set([
  'llc', 'llp', 'ltd', 'limited', 'inc', 'plc', 'jsc', 'ojsc', 'cjsc', 'pjsc', 'ao', 'oao', 'zao', 'pao', 'ooo', 'mchj', 'aj', 'qk', 'xk',
  'ооо', 'оао', 'зао', 'пао', 'ао', 'ип', 'мчж', 'аж', 'co', 'company', 'corp', 'corporation', 'group', 'the', 'of', 'and', '&',
])

/** Lower case, Cyrillic transliterated, punctuation and legal forms dropped. */
export function normName(s: string): string {
  const t = translit(s.toLowerCase())
    .replace(/[«»"'`’‘“”.,()/\\-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !NOISE.has(w))
  return t.join(' ')
}

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's',
  т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
}
function translit(s: string) {
  // legal forms in Cyrillic stay recognisable before transliteration
  return s.replace(/\b(ооо|оао|зао|пао|ао|ип|мчж|аж)\b/gu, ' ').replace(/[а-яёўқғҳ]/g, (c) => CYR[c] ?? c)
}

function trigrams(s: string): Set<string> {
  const p = `  ${s} `
  const out = new Set<string>()
  for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3))
  return out
}

/** 0…1: trigram overlap (Dice) of the normalised names, lifted when one name's words all appear in the other. */
export function similarity(a: string, b: string): number {
  const x = normName(a)
  const y = normName(b)
  if (!x || !y) return 0
  if (x === y) return 1
  const ta = trigrams(x)
  const tb = trigrams(y)
  let common = 0
  for (const g of ta) if (tb.has(g)) common++
  const dice = (2 * common) / (ta.size + tb.size)
  const wa = x.split(' ')
  const wb = y.split(' ')
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa]
  const contained = short.every((w) => long.some((v) => v === w || (w.length >= 4 && v.startsWith(w))))
  return contained ? Math.max(dice, 0.85) : dice
}

export type Party = { id: string; name: string; type: string; active?: boolean | null }
export type PartyMatch = { party: Party; score: number }

/** The counterparties of this type a name most likely means, best first (score ≥ 0.45). */
export function matchParty(name: string | null | undefined, parties: Party[], type: string, limit = 3): PartyMatch[] {
  if (!name?.trim()) return []
  return parties
    .filter((p) => p.type === type)
    .map((p) => ({ party: p, score: similarity(name, p.name) }))
    .filter((m) => m.score >= 0.45)
    .sort((a, b) => b.score - a.score || a.party.name.localeCompare(b.party.name))
    .slice(0, limit)
}

/** A match good enough to fill the field by itself. */
export const SURE_MATCH = 0.8

export type Existing = { id: string; ref_no: string | null; insured_name: string | null; mga_id: string | null; period_from: string | null; status: string | null }
export type Duplicate = { row: Existing; score: number; reasons: ('name' | 'mga' | 'period')[] }

/** Submissions that look like this one: a similar insured, and the same MGA or an overlapping year. */
export function findDuplicates(c: { insured_name: string | null; mga_id: string | null; period_from: string | null }, rows: Existing[]): Duplicate[] {
  if (!c.insured_name?.trim()) return []
  const out: Duplicate[] = []
  for (const r of rows) {
    const name = similarity(c.insured_name, r.insured_name ?? '')
    if (name < 0.6) continue
    const reasons: Duplicate['reasons'] = ['name']
    let score = name
    if (c.mga_id && r.mga_id === c.mga_id) {
      reasons.push('mga')
      score += 0.2
    }
    if (c.period_from && r.period_from && Math.abs(Date.parse(c.period_from) - Date.parse(r.period_from)) <= 120 * 86_400_000) {
      reasons.push('period')
      score += 0.2
    }
    if (reasons.length >= 2 || name >= 0.9) out.push({ row: r, score: Math.min(1, score), reasons })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5)
}

/** The longest word of a name (for a cheap ilike pre-filter in the database). */
export function keyWord(name: string): string | null {
  const words = normName(name).split(' ').filter((w) => w.length >= 4)
  return words.sort((a, b) => b.length - a.length)[0] ?? null
}

/** «high» ≥ 0.8, «medium» ≥ 0.5, else «low». */
export function confidenceLevel(c: number): 'high' | 'medium' | 'low' {
  return c >= 0.8 ? 'high' : c >= 0.5 ? 'medium' : 'low'
}
