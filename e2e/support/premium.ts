/**
 * Premium receivables for the offline mock: seed data, the database rules the
 * screens rely on (installment status from allocations, numbering, write-off
 * by), the three views computed on read, and generate_premium_schedule().
 * Money maths is the app's own (src/features/premium/schedule.ts), which
 * mirrors the SQL exactly.
 */
import { rowDeductions, splitEqual, subMoney, sumMoney, addMonthsIso, addDaysIso } from '../../src/features/premium/schedule'
import { convert } from '../../src/features/premium/receipts'
import { USERS } from './fixtures'

type Row = Record<string, unknown>
const DAY = 86_400_000
const today = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10) // Tashkent date
const n = (v: unknown) => Number(v ?? 0)
const nameOf = (id: unknown) => Object.values(USERS).find((u) => u.id === id)?.full_name ?? null

let seq = 0
const uid = (prefix: string) => `${prefix}-0000-4000-8000-${String(++seq).padStart(12, '0')}`

function installment(sub: Row, no: number, type: string, due: string, gross: string, comm: string, brok: string, extra: Row = {}): Row {
  return {
    id: uid('50000000'), submission_id: sub.id, installment_no: no, type, due_date: due, currency: sub.currency,
    gross_amount: n(gross), commission_amount: n(comm), brokerage_amount: n(brok), net_amount: n(subMoney(subMoney(gross, comm), brok)),
    status: 'open', basis_signed_share_pct: sub.signed_share_pct, settled_at: null, written_off_at: null, written_off_reason: null,
    written_off_by: null, notes: null, created_at: new Date().toISOString(), created_by: USERS.underwriter.id, updated_at: new Date().toISOString(), updated_by: null, ...extra,
  }
}

function scheduleRows(sub: Row, rows: { due_date: string; gross_amount: string }[], startNo: number): Row[] {
  const d = rowDeductions(rows.map((r) => r.gross_amount), sub.commission_pct as number, sub.brokerage_pct as number)
  return rows.map((r, i) => installment(sub, startNo + i, 'original', r.due_date, r.gross_amount, d[i].commission, d[i].brokerage))
}

/** Seed: a fully scheduled USD risk (paid, part-paid, overdue, a return premium), an overdue single installment, and a EUR risk paid in USD. */
export function premiumSeed(submissions: Row[]) {
  const by = (insured: string) => submissions.find((s) => s.insured_name === insured)!
  const mall = by('Tashkent City Mall')
  const cargo = by('Almalyk MMC Fleet Cargo Programme')
  const water = by('Georgian Mineral Water Exporters Credit')
  const d = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10)

  const mallRows = scheduleRows(
    mall,
    splitEqual(String(mall.our_gross_premium), 4).map((g, i) => ({ due_date: addMonthsIso(d(220), i * 3), gross_amount: g })),
    1,
  )
  const mallReturn = installment(mall, 5, 'return', d(10), '-2000.00', '-500.00', '-100.00', { basis_signed_share_pct: null, notes: 'Reduced sum insured — endorsement 2' })
  const cargoRows = scheduleRows(cargo, [{ due_date: d(45), gross_amount: String(cargo.our_gross_premium) }], 1)
  const waterRows = scheduleRows(
    water,
    splitEqual(String(water.our_gross_premium), 2).map((g, i) => ({ due_date: addDaysIso(d(20), i * 90), gross_amount: g })),
    1,
  )

  // demo data: one overdue installment on a demo risk (hidden unless in demo mode)
  const izmir = by('DEMO Izmir Port Logistics Centre')
  const demoRows = scheduleRows(izmir, [{ due_date: d(50), gross_amount: String(izmir.our_gross_premium) }], 1)

  const r1 = { id: uid('60000000'), ref_no: 'RCP-2026-0001', received_date: d(200), payer_id: mall.broker_id, currency: 'USD', amount: n(sumMoney([mallRows[0].net_amount as number, '5000.00'])), bank_reference: 'SWIFT MT103 TRB-55120', notes: null, created_at: new Date().toISOString(), created_by: USERS.finance.id, updated_at: new Date().toISOString(), updated_by: null }
  const r2 = { ...r1, id: uid('60000000'), ref_no: 'RCP-2026-0002', received_date: d(15), payer_id: water.mga_id, currency: 'USD', amount: 12000, bank_reference: 'SWIFT MT103 MRP-10021' }
  const allocations: Row[] = [
    { id: uid('70000000'), receipt_id: r1.id, installment_id: mallRows[0].id, amount: mallRows[0].net_amount, fx_rate: 1, installment_amount: mallRows[0].net_amount, created_at: r1.created_at },
    { id: uid('70000000'), receipt_id: r1.id, installment_id: mallRows[1].id, amount: 5000, fx_rate: 1, installment_amount: 5000, created_at: r1.created_at },
    // USD 12,000 → EUR at 0.9205 EUR per 1 USD
    { id: uid('70000000'), receipt_id: r2.id, installment_id: waterRows[0].id, amount: 12000, fx_rate: 0.9205, installment_amount: 11046, created_at: r2.created_at },
  ]
  return {
    premium_installments: [...mallRows, mallReturn, ...cargoRows, ...waterRows, ...demoRows],
    premium_receipts: [r1, r2],
    premium_allocations: allocations,
  }
}

function paidOf(db: Record<string, Row[]>, installmentId: unknown) {
  return sumMoney((db.premium_allocations ?? []).filter((a) => a.installment_id === installmentId).map((a) => a.installment_amount as number))
}

/** The triggers' effect: net, numbering, status, written_off_by. Run after every premium write. */
export function normalizePremium(db: Record<string, Row[]>, actorId: string | null) {
  for (const i of db.premium_installments ?? []) {
    i.gross_amount = n(i.gross_amount)
    i.commission_amount = n(i.commission_amount)
    i.brokerage_amount = n(i.brokerage_amount)
    i.net_amount = n(subMoney(subMoney(String(i.gross_amount), String(i.commission_amount)), String(i.brokerage_amount)))
    if (!i.installment_no) {
      i.installment_no = Math.max(0, ...db.premium_installments.filter((x) => x.submission_id === i.submission_id).map((x) => n(x.installment_no))) + 1
    }
    i.type ??= 'original'
    if (!i.written_off_at) {
      i.written_off_reason = null
      i.written_off_by = null
    } else if (!i.written_off_by) i.written_off_by = actorId
    const paid = n(paidOf(db, i.id))
    i.status = i.written_off_at ? 'written_off'
      : i.type === 'return' ? (i.settled_at ? 'paid' : 'open')
      : paid >= n(i.net_amount) ? 'paid' : paid > 0 ? 'partially_paid' : 'open'
  }
  for (const a of db.premium_allocations ?? []) {
    a.fx_rate ??= 1 // the trigger sets 1 when the currencies match
    a.installment_amount ??= n(convert(String(a.amount), String(a.fx_rate)))
  }
}

/** premium_installments_v, premium_receipts_v, premium_schedule_check_v — as the SQL views define them. */
export function premiumViews(db: Record<string, Row[]>, fxRate: (ccy: string, date: string) => number | null) {
  const t = today()
  const subs = db.submissions_v ?? []
  const cps = db.counterparties ?? []
  const installments_v = (db.premium_installments ?? []).map((i) => {
    const s = subs.find((x) => x.id === i.submission_id)!
    const paid = n(paidOf(db, i.id))
    const outstanding = i.status === 'written_off' || i.type === 'return' ? 0 : n(subMoney(String(i.net_amount), String(paid)))
    const payable = i.type === 'return' && !i.settled_at && i.status !== 'written_off' ? -n(i.net_amount) : 0
    const due = String(i.due_date)
    const days = i.type !== 'return' && outstanding > 0 && due < t ? Math.round((Date.parse(t) - Date.parse(due)) / DAY) : 0
    const rate = fxRate(String(i.currency), t) ?? null
    const last = (db.premium_allocations ?? []).filter((a) => a.installment_id === i.id)
      .map((a) => (db.premium_receipts ?? []).find((r) => r.id === a.receipt_id)?.received_date as string).sort().at(-1) ?? null
    return {
      ...i, paid_amount: paid, outstanding_amount: outstanding, last_receipt_date: last, days_overdue: days,
      aging_bucket: days === 0 ? null : days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+',
      fx_rate_to_usd: rate, net_amount_usd: rate === null ? null : Math.round(n(i.net_amount) * rate * 100) / 100,
      outstanding_usd: rate === null ? null : Math.round(outstanding * rate * 100) / 100,
      basis_mismatch: i.type === 'original' && i.basis_signed_share_pct !== s.signed_share_pct,
      ref_no: s.ref_no, insured_name: s.insured_name, submission_status: s.status, signed_share_pct: s.signed_share_pct,
      mga_id: s.mga_id, mga_name: s.mga_name, broker_id: s.broker_id, broker_name: s.broker_name,
      underwriter_id: s.underwriter_id, underwriter_name: s.underwriter_name,
      payable_amount: payable, payable_usd: rate === null ? null : Math.round(payable * rate * 100) / 100,
      written_off_by_name: nameOf(i.written_off_by),
    }
  })
  const receipts_v = (db.premium_receipts ?? []).map((r) => {
    const allocated = n(sumMoney((db.premium_allocations ?? []).filter((a) => a.receipt_id === r.id).map((a) => a.amount as number)))
    const rate = fxRate(String(r.currency), String(r.received_date))
    const payer = cps.find((c) => c.id === r.payer_id)
    return {
      ...r, allocated_amount: allocated, unallocated_amount: n(subMoney(String(r.amount), String(allocated))),
      allocation_count: (db.premium_allocations ?? []).filter((a) => a.receipt_id === r.id).length,
      fx_rate_to_usd: rate, amount_usd: rate === null ? null : Math.round(n(r.amount) * rate * 100) / 100,
      payer_name: payer?.name ?? null, payer_type: payer?.type ?? null,
    }
  })
  const check_v = subs.filter((s) => s.status === 'bound').map((s) => {
    const is = (db.premium_installments ?? []).filter((i) => i.submission_id === s.id)
    const orig = is.filter((i) => i.type === 'original')
    const scheduledNet = sumMoney(orig.map((i) => i.net_amount as number))
    return {
      submission_id: s.id, ref_no: s.ref_no, currency: s.currency, signed_share_pct: s.signed_share_pct,
      expected_gross: s.our_gross_premium, expected_net: s.our_net_premium,
      scheduled_net: n(scheduledNet), scheduled_gross: n(sumMoney(orig.map((i) => i.gross_amount as number))),
      difference: n(subMoney(String(s.our_net_premium ?? 0), scheduledNet)),
      total_net: n(sumMoney(is.filter((i) => i.type !== 'return').map((i) => i.net_amount as number))),
      installment_count: is.length, has_schedule: is.length > 0,
      basis_mismatch: orig.some((i) => i.basis_signed_share_pct !== s.signed_share_pct),
      payable_total: -n(sumMoney(is.filter((i) => i.type === 'return').map((i) => i.net_amount as number))),
    }
  })
  return { premium_installments_v: installments_v, premium_receipts_v: receipts_v, premium_schedule_check_v: check_v }
}

/** generate_premium_schedule(): replace the 'original' installments with the given rows. */
export function generateSchedule(db: Record<string, Row[]>, submissionId: string, rows: { due_date: string; gross_amount: string }[] | null) {
  const s = (db.submissions_v ?? []).find((x) => x.id === submissionId)
  if (!s) return { error: 'Submission not found' }
  if (s.status !== 'bound') return { error: 'A premium schedule needs a bound submission' }
  const originals = (db.premium_installments ?? []).filter((i) => i.submission_id === submissionId && i.type === 'original')
  if (originals.some((i) => i.written_off_at || (db.premium_allocations ?? []).some((a) => a.installment_id === i.id))) {
    return { error: 'Receipts are already allocated to this schedule; edit the installments instead of regenerating' }
  }
  const list = rows?.length ? rows : [{ due_date: String(s.ppw_date ?? s.period_from), gross_amount: String(s.our_gross_premium) }]
  db.premium_installments = (db.premium_installments ?? []).filter((i) => !originals.includes(i))
  const start = Math.max(0, ...db.premium_installments.filter((i) => i.submission_id === submissionId).map((i) => n(i.installment_no))) + 1
  const created = scheduleRows(s, list, start)
  db.premium_installments.push(...created)
  return { data: created }
}

/** create_premium_receipt(): the receipt and its allocations, all or nothing, with the triggers' rules. */
export function createReceipt(db: Record<string, Row[]>, args: { p_receipt: Row; p_allocations?: Row[] }, role: string | null) {
  if (role !== 'finance' && role !== 'admin') return { error: 'new row violates row-level security policy for table "premium_receipts"', code: '42501' }
  const r = args.p_receipt
  const date = String(r.received_date || today())
  const year = date.slice(0, 4)
  const seqNo = (db.premium_receipts ?? []).filter((x) => String(x.ref_no).startsWith(`RCP-${year}-`)).length + 1
  const receipt: Row = {
    id: uid('60000000'), ref_no: `RCP-${year}-${String(seqNo).padStart(4, '0')}`, received_date: date, payer_id: r.payer_id, currency: r.currency,
    amount: n(r.amount), bank_reference: String(r.bank_reference ?? '').trim() || null, notes: String(r.notes ?? '').trim() || null,
    created_at: new Date().toISOString(), created_by: null, updated_at: new Date().toISOString(), updated_by: null,
  }
  const allocations: Row[] = []
  let used = 0
  for (const a of args.p_allocations ?? []) {
    const inst = (db.premium_installments ?? []).find((i) => i.id === a.installment_id)
    if (!inst) return { error: 'Receipt or installment not found', code: '23503' }
    if (inst.type === 'return') return { error: 'Return premium is settled, not paid through receipts', code: '23514' }
    if (inst.status === 'written_off') return { error: `Installment ${inst.installment_no} is written off`, code: '23514' }
    if (allocations.some((x) => x.installment_id === inst.id)) return { error: 'duplicate key value violates unique constraint "premium_allocations_receipt_id_installment_id_key"', code: '23505' }
    const same = inst.currency === receipt.currency
    if (!same && !a.fx_rate) return { error: `Exchange rate required: ${inst.currency} per 1 ${receipt.currency}`, code: '23502' }
    const rate = same ? '1' : String(a.fx_rate)
    const instAmount = convert(String(a.amount), rate)!
    used += n(a.amount)
    if (used > n(receipt.amount) + 1e-9) return { error: `Allocation exceeds the receipt`, code: '23514' }
    const outstanding = n(subMoney(String(inst.net_amount), paidOf(db, inst.id)))
    if (n(instAmount) > outstanding + 1e-9) return { error: `Allocation exceeds the installment: ${outstanding.toFixed(2)} ${inst.currency} outstanding`, code: '23514' }
    allocations.push({ id: uid('70000000'), receipt_id: receipt.id, installment_id: inst.id, amount: n(a.amount), fx_rate: n(rate), installment_amount: n(instAmount), created_at: receipt.created_at })
  }
  ;(db.premium_receipts ??= []).push(receipt)
  ;(db.premium_allocations ??= []).push(...allocations)
  return { data: receipt }
}
