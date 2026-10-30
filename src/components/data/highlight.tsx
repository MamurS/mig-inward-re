import type { ReactNode } from 'react'

/** Wraps every case-insensitive match of `query` (one string or several words) in a <mark>. */
export function highlight(text: string | null | undefined, query: string | string[] | undefined): ReactNode {
  if (!text) return text ?? null
  const needles = (Array.isArray(query) ? query : [query ?? ''])
    .map((q) => q.trim().toLocaleLowerCase())
    .filter(Boolean)
  if (!needles.length) return text
  const lower = text.toLocaleLowerCase()
  const out: ReactNode[] = []
  let from = 0
  for (;;) {
    // the earliest next match of any word (the longest one when two start together)
    let at = -1
    let len = 0
    for (const n of needles) {
      const i = lower.indexOf(n, from)
      if (i >= 0 && (at < 0 || i < at || (i === at && n.length > len))) {
        at = i
        len = n.length
      }
    }
    if (at < 0) break
    if (at > from) out.push(text.slice(from, at))
    out.push(<mark key={at} className="rounded-sm bg-warning-100 text-foreground">{text.slice(at, at + len)}</mark>)
    from = at + len
  }
  if (!out.length) return text
  if (from < text.length) out.push(text.slice(from))
  return out
}
