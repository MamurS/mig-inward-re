/**
 * Search normalisation — the browser half of public.search_norm() (migration
 * …_search_text.sql). Both lower-case, map accented Latin letters and the
 * Uzbek / Russian letters with marks to their base letter, and drop every
 * apostrophe form (Uzbek oʻ / gʻ, ’, ', `), so «Koʻrib», «Ko'rib» and «korib»
 * meet. The two character lists below are copied verbatim into the SQL
 * translate(); normalize.test.ts fails if they drift apart.
 */
export const NORM_FROM = 'àáâãäåāăąçćčďđèéêëēėęěğìíîïīıįłñńňòóôõöøōőřśşšșțţťùúûüūůűųýÿžźżёўқғҳ'
export const NORM_TO = 'aaaaaaaaacccddeeeeeeeegiiiiiiilnnnoooooooorsssstttuuuuuuuuyyzzzеукгх'
/** Removed entirely (translate() deletes characters that have no partner). */
export const NORM_DROP = "ʻʼ‘’'`´"

const MAP = new Map<string, string>()
for (let i = 0; i < NORM_FROM.length; i++) MAP.set(NORM_FROM[i], NORM_TO[i])
const DROP = new Set(NORM_DROP)

export function norm(s: string | null | undefined): string {
  if (!s) return ''
  let out = ''
  for (const ch of s.toLowerCase()) {
    if (DROP.has(ch)) continue
    out += MAP.get(ch) ?? ch
  }
  return out
}

/** For whole-name comparisons: normalised, without spaces, underscores and hyphens. */
export function compact(s: string | null | undefined): string {
  return norm(s).replace(/[\s_\-.]+/g, '')
}
