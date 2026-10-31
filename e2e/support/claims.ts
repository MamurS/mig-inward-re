/**
 * Claims for the offline mock: seed claims (real and demo), the database
 * rules the screens rely on (numbering, signed line, coverage check, status
 * rules, large loss, cash-call closing, offset payments through the receipt
 * rules) and the two views computed on read.
 */
import { USERS } from './fixtures'
import { createReceipt } from './premium'

type Row = Record<string, unknown>
const DAY = 86_400_000
const today = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10)
const d = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10)
const n = (v: unknown) => Number(v ?? 0)
const r2 = (x: number) => Math.round(x * 100) / 100
let seq = 0
const uid = (p: string) => `${p}-0000-4000-8000-${String(++seq).padStart(12, '0')}`
const ADMIN = USERS.admin.id
const nameOf = (id: unknown) => Object.values(USERS).find((u) => u.id === id)?.full_name ?? null

export const LARGE_LOSS_USD = 250_000

/**
 * Claims seed on the fixture risks: an open fire claim with history, a large loss with a cash call, a closed one, a EUR one, a cyber one
 * (appended last: the ids above stay stable), a demo one. Calibrated like the demo seed (docs/decisions.md row 37): loss ratios per MGA
 * 20–90 % written and earned, Silk Road ≈ 65 % / ≈ 120 % (the large loss).
 */
export function claimsSeed(subs: Row[]) {
  seq = 0 // stable ids: the fire claim is 80000000-…-000000000001
  const by = (insured: string) => subs.find((s) => s.insured_name === insured)!
  const claims: Row[] = []
  const reserves: Row[] = []
  const payments: Row[] = []
  const recoveries: Row[] = []
  const followUps: Row[] = []
  const counters: Record<string, number> = {}
  const claim = (sub: Row, c: Row) => {
    const scope = `${sub.is_demo ? 'DEMO-' : ''}CLM-${String(c.notified_date).slice(0, 4)}`
    counters[scope] = (counters[scope] ?? 0) + 1
    const row: Row = {
      id: uid('80000000'), claim_no: `${scope}-${String(counters[scope]).padStart(4, '0')}`, submission_id: sub.id, currency: sub.currency,
      signed_share_pct: sub.signed_share_pct, status: 'open', decline_reason: null, close_comment: null, handler_id: ADMIN, large_loss: false,
      large_loss_at: null, coverage_issues: [], coverage_comment: null, notes: null, cause: null, location: null, description: null, cedent_claim_ref: null,
      estimate_100: null, status_changed_at: new Date().toISOString(), created_at: new Date().toISOString(), created_by: ADMIN, updated_at: new Date().toISOString(),
      updated_by: null, is_demo: Boolean(sub.is_demo), ...c,
    }
    claims.push(row)
    return row
  }
  const reserve = (c: Row, daysAgo: number, amount: number, reason: string) =>
    reserves.push({ id: uid('81000000'), claim_id: c.id, movement_date: d(daysAgo), amount, reason, entered_by: ADMIN, created_at: new Date().toISOString() })
  const pay = (c: Row, daysAgo: number, amount: number, type: string, ref: string) =>
    payments.push({ id: uid('82000000'), claim_id: c.id, payment_date: d(daysAgo), currency: c.currency, amount, type, payee_id: null, method: 'cash', bank_reference: ref, notes: null, offset_receipt_id: null, entered_by: USERS.finance.id, created_at: new Date().toISOString() })

  const fire = claim(by('Navoiyazot Chemical Plant'), { notified_date: d(210), date_of_loss: d(215), cause: 'Fire', location: 'Ammonia unit 2, Navoi', description: 'Fire in the compressor hall', cedent_claim_ref: 'SRU-CL-2026-014', estimate_100: 300_000 })
  reserve(fire, 205, 14_000, 'Initial reserve per loss advice')
  reserve(fire, 160, 4_000, 'Adjuster report: business interruption extended')
  pay(fire, 100, 11_000, 'indemnity', 'SWIFT CLP-0001')

  const hull = claim(by('Emirates Aviation Services Hull'), { notified_date: d(28), date_of_loss: d(30), cause: 'Hard landing', location: 'Sharjah', cedent_claim_ref: 'GPP-H-0911', estimate_100: 5_600_000, large_loss: true, large_loss_at: new Date().toISOString() })
  reserve(hull, 25, 60_000, 'Initial reserve: first cash calls, repair estimate awaited')
  pay(hull, 10, 35_000, 'cash_call', 'SWIFT CLP-0002')
  followUps.push({ id: uid('83000000'), entity_type: 'claim', entity_id: hull.id, type: 'cash_call_due', title: 'Cash call: USD 25,000 to the MGA', due_at: new Date(Date.now() + 5 * DAY).toISOString(), assigned_to: null, assigned_role: 'finance', done_at: null, done_by: null, outcome: null, created_at: new Date().toISOString(), created_by: ADMIN })
  for (const role of ['management', 'admin']) {
    followUps.push({ id: uid('83000000'), entity_type: 'claim', entity_id: hull.id, type: 'large_loss', title: 'Large loss', due_at: new Date(Date.now() - DAY).toISOString(), assigned_to: null, assigned_role: role, done_at: null, done_by: null, outcome: null, created_at: new Date().toISOString(), created_by: ADMIN })
  }

  const flood = claim(by('Tashkent City Mall'), { notified_date: d(98), date_of_loss: d(100), cause: 'Flood', location: 'Basement parking', cedent_claim_ref: 'TRB-2026-077', estimate_100: 40_000, status: 'closed' })
  reserve(flood, 95, 4_000, 'Reserve per loss adjuster')
  pay(flood, 60, 4_000, 'indemnity', 'SWIFT CLP-0003')

  const credit = claim(by('Georgian Mineral Water Exporters Credit'), { notified_date: d(38), date_of_loss: d(40), cause: 'Buyer insolvency', location: 'Hamburg', cedent_claim_ref: 'MRP-TC-2026-5', estimate_100: 32_000 })
  reserve(credit, 35, 4_800, 'Reserve: insured debt, our share')
  recoveries.push({ id: uid('84000000'), claim_id: credit.id, recovery_date: d(10), type: 'salvage', amount: 400, notes: 'Unsold stock recovered', entered_by: ADMIN, created_at: new Date().toISOString() })

  const demo = claim(by('DEMO Izmir Port Logistics Centre'), { notified_date: d(45), date_of_loss: d(50), cause: 'Roof collapse', location: 'Warehouse B', estimate_100: 95_000 })
  reserve(demo, 40, 9_500, 'Initial reserve')

  const cyber = claim(by('Kazakh Telecom Cyber Programme'), { notified_date: d(70), date_of_loss: d(72), cause: 'Data breach', location: 'Almaty data centre', cedent_claim_ref: 'GPP-CY-0031', estimate_100: 400_000 })
  reserve(cyber, 65, 28_000, 'Reserve: forensics, notification and liability')
  pay(cyber, 30, 12_000, 'indemnity', 'SWIFT CLP-0005')

  return { claims, claim_reserves: reserves, claim_payments: payments, claim_recoveries: recoveries, claimFollowUps: followUps }
}

/** claims_v and claim_payments_v, as the database computes them. */
export function claimViews(db: Record<string, Row[]>, fxRate: (ccy: string, date: string) => number | null) {
  const t = today()
  const subs = db.submissions_v ?? []
  const cps = db.counterparties ?? []
  const sum = (rows: Row[], id: unknown) => rows.filter((x) => x.claim_id === id).reduce((s, x) => s + n(x.amount), 0)
  const claims_v = (db.claims ?? []).map((c) => {
    const s = subs.find((x) => x.id === c.submission_id) ?? {}
    const reserves = r2(sum(db.claim_reserves ?? [], c.id))
    const paid = r2(sum(db.claim_payments ?? [], c.id))
    const rec = r2(sum(db.claim_recoveries ?? [], c.id))
    const lastReserve = (db.claim_reserves ?? []).filter((x) => x.claim_id === c.id).map((x) => String(x.movement_date)).sort().at(-1) ?? null
    const cash = (db.follow_ups ?? []).filter((f) => f.entity_type === 'claim' && f.entity_id === c.id && f.type === 'cash_call_due' && !f.done_at).map((f) => String(f.due_at)).sort()[0] ?? null
    const rate = fxRate(String(c.currency), t)
    const usd = (v: number) => (rate === null ? null : r2(v * rate))
    const estimateShare = r2(n(c.estimate_100) * n(c.signed_share_pct) / 100)
    const lob = (db.lines_of_business ?? []).find((l) => l.id === s.lob_id)
    return {
      ...c, ref_no: s.ref_no, insured_name: s.insured_name, mga_id: s.mga_id, mga_name: s.mga_name, broker_id: s.broker_id, broker_name: s.broker_name,
      lob_id: s.lob_id, lob_code: s.lob_code, lob_name: s.lob_name, underwriter_id: s.underwriter_id, underwriter_name: s.underwriter_name,
      period_from: s.period_from, period_to: s.period_to, underwriting_year: s.period_from ? Number(String(s.period_from).slice(0, 4)) : null,
      handler_name: nameOf(c.handler_id), estimate_our_share: estimateShare, reserves_total: reserves, paid_total: paid, recoveries_total: rec,
      outstanding: r2(reserves - paid), incurred: r2(reserves - rec), last_reserve_date: lastReserve,
      days_since_reserve: Math.round((Date.parse(t) - Date.parse(lastReserve ?? String(c.notified_date))) / DAY), cash_call_due_at: cash,
      fx_rate_to_usd: rate, outstanding_usd: usd(reserves - paid), paid_usd: usd(paid), incurred_usd: usd(reserves - rec), recoveries_usd: usd(rec),
      estimate_our_share_usd: usd(estimateShare),
      search_text: [c.claim_no, c.cedent_claim_ref, s.ref_no, s.insured_name, s.mga_name, s.broker_name, c.cause, c.location, c.description, lob?.code, lob?.name]
        .filter(Boolean).join(' ').toLowerCase(),
    }
  })
  const claim_payments_v = (db.claim_payments ?? []).map((p) => {
    const c = claims_v.find((x) => x.id === p.claim_id)!
    const rate = fxRate(String(p.currency), String(p.payment_date))
    return {
      ...p, payee_name: cps.find((x) => x.id === p.payee_id)?.name ?? null, offset_receipt_no: (db.premium_receipts ?? []).find((r) => r.id === p.offset_receipt_id)?.ref_no ?? null,
      entered_by_name: nameOf(p.entered_by), claim_no: c?.claim_no, mga_id: c?.mga_id, mga_name: c?.mga_name, fx_rate_to_usd: rate, amount_usd: rate === null ? null : r2(n(p.amount) * rate),
      is_demo: c?.is_demo,
    }
  })
  return { claims_v, claim_payments_v }
}

/** claim_coverage_issues(): codes of what does not fit. */
export function coverageIssues(db: Record<string, Row[]>, subId: string, dol: string, ccy: string): string[] {
  const s = (db.submissions_v ?? []).find((x) => x.id === subId)
  if (!s) return ['no_submission']
  const out: string[] = []
  if (s.status !== 'bound') out.push('not_bound')
  if (!s.period_from || !s.period_to) out.push('no_period')
  if (s.period_from && dol < String(s.period_from)) out.push('before_inception')
  if (s.period_to && dol > String(s.period_to)) out.push('after_expiry')
  if (dol > today()) out.push('future_loss')
  if (ccy !== s.currency) out.push('currency')
  return out
}

/** The claims_before_write trigger: numbering, signed line, coverage. */
export function insertClaim(db: Record<string, Row[]>, body: Row, userId: string | null, demo: boolean): { row?: Row; error?: string; code?: string } {
  const s = (db.submissions_v ?? []).find((x) => x.id === body.submission_id)
  if (!s) return { error: 'Submission not found', code: 'P0002' }
  const issues = coverageIssues(db, String(body.submission_id), String(body.date_of_loss), String(body.currency))
  if (issues.length && !String(body.coverage_comment ?? '').trim()) return { error: `Coverage check: ${issues.join(', ')} — add a comment to continue`, code: '23514' }
  const scope = `${demo ? 'DEMO-' : ''}CLM-${String(body.notified_date ?? today()).slice(0, 4)}`
  const no = (db.claims ?? []).filter((c) => String(c.claim_no).startsWith(`${scope}-`)).length + 1
  const row: Row = {
    id: crypto.randomUUID(), claim_no: `${scope}-${String(no).padStart(4, '0')}`, status: 'notified', decline_reason: null, close_comment: null, large_loss: false,
    large_loss_at: null, notes: null, status_changed_at: new Date().toISOString(), created_at: new Date().toISOString(), created_by: userId, updated_at: new Date().toISOString(),
    updated_by: userId, ...body, signed_share_pct: s.signed_share_pct, coverage_issues: issues, is_demo: demo,
  }
  ;(db.claims ??= []).push(row)
  checkLargeLoss(db, row)
  return { row }
}

/** Large loss: our share (estimate or reserves) in USD ≥ the setting (250k) → mark and tell management + admin. */
export function checkLargeLoss(db: Record<string, Row[]>, c: Row) {
  if (c.large_loss || c.currency !== 'USD') return
  const share = Math.max(n(c.estimate_100) * n(c.signed_share_pct) / 100, (db.claim_reserves ?? []).filter((r) => r.claim_id === c.id).reduce((s, r) => s + n(r.amount), 0))
  const limit = Number((db.settings ?? []).find((s) => s.key === 'large_loss_threshold_usd')?.value ?? LARGE_LOSS_USD)
  if (share < limit) return
  c.large_loss = true
  c.large_loss_at = new Date().toISOString()
  for (const role of ['management', 'admin']) {
    const fu = { id: crypto.randomUUID(), entity_type: 'claim', entity_id: c.id, type: 'large_loss', title: 'Large loss', due_at: new Date().toISOString(), assigned_to: null, assigned_role: role, done_at: null, done_by: null, outcome: null, created_at: new Date().toISOString(), created_by: null, is_demo: c.is_demo }
    ;(db.follow_ups ??= []).push(fu)
    ;(db.follow_ups_v ??= []).push(followUpView(db, fu))
  }
}

/** The status rules of claims_before_write. */
export function claimStatusError(db: Record<string, Row[]>, c: Row, patch: Row): string | null {
  if (!patch.status || patch.status === c.status) return null
  const next: Record<string, string[]> = { notified: ['open', 'declined'], open: ['closed', 'declined'], reopened: ['closed', 'declined'], closed: ['reopened'], declined: ['reopened'] }
  if (!next[String(c.status)].includes(String(patch.status))) return `A claim cannot go from ${c.status} to ${patch.status}`
  if (patch.status === 'declined' && !String(patch.decline_reason ?? '').trim()) return 'Declining a claim needs a reason'
  if (patch.status === 'closed') {
    const out = (db.claim_reserves ?? []).filter((r) => r.claim_id === c.id).reduce((s, r) => s + n(r.amount), 0) - (db.claim_payments ?? []).filter((p) => p.claim_id === c.id).reduce((s, p) => s + n(p.amount), 0)
    if (Math.abs(out) > 1e-9 && !String(patch.close_comment ?? '').trim()) return `Outstanding is ${out.toFixed(2)} ${c.currency}: close it with a comment, or bring it to zero first`
  }
  return null
}

/** create_claim_payment(): a payment, and for an offset the MGA's receipt and its allocations, all or nothing. */
export function createClaimPayment(db: Record<string, Row[]>, args: { p_payment: Row; p_allocations?: Row[] }, role: string | null) {
  if (role !== 'finance' && role !== 'admin') return { error: 'new row violates row-level security policy for table "claim_payments"', code: '42501' }
  const p = args.p_payment
  const c = (db.claims ?? []).find((x) => x.id === p.claim_id)
  if (!c) return { error: 'Claim not found', code: 'P0002' }
  if (c.status === 'closed' || c.status === 'declined') return { error: `Claim ${c.claim_no} is ${c.status}: reopen it first`, code: '23514' }
  const sub = (db.submissions_v ?? []).find((x) => x.id === c.submission_id)!
  let receiptId: unknown = null
  if (p.method === 'offset_against_premium') {
    const total = (args.p_allocations ?? []).reduce((s, a) => s + n(a.amount), 0)
    if (Math.abs(total - n(p.amount)) > 1e-9) return { error: `An offset must be allocated in full: ${total} of ${p.amount} allocated`, code: '23514' }
    const out = createReceipt(db, { p_receipt: { received_date: p.payment_date, payer_id: sub.mga_id, currency: c.currency, amount: p.amount, bank_reference: `Offset ${c.claim_no}`, notes: p.notes }, p_allocations: args.p_allocations }, role)
    if (out.error) return out
    receiptId = (out.data as Row).id
  }
  const row = {
    id: crypto.randomUUID(), claim_id: c.id, payment_date: p.payment_date, currency: c.currency, amount: n(p.amount), type: p.type ?? 'indemnity',
    payee_id: p.payee_id ?? sub.mga_id, method: p.method ?? 'cash', bank_reference: p.bank_reference ?? (receiptId ? `Offset ${c.claim_no}` : null), notes: p.notes ?? null,
    offset_receipt_id: receiptId, entered_by: null, created_at: new Date().toISOString(),
  }
  ;(db.claim_payments ??= []).push(row)
  if (row.type === 'cash_call') {
    for (const f of [...(db.follow_ups ?? []), ...(db.follow_ups_v ?? [])]) {
      if (f.entity_type === 'claim' && f.entity_id === c.id && f.type === 'cash_call_due' && !f.done_at) Object.assign(f, { done_at: new Date().toISOString(), outcome: 'Cash call paid' })
    }
  }
  return { data: row }
}

/** follow_ups_v for a claim follow-up. */
export function followUpView(db: Record<string, Row[]>, f: Row): Row {
  const c = (db.claims ?? []).find((x) => x.id === f.entity_id)
  const s = (db.submissions_v ?? []).find((x) => x.id === c?.submission_id) ?? {}
  const overdue = !f.done_at && String(f.due_at) < new Date().toISOString()
  return {
    ...f, entity_ref: c?.claim_no, entity_label: s.insured_name, submission_status: s.status, mga_id: s.mga_id, mga_name: s.mga_name, offer_valid_until: null,
    assigned_to_name: nameOf(f.assigned_to), done_by_name: nameOf(f.done_by), is_overdue: overdue,
    days_overdue: overdue ? Math.floor((Date.now() - Date.parse(String(f.due_at))) / DAY) : null, submission_id: s.id, installment_no: null,
  }
}
