/**
 * Binders for the offline mock: a live cargo binder (Caspian, 85 % capacity,
 * one bordereau late, the rest of the months missing), a draft one, a demo
 * one; the binders_v view and binder_periods computed on read; and the import
 * rules (the database's checks, duplicates, premium installments, claims by
 * the cedent's reference, the 80 % / 100 % capacity alert).
 */
import { USERS } from './fixtures'
import { followUpView, insertClaim } from './claims'

type Row = Record<string, unknown>
const DAY = 86_400_000
const today = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10)
const n = (v: unknown) => Number(v ?? 0)
const r2 = (x: number) => Math.round(x * 100) / 100
const ADMIN = USERS.admin.id
const UW = USERS.underwriter.id
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const addDays = (date: string, days: number) => iso(Date.parse(`${date}T00:00:00Z`) + days * DAY)
const monthStart = (date: string) => `${date.slice(0, 7)}-01`
const monthEnd = (start: string) => {
  const [y, m] = start.split('-').map(Number)
  return iso(Date.UTC(y, m, 0))
}
const nextMonth = (start: string) => {
  const [y, m] = start.split('-').map(Number)
  return iso(Date.UTC(y, m, 1))
}
const quarterStart = (date: string) => {
  const [y, m] = date.split('-').map(Number)
  return iso(Date.UTC(y, Math.floor((m - 1) / 3) * 3, 1))
}

export const BINDER_LIVE = 'b1000000-0000-4000-8000-000000000001'
export const BINDER_DRAFT = 'b1000000-0000-4000-8000-000000000002'
export const BINDER_DEMO = 'b1000000-0000-4000-8000-000000000003'

/** The live binder on the bound Almalyk cargo programme, a draft for Aktau, and a demo binder. */
export function bindersSeed(db: Record<string, Row[]>) {
  const sub = (insured: string) => db.submissions_v.find((s) => s.insured_name === insured)!
  const party = (name: string) => db.counterparties.find((c) => c.name === name)!
  const lob = (code: string) => db.lines_of_business.find((l) => l.code === code)!
  const alm = sub('Almalyk MMC Fleet Cargo Programme')
  const akt = sub('Aktau Port Cargo Programme')
  const base = { created_at: new Date().toISOString(), created_by: ADMIN, updated_at: new Date().toISOString(), updated_by: null, capacity_alerted_pct: 0 }
  const binders: Row[] = [
    {
      ...base, id: BINDER_LIVE, binder_ref: 'ALM-CARGO-2026', mga_id: alm.mga_id, broker_id: null, underwriter_id: UW, period_from: alm.period_from, period_to: alm.period_to,
      currency: 'USD', our_share_pct: 20, commission_pct: 27.5, brokerage_pct: 0, limit_per_risk: 5_000_000, aggregate_limit: 40_000_000, territories: ['UZ', 'KZ', 'TM'],
      bordereau_frequency: 'monthly', bordereau_due_days: 30, bordereau_kinds: ['risk', 'premium', 'claims'], status: 'active', notes: 'Copper concentrate and fleet cargo; open cover', is_demo: false,
    },
    {
      ...base, id: BINDER_DRAFT, binder_ref: 'AKT-CARGO-2026', mga_id: akt.mga_id, broker_id: akt.broker_id, underwriter_id: UW, period_from: akt.period_from, period_to: akt.period_to,
      currency: 'USD', our_share_pct: 15, commission_pct: 25, brokerage_pct: 5, limit_per_risk: 4_000_000, aggregate_limit: 30_000_000, territories: ['KZ'],
      bordereau_frequency: 'quarterly', bordereau_due_days: 45, bordereau_kinds: ['risk', 'premium', 'claims'], status: 'draft', notes: 'Waiting for the firm order', is_demo: false,
    },
    {
      ...base, id: BINDER_DEMO, binder_ref: 'DEMO-IZM-PROP-2026', mga_id: party('DEMO Anatolia MGA').id, broker_id: null, underwriter_id: ADMIN, period_from: addDays(today(), -60), period_to: addDays(today(), 305),
      currency: 'USD', our_share_pct: 10, commission_pct: 22.5, brokerage_pct: 5, limit_per_risk: 10_000_000, aggregate_limit: 50_000_000, territories: ['TR'],
      bordereau_frequency: 'monthly', bordereau_due_days: 30, bordereau_kinds: ['risk', 'premium'], status: 'active', notes: null, is_demo: true,
    },
  ]
  for (const t of ['submissions', 'submissions_v']) {
    for (const s of db[t]) {
      if (s.id === alm.id) s.binder_id = BINDER_LIVE
      if (s.id === akt.id) s.binder_id = BINDER_DRAFT
    }
  }
  const binder_lobs: Row[] = [
    { binder_id: BINDER_LIVE, lob_id: lob('CARGO').id, limit_100: 5_000_000, is_demo: false },
    { binder_id: BINDER_DRAFT, lob_id: lob('CARGO').id, limit_100: null, is_demo: false },
    { binder_id: BINDER_DEMO, lob_id: lob('PROP').id, limit_100: null, is_demo: true },
  ]
  const bordereau_templates: Row[] = [{
    id: 'b3000000-0000-4000-8000-000000000001', mga_id: alm.mga_id, kind: 'risk', name: 'Caspian risk bordereau', header_row: 1, sheet: null, is_demo: false,
    mapping: { policy_ref: 'Certificate No', insured_name: 'Assured', insured_country: 'Country', period_from: 'Inception', currency: 'Currency', limit_100: 'Limit 100%' },
    created_at: base.created_at, created_by: ADMIN, updated_at: base.created_at,
  }]
  const out: Record<string, Row[]> = { binders, binder_lobs, bordereau_templates, bordereaux: [], bordereau_lines: [] }

  // three months of risk bordereaux (the second one late): 34m of the 40m aggregate
  const b = binders[0]
  const limits = [[3e6, 2.5e6, 2e6, 2e6, 1.5e6, 1e6], [4e6, 2.5e6, 1.5e6, 1e6, 1e6], [3e6, 2e6, 1.5e6, 1.5e6, 2.5e6, 1e6, 0.5e6]]
  let m = monthStart(String(b.period_from))
  limits.forEach((row, i) => {
    const end = monthEnd(m)
    const bdx = addBordereau(out, b, 'risk', m, end, addDays(end, i === 1 ? 45 : 20), `Caspian_risk_${m.slice(0, 7)}.xlsx`)
    row.forEach((lim, k) => {
      const from = addDays(String(b.period_from) > m ? String(b.period_from) : m, k * 3)
      addLine(out, bdx, { line_no: k + 2, dup_key: `ALM-${i + 1}-${k + 1}|${from}`, policy_ref: `ALM-${i + 1}-${k + 1}`, insured_name: `Almalyk MMC shipment ${i + 1}/${k + 1}`, insured_country: ['UZ', 'KZ', 'TM'][k % 3], lob_id: lob('CARGO').id, period_from: from, currency: 'USD', limit_100: lim, sum_insured_100: lim })
    })
    finish(out, bdx)
    m = nextMonth(m)
  })
  b.capacity_alerted_pct = 80
  const alert: Row = { id: 'b4000000-0000-4000-8000-000000000001', entity_type: 'binder', entity_id: BINDER_LIVE, type: 'capacity_alert', title: 'Capacity 80 % used', due_at: new Date(Date.now() - DAY).toISOString(), assigned_to: UW, assigned_role: null, done_at: null, done_by: null, outcome: null, created_at: new Date().toISOString(), created_by: null, is_demo: false }
  return { ...out, followUps: [alert] }
}

function addBordereau(db: Record<string, Row[]>, b: Row, kind: string, start: string, end: string, received: string, file: string, extra: Row = {}): Row {
  const scope = `${b.is_demo ? 'DEMO-' : ''}BDX-${received.slice(0, 4)}`
  const no = (db.bordereaux ?? []).filter((x) => String(x.ref_no).startsWith(`${scope}-`)).length + 1
  const row: Row = {
    id: crypto.randomUUID(), ref_no: `${scope}-${String(no).padStart(4, '0')}`, binder_id: b.id, kind, period_start: start, period_end: end, received_date: received,
    template_id: null, file_name: file, stated_total: null, computed_total: 0, totals_comment: null, line_count: 0, warning_count: 0, rejected_count: 0,
    installment_ids: [], notes: null, created_at: new Date().toISOString(), created_by: ADMIN, is_demo: Boolean(b.is_demo), ...extra,
  }
  ;(db.bordereaux ??= []).push(row)
  return row
}

function addLine(db: Record<string, Row[]>, bdx: Row, l: Row) {
  ;(db.bordereau_lines ??= []).push({
    id: crypto.randomUUID(), bordereau_id: bdx.id, binder_id: bdx.binder_id, kind: bdx.kind, status: 'ok', comment: null, messages: [], raw: {}, claim_id: null,
    policy_ref: null, claim_ref: null, insured_name: null, insured_country: null, lob_id: null, period_from: null, period_to: null, currency: null, sum_insured_100: null,
    limit_100: null, gross_premium_100: null, date_of_loss: null, notified_date: null, cause: null, paid_100: null, outstanding_100: null, is_demo: bdx.is_demo, ...l,
  })
}

function finish(db: Record<string, Row[]>, bdx: Row) {
  const lines = db.bordereau_lines.filter((l) => l.bordereau_id === bdx.id)
  bdx.line_count = lines.length
  bdx.warning_count = lines.filter((l) => l.status === 'warning').length
  bdx.computed_total ||= r2(lines.reduce((s, l) => s + (bdx.kind === 'premium' ? n(l.gross_premium_100) : bdx.kind === 'risk' ? n(l.limit_100 ?? l.sum_insured_100) : n(l.paid_100) + n(l.outstanding_100)), 0))
}

/** binder_periods(): expected bordereaux per period and kind, with their state. */
export function binderPeriods(db: Record<string, Row[]>, binderId: string): Row[] {
  const b = (db.binders ?? []).find((x) => x.id === binderId)
  if (!b) return []
  const t = today()
  const quarterly = b.bordereau_frequency === 'quarterly'
  const out: Row[] = []
  let start = quarterly ? quarterStart(String(b.period_from)) : monthStart(String(b.period_from))
  const last = String(b.period_to) < t ? String(b.period_to) : t
  while (start <= last) {
    const next = quarterly ? nextMonth(nextMonth(nextMonth(start))) : nextMonth(start)
    const end = addDays(next, -1)
    const due = addDays(end, n(b.bordereau_due_days))
    for (const kind of (b.bordereau_kinds as string[]) ?? []) {
      const x = (db.bordereaux ?? []).filter((r) => r.binder_id === binderId && r.kind === kind && r.period_start === start).sort((a, c) => String(a.received_date).localeCompare(String(c.received_date)))[0]
      const state = x ? (String(x.received_date) > due ? 'late' : 'received') : due < t ? 'missing' : 'upcoming'
      out.push({ period_start: start, period_end: end, kind, due_date: due, state, bordereau_id: x?.id ?? null, ref_no: x?.ref_no ?? null, received_date: x?.received_date ?? null })
    }
    start = next
  }
  return out
}

/** binders_v, computed on read. */
export function bindersView(db: Record<string, Row[]>): Row[] {
  const name = (id: unknown) => (db.counterparties ?? []).find((c) => c.id === id)?.name ?? null
  return (db.binders ?? []).map((b) => {
    const lines = (db.bordereau_lines ?? []).filter((l) => l.binder_id === b.id && l.kind === 'risk')
    const used = r2(lines.reduce((s, l) => s + n(l.limit_100 ?? l.sum_insured_100), 0))
    const periods = binderPeriods(db, String(b.id))
    const s = (db.submissions_v ?? []).filter((x) => x.binder_id === b.id).sort((a, c) => Number(c.status === 'bound') - Number(a.status === 'bound'))[0]
    const lobCodes = (db.binder_lobs ?? []).filter((l) => l.binder_id === b.id).map((l) => (db.lines_of_business ?? []).find((x) => x.id === l.lob_id)?.code).filter(Boolean).sort().join(', ')
    const received = (db.bordereaux ?? []).filter((x) => x.binder_id === b.id).map((x) => String(x.received_date)).sort()
    const row: Row = {
      ...b, mga_name: name(b.mga_id), broker_name: name(b.broker_id), underwriter_name: Object.values(USERS).find((u) => u.id === b.underwriter_id)?.full_name ?? null,
      submission_id: s?.id ?? null, submission_ref: s?.ref_no ?? null, submission_status: s?.status ?? null,
      capacity_used_100: used, capacity_missing_rate: 0, risk_lines: lines.length,
      capacity_pct: n(b.aggregate_limit) > 0 ? Math.round((used / n(b.aggregate_limit)) * 1000) / 10 : null,
      missing_count: periods.filter((p) => p.state === 'missing').length, late_count: periods.filter((p) => p.state === 'late').length,
      last_received: received[received.length - 1] ?? null, lob_codes: lobCodes || null,
    }
    row.search_text = [row.binder_ref, row.mga_name, row.broker_name, row.submission_ref, row.notes, ...((b.territories as string[]) ?? [])].filter(Boolean).join(' ').toLowerCase()
    return row
  })
}

export function binderFollowUpView(db: Record<string, Row[]>, f: Row): Row {
  const b = (db.binders ?? []).find((x) => x.id === f.entity_id)
  const mga = (db.counterparties ?? []).find((c) => c.id === b?.mga_id)
  const overdue = !f.done_at && String(f.due_at) < new Date().toISOString()
  return {
    ...f, entity_ref: b?.binder_ref, entity_label: mga?.name, submission_status: null, mga_id: b?.mga_id, mga_name: mga?.name, offer_valid_until: null,
    assigned_to_name: Object.values(USERS).find((u) => u.id === f.assigned_to)?.full_name ?? null, done_by_name: null, is_overdue: overdue,
    days_overdue: overdue ? Math.floor((Date.now() - Date.parse(String(f.due_at))) / DAY) : null, submission_id: null, installment_no: null,
  }
}

/** import_bordereau(): all or nothing, the database's checks and effects. */
export function importBordereau(db: Record<string, Row[]>, args: { p_bordereau: Row; p_lines: Row[]; p_rejected?: number }, role: string | null, userId: string | null, demo: boolean): { data?: Row; error?: string; code?: string } {
  const h = args.p_bordereau
  const b = (db.binders ?? []).find((x) => x.id === h.binder_id)
  if (!b) return { error: 'Binder not found', code: 'P0002' }
  if (!role || role === 'management') return { error: 'new row violates row-level security policy for table "bordereaux"', code: '42501' }
  if (h.kind === 'premium' && role !== 'admin' && role !== 'finance') return { error: 'new row violates row-level security policy for table "premium_installments"', code: '42501' }
  if (h.kind === 'claims' && role !== 'admin' && role !== 'claims') return { error: 'new row violates row-level security policy for table "claims"', code: '42501' }
  if (!args.p_lines?.length) return { error: 'A bordereau needs at least one line to import', code: '22023' }
  if (h.stated_total !== null && h.stated_total !== undefined && n(h.stated_total) !== n(h.computed_total) && !String(h.totals_comment ?? '').trim()) {
    return { error: `The lines total ${h.computed_total} differs from the MGA's stated total ${h.stated_total}: a comment is needed`, code: '23514' }
  }
  const sub = (db.submissions_v ?? []).find((s) => s.binder_id === b.id && s.status === 'bound')
  if ((h.kind === 'premium' || h.kind === 'claims') && !sub) return { error: "Bind the binder's submission first: premium and claims are kept on it", code: '23514' }
  const taken = new Set((db.bordereau_lines ?? []).filter((l) => l.binder_id === b.id && l.kind === h.kind).map((l) => l.dup_key))
  for (const l of args.p_lines) {
    if (taken.has(l.dup_key)) return { error: 'duplicate key value violates unique constraint "bordereau_lines_dup_uq"', code: '23505' }
    if (l.status === 'warning' && !String(l.comment ?? '').trim()) return { error: 'new row violates check constraint "bordereau_lines_warning_comment_chk"', code: '23514' }
    if (h.kind !== 'claims' && l.period_from && (String(l.period_from) < String(b.period_from) || String(l.period_from) > String(b.period_to))) return { error: `Line ${l.line_no}: inception ${l.period_from} is outside the binder period`, code: '23514' }
    taken.add(l.dup_key)
  }
  void demo
  const bdx = addBordereau(db, b, String(h.kind), String(h.period_start), String(h.period_end), String(h.received_date ?? today()), String(h.file_name ?? ''), {
    template_id: h.template_id ?? null, stated_total: h.stated_total ?? null, computed_total: n(h.computed_total), totals_comment: h.totals_comment ?? null, notes: h.notes ?? null,
    rejected_count: n(args.p_rejected), created_by: userId,
  })
  for (const l of args.p_lines) {
    const num = (k: string) => (l[k] === null || l[k] === undefined ? null : Number(l[k]))
    addLine(db, bdx, { ...l, sum_insured_100: num('sum_insured_100'), limit_100: num('limit_100'), gross_premium_100: num('gross_premium_100'), paid_100: num('paid_100'), outstanding_100: num('outstanding_100') })
  }
  const lines = db.bordereau_lines.filter((l) => l.bordereau_id === bdx.id)
  if (h.kind === 'premium') {
    const byCcy = new Map<string, number>()
    for (const l of lines) byCcy.set(String(l.currency), (byCcy.get(String(l.currency)) ?? 0) + n(l.gross_premium_100))
    for (const [ccy, gross100] of byCcy) {
      const gross = r2((gross100 * n(b.our_share_pct)) / 100)
      if (gross === 0) continue
      const no = (db.premium_installments ?? []).filter((i) => i.submission_id === sub!.id).length + 1
      const inst: Row = {
        id: crypto.randomUUID(), submission_id: sub!.id, installment_no: no, type: gross < 0 ? 'return' : 'additional', due_date: addDays(String(bdx.period_end), n(b.bordereau_due_days)),
        currency: ccy, gross_amount: gross, commission_amount: r2((gross * n(b.commission_pct)) / 100), brokerage_amount: r2((gross * n(b.brokerage_pct)) / 100), status: 'open',
        notes: `Bordereau ${bdx.ref_no} (${String(bdx.period_start).slice(5, 7)}.${String(bdx.period_start).slice(0, 4)})`, settled_at: null, written_off_at: null, written_off_reason: null,
        basis_signed_share_pct: sub!.signed_share_pct, created_at: new Date().toISOString(), created_by: userId, is_demo: Boolean(b.is_demo),
      }
      ;(db.premium_installments ??= []).push(inst)
      ;(bdx.installment_ids as string[]).push(String(inst.id))
    }
  }
  if (h.kind === 'claims') {
    for (const l of lines) {
      const target = r2(((n(l.paid_100) + n(l.outstanding_100)) * n(b.our_share_pct)) / 100)
      let c = (db.claims ?? []).find((x) => x.submission_id === sub!.id && x.cedent_claim_ref === l.claim_ref)
      if (!c) {
        const made = insertClaim(db, {
          submission_id: sub!.id, notified_date: l.notified_date ?? bdx.received_date, date_of_loss: l.date_of_loss, currency: l.currency, cause: l.cause, cedent_claim_ref: l.claim_ref,
          estimate_100: n(l.paid_100) + n(l.outstanding_100), coverage_comment: l.comment ?? `Reported on bordereau ${bdx.ref_no}`, notes: `From bordereau ${bdx.ref_no}`,
        }, userId, Boolean(b.is_demo))
        if (made.error) return { error: made.error, code: made.code }
        c = made.row!
        c.status = 'open'
      }
      const now = (db.claim_reserves ?? []).filter((r) => r.claim_id === c!.id).reduce((s, r) => s + n(r.amount), 0)
      if (target !== now) (db.claim_reserves ??= []).push({ id: crypto.randomUUID(), claim_id: c.id, movement_date: bdx.period_end, amount: r2(target - now), reason: `Bordereau ${bdx.ref_no} line ${l.line_no}`, entered_by: userId, created_at: new Date().toISOString() })
      l.claim_id = c.id
    }
  }
  if (h.kind === 'risk' && b.aggregate_limit) {
    const used = (db.bordereau_lines ?? []).filter((l) => l.binder_id === b.id && l.kind === 'risk').reduce((s, l) => s + n(l.limit_100 ?? l.sum_insured_100), 0)
    const pct = used >= n(b.aggregate_limit) ? 100 : used >= n(b.aggregate_limit) * 0.8 ? 80 : 0
    if (pct > n(b.capacity_alerted_pct)) {
      b.capacity_alerted_pct = pct
      for (const [to, team] of [[null, 'management'], [b.underwriter_id ?? null, b.underwriter_id ? null : 'underwriter']] as const) {
        const fu: Row = { id: crypto.randomUUID(), entity_type: 'binder', entity_id: b.id, type: 'capacity_alert', title: `Capacity ${pct} % used`, due_at: new Date().toISOString(), assigned_to: to, assigned_role: team, done_at: null, done_by: null, outcome: null, created_at: new Date().toISOString(), created_by: null, is_demo: Boolean(b.is_demo) }
        ;(db.follow_ups ??= []).push(fu)
        ;(db.follow_ups_v ??= []).push(binderFollowUpView(db, fu))
      }
    }
  }
  finish(db, bdx)
  return { data: bdx }
}

export { followUpView }
