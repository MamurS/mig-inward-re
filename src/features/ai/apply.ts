/**
 * From the AI's answer to suggested form values: every field checked against
 * the system's own lists (line of business code → id, ISO country and
 * currency, MGA / broker by fuzzy name) and formats (dates, exact decimals).
 * A value that does not fit is not suggested; the reason is shown instead.
 * Pure: no React, no Supabase.
 */
import { isDecimal, parseDecimalInput } from '@/lib/decimal'
import { matchParty, SURE_MATCH, type Party, type PartyMatch } from './match'

export type AiField = { value: string | null; confidence: number; source: string | null }
export type AiSubmission = { fields: Record<string, AiField>; notes: string[]; cached?: boolean; model?: string }

/** form field ← AI field (the order the panel lists them in) */
export const FORM_FIELDS: { form: string; ai: string; type: 'text' | 'date' | 'amount' | 'pct' | 'days' | 'country' | 'currency' | 'lob' | 'mga' | 'broker' }[] = [
  { form: 'insured_name', ai: 'insured_name', type: 'text' },
  { form: 'insured_country', ai: 'insured_country', type: 'country' },
  { form: 'mga_id', ai: 'mga_name', type: 'mga' },
  { form: 'broker_id', ai: 'broker_name', type: 'broker' },
  { form: 'lob_id', ai: 'lob_code', type: 'lob' },
  { form: 'risk_description', ai: 'risk_description', type: 'text' },
  { form: 'period_from', ai: 'period_from', type: 'date' },
  { form: 'period_to', ai: 'period_to', type: 'date' },
  { form: 'currency', ai: 'currency', type: 'currency' },
  { form: 'sum_insured_100', ai: 'sum_insured_100', type: 'amount' },
  { form: 'limit_100', ai: 'limit_100', type: 'amount' },
  { form: 'deductible', ai: 'deductible', type: 'amount' },
  { form: 'gross_premium_100', ai: 'gross_premium_100', type: 'amount' },
  { form: 'commission_pct', ai: 'commission_pct', type: 'pct' },
  { form: 'brokerage_pct', ai: 'brokerage_pct', type: 'pct' },
  { form: 'written_share_pct', ai: 'written_share_pct', type: 'pct' },
  { form: 'ppw_date', ai: 'ppw_date', type: 'date' },
  { form: 'payment_terms_days', ai: 'payment_terms_days', type: 'days' },
  { form: 'offer_valid_until', ai: 'offer_valid_until', type: 'date' },
]

export type Suggestion = {
  form: string
  /** the value the form would take ('' = none) */
  value: string
  /** what the document says, for the reviewer */
  raw: string | null
  /** shown instead of the raw value (a matched name, a line's name) */
  display: string | null
  confidence: number
  source: string | null
  /** why the value cannot be used as it is (then value = '') */
  problem: 'unknownLob' | 'unknownCountry' | 'unknownCurrency' | 'noMatch' | 'unsureMatch' | 'badDate' | 'badNumber' | null
  matches?: PartyMatch[]
}

export type Lists = {
  /** `label`: the name in the UI language (shown); `name` (English) is also matched. */
  lobs: { id: string; code: string; name: string; label?: string }[]
  countries: { code: string }[]
  currencies: { code: string }[]
  parties: Party[]
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
function validDate(v: string) {
  if (!DATE.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

export function toSuggestions(ai: AiSubmission, lists: Lists): Suggestion[] {
  return FORM_FIELDS.flatMap((f) => {
    const x = ai.fields[f.ai]
    if (!x || x.value === null || x.value.trim() === '') return []
    const raw = x.value.trim()
    const s: Suggestion = { form: f.form, value: '', raw, display: null, confidence: x.confidence, source: x.source, problem: null }
    switch (f.type) {
      case 'text':
        s.value = raw
        break
      case 'date':
        if (validDate(raw)) s.value = raw
        else s.problem = 'badDate'
        break
      case 'amount':
      case 'pct': {
        // the model is asked for plain numbers with a dot (supabase/functions/ai-extract/schemas.ts), so read them the English way
        const n = parseDecimalInput(raw, f.type, 'en')
        if (n !== null && isDecimal(n, f.type === 'pct' ? 6 : 2) && !n.startsWith('-') && (f.type === 'amount' || Number(n) <= 100)) s.value = n
        else s.problem = 'badNumber'
        break
      }
      case 'days':
        if (/^\d{1,4}$/.test(raw)) s.value = raw
        else s.problem = 'badNumber'
        break
      case 'country': {
        const code = raw.toUpperCase()
        if (lists.countries.some((c) => c.code === code)) s.value = code
        else s.problem = 'unknownCountry'
        break
      }
      case 'currency': {
        const code = raw.toUpperCase()
        if (lists.currencies.some((c) => c.code === code)) s.value = code
        else s.problem = 'unknownCurrency'
        break
      }
      case 'lob': {
        const l = lists.lobs.find((x2) => x2.code.toLowerCase() === raw.toLowerCase() || x2.name.toLowerCase() === raw.toLowerCase())
        if (l) {
          s.value = l.id
          s.display = `${l.code} · ${l.label ?? l.name}`
        } else s.problem = 'unknownLob'
        break
      }
      case 'mga':
      case 'broker': {
        const m = matchParty(raw, lists.parties.filter((p) => p.active !== false), f.type)
        s.matches = m
        if (m[0] && m[0].score >= SURE_MATCH) {
          s.value = m[0].party.id
          s.display = m[0].party.name
          // the suggestion is only as sure as both the reading and the match
          s.confidence = Math.min(x.confidence, m[0].score)
        } else s.problem = m.length ? 'unsureMatch' : 'noMatch'
        break
      }
    }
    return [s]
  })
}

/** The suggestions to tick by default: usable and at least medium confidence. */
export function defaultPicks(s: Suggestion[]): Set<string> {
  return new Set(s.filter((x) => x.value !== '' && x.confidence >= 0.5).map((x) => x.form))
}
