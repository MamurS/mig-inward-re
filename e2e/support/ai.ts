/**
 * AI-assisted entry for the offline mock: the ai-extract Edge Function's
 * contract (switched on / role allowed, cache, usage log) with a canned
 * reading — never a real model. The slip names an insured already in the
 * register (the duplicate warning), an MGA written differently from its
 * counterparty name (the fuzzy match), a broker that is not a counterparty,
 * a low-confidence premium and a date in the wrong format.
 */
import { USERS } from './fixtures'

type Row = Record<string, unknown>
const f = (value: string | null, confidence: number, source: string | null = value) => ({ value, confidence, source })

export const AI_SLIP = {
  fields: {
    insured_name: f('JSC Navoiyazot Chemical Plant', 0.97, 'Original Insured: JSC "Navoiyazot" Chemical Plant'),
    insured_country: f('UZ', 0.95, 'Navoi, Uzbekistan'),
    mga_name: f('SILK ROAD UNDERWRITING AGENCY LLC', 0.93, 'Coverholder: SILK ROAD UNDERWRITING AGENCY LLC'),
    broker_name: f('Samarkand Re Partners', 0.88, 'Broker: Samarkand Re Partners'),
    lob_code: f('PROP', 0.9, 'Class: Property All Risks'),
    risk_description: f('Chemical plant, fire and explosion incl. BI 12 months', 0.8, 'PD/BI fire & explosion, BI indemnity 12 months'),
    period_from: f('2027-01-01', 0.96, 'Period: 01.01.2027 – 31.12.2027'),
    period_to: f('31.12.2027', 0.9, '31.12.2027'),
    currency: f('USD', 0.98, 'USD'),
    sum_insured_100: f('180000000', 0.94, 'TSI USD 180,000,000'),
    limit_100: f('60000000', 0.9, 'Limit USD 60,000,000 any one occurrence'),
    deductible: f('500000', 0.85, 'Deductible USD 500,000 each and every loss'),
    gross_premium_100: f('720000', 0.42, 'Indicated premium approx. USD 720k'),
    commission_pct: f('22.5', 0.9, 'Commission 22.5%'),
    brokerage_pct: f('5', 0.86, 'Brokerage 5%'),
    written_share_pct: f('10', 0.75, 'Line sought: 10%'),
    ppw_date: f(null, 0, null),
    payment_terms_days: f('60', 0.7, 'Premium payable within 60 days'),
    offer_valid_until: f(null, 0, null),
  },
  notes: ['The premium is an indication only; ask the MGA for the firm figure.'],
}

const WORDS: Record<string, string[]> = {
  policy_ref: ['certificate', 'policy', 'cert'], insured_name: ['assured', 'insured'], insured_country: ['country'], period_from: ['inception', 'from'],
  period_to: ['expiry', 'to'], currency: ['currency', 'ccy', 'money'], limit_100: ['limit'], sum_insured_100: ['sum insured', 'tsi'], gross_premium_100: ['premium'],
  claim_ref: ['claim', 'clm'], date_of_loss: ['loss', 'dol'], paid_100: ['paid', 'settled'], outstanding_100: ['outstanding', 'still open'], lob: ['class', 'line'], cause: ['cause'],
}

export function aiExtract(db: Record<string, Row[]>, body: Row, role: string | null, userId: string | null, demo: boolean): { status: number; body: Row } {
  const setting = (k: string) => db.settings.find((s) => s.key === k)?.value
  const log = (status: string, extra: Row = {}) => {
    const me = Object.values(USERS).find((u) => u.id === userId)
    const row = { id: crypto.randomUUID(), user_id: userId, kind: body.kind, provider: 'anthropic', model: 'claude-haiku-5-5', status, created_at: new Date().toISOString(), is_demo: demo, input_tokens: null, output_tokens: null, file_name: null, file_bytes: null, duration_ms: 900, error: null, ...extra }
    ;(db.ai_usage_log ??= []).push(row)
    ;(db.ai_usage_v ??= []).push({ ...row, user_name: me?.full_name ?? null, user_role: role, search_text: [me?.full_name, body.kind, status, extra.file_name].filter(Boolean).join(' ').toLowerCase() })
  }
  if (setting('ai_enabled') !== true || !role || !((setting('ai_roles') as string[]) ?? []).includes(role)) {
    log('disabled')
    return { status: 403, body: { error: 'AI-assisted entry is switched off for your role', code: 'disabled' } }
  }
  if (body.kind === 'submission') {
    const file = body.file as { name?: string; base64?: string } | undefined
    const key = file?.base64 ?? String(body.text ?? '')
    const cached = (db.ai_cache ??= []).find((c) => c.cache_key === key && c.is_demo === demo)
    const extra = { file_name: file?.name ?? null, file_bytes: file?.base64 ? Math.floor((file.base64.length * 3) / 4) : String(body.text ?? '').length }
    if (cached) {
      log('cached', extra)
      return { status: 200, body: { ...(cached.result as Row), cached: true, model: 'claude-haiku-5-5' } }
    }
    db.ai_cache.push({ cache_key: key, is_demo: demo, kind: 'submission', model: 'claude-haiku-5-5', result: AI_SLIP, hits: 0 })
    log('ok', { ...extra, input_tokens: 3120, output_tokens: 640 })
    return { status: 200, body: { ...AI_SLIP, cached: false, model: 'claude-haiku-5-5' } }
  }
  const targets = (body.targets as { key: string }[]) ?? []
  const columns = (body.columns as string[]) ?? []
  const used = new Set<string>()
  const mapping = targets.map((t) => {
    const col = columns.find((c) => !used.has(c) && (WORDS[t.key] ?? []).some((w) => c.toLowerCase().includes(w)))
    if (col) used.add(col)
    return { field: t.key, column: col ?? null, confidence: col ? 0.9 : 0, reason: col ? `Title «${col}»` : 'No matching column' }
  })
  log('ok', { input_tokens: 410, output_tokens: 220 })
  return { status: 200, body: { mapping, header_row: body.header_row ?? 1, cached: false } }
}
