/**
 * Loss ratios (Phase 3 spec «Ratios»), our share, in USD:
 * - incurred = paid + outstanding − recoveries (claims_v.incurred_usd);
 * - written = our signed net premium of the bound risks (submissions_v.our_net_premium_usd);
 * - earned = written × the part of the risk period that has run (pro rata by day, 0…1);
 * - LR written = incurred / written, LR earned = incurred / earned — always labelled which.
 * Claims or risks with no USD figure (no FX rate yet) are left out and counted.
 */
const DAY = 86_400_000

/** The part of a period that has run on `asOf` (both ends inclusive), 0…1; null without a period. */
export function earnedFraction(from: string | null, to: string | null, asOf: string): number | null {
  if (!from || !to) return null
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  const t = Date.parse(`${asOf}T00:00:00Z`)
  if (!(b >= a)) return null
  const total = (b - a) / DAY + 1
  const run = Math.min(Math.max((t - a) / DAY + 1, 0), total)
  return run / total
}

export type RiskLite = {
  id: string
  status: string | null
  period_from: string | null
  period_to: string | null
  our_net_premium_usd: number | null
  mga_id: string | null
  mga_name: string | null
  lob_code: string | null
  lob_name: string | null
}
export type ClaimLite = { submission_id: string | null; incurred_usd: number | null; mga_id: string | null; mga_name: string | null; lob_code: string | null; lob_name: string | null; underwriting_year: number | null }

export type RatioRow = {
  key: string
  name: string
  written: number
  earned: number
  incurred: number
  claims: number
  lrWritten: number | null
  lrEarned: number | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Loss ratios grouped by MGA, line of business or underwriting year. */
export function lossRatios(risks: RiskLite[], claims: ClaimLite[], by: 'mga' | 'lob' | 'year', asOf: string) {
  const keyOfRisk = (r: RiskLite) =>
    by === 'mga' ? { key: r.mga_id ?? '-', name: r.mga_name ?? '—' } : by === 'lob' ? { key: r.lob_code ?? '-', name: r.lob_name ?? '—' } : { key: r.period_from?.slice(0, 4) ?? '-', name: r.period_from?.slice(0, 4) ?? '—' }
  const keyOfClaim = (c: ClaimLite) =>
    by === 'mga' ? { key: c.mga_id ?? '-', name: c.mga_name ?? '—' } : by === 'lob' ? { key: c.lob_code ?? '-', name: c.lob_name ?? '—' } : { key: c.underwriting_year ? String(c.underwriting_year) : '-', name: c.underwriting_year ? String(c.underwriting_year) : '—' }

  const rows = new Map<string, RatioRow>()
  const row = (k: { key: string; name: string }) => {
    let r = rows.get(k.key)
    if (!r) rows.set(k.key, (r = { key: k.key, name: k.name, written: 0, earned: 0, incurred: 0, claims: 0, lrWritten: null, lrEarned: null }))
    return r
  }
  let missingRate = 0
  for (const r of risks) {
    if (r.status !== 'bound') continue
    if (r.our_net_premium_usd === null) {
      missingRate++
      continue
    }
    const g = row(keyOfRisk(r))
    g.written = round2(g.written + r.our_net_premium_usd)
    g.earned = round2(g.earned + r.our_net_premium_usd * (earnedFraction(r.period_from, r.period_to, asOf) ?? 0))
  }
  for (const c of claims) {
    if (c.incurred_usd === null) {
      missingRate++
      continue
    }
    const g = row(keyOfClaim(c))
    g.incurred = round2(g.incurred + c.incurred_usd)
    g.claims++
  }
  const out = [...rows.values()].map((g) => ({
    ...g,
    lrWritten: g.written > 0 ? g.incurred / g.written : null,
    lrEarned: g.earned > 0 ? g.incurred / g.earned : null,
  }))
  out.sort((a, b) => (by === 'year' ? b.key.localeCompare(a.key) : b.incurred - a.incurred || b.written - a.written))
  const total = out.reduce(
    (t, g) => ({ written: round2(t.written + g.written), earned: round2(t.earned + g.earned), incurred: round2(t.incurred + g.incurred) }),
    { written: 0, earned: 0, incurred: 0 },
  )
  return {
    rows: out,
    total: { ...total, lrWritten: total.written > 0 ? total.incurred / total.written : null, lrEarned: total.earned > 0 ? total.incurred / total.earned : null },
    missingRate,
  }
}
