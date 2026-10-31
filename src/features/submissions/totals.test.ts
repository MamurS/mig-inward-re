import { describe, expect, it } from 'vitest'
import { STATUSES, type SubmissionStatus } from '@/lib/status'
import { registerTotals } from './totals'

const row = (status: SubmissionStatus, usd: number | null) => ({ status, our_gross_premium_usd: usd })

describe('registerTotals', () => {
  it('counts bound in the total and offered / no response as pending', () => {
    const t = registerTotals([row('bound', 100.1), row('bound', 200.2), row('offered', 50), row('no_response', 25)])
    expect(t).toEqual({ boundUsd: 300.3, pendingUsd: 75, boundCount: 2, pendingCount: 2 })
  })

  it('leaves NTU, declined, received and under review out of both', () => {
    const t = registerTotals([row('ntu', 1000), row('declined', 2000), row('received', 3000), row('under_review', 4000)])
    expect(t).toEqual({ boundUsd: 0, pendingUsd: 0, boundCount: 0, pendingCount: 0 })
  })

  it('sums every status into exactly one bucket or none', () => {
    const t = registerTotals(STATUSES.map((s) => row(s, 1)))
    expect(t.boundUsd).toBe(1)
    expect(t.pendingUsd).toBe(2)
  })

  it('treats a missing USD figure as zero', () => {
    expect(registerTotals([row('bound', null), row('offered', null)])).toEqual({ boundUsd: 0, pendingUsd: 0, boundCount: 1, pendingCount: 1 })
  })
})
