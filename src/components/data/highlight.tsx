import type { ReactNode } from 'react'

/** Wraps every case-insensitive match of `query` in a <mark>. */
export function highlight(text: string | null | undefined, query: string | undefined): ReactNode {
  if (!text) return text ?? null
  const q = query?.trim()
  if (!q) return text
  const lower = text.toLocaleLowerCase()
  const needle = q.toLocaleLowerCase()
  const out: ReactNode[] = []
  let from = 0
  for (let at = lower.indexOf(needle); at >= 0; at = lower.indexOf(needle, from)) {
    if (at > from) out.push(text.slice(from, at))
    out.push(<mark key={at} className="rounded-sm bg-warning-100 text-foreground">{text.slice(at, at + needle.length)}</mark>)
    from = at + needle.length
  }
  if (!out.length) return text
  if (from < text.length) out.push(text.slice(from))
  return out
}
