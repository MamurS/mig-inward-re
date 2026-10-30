// What the AI is asked for, per kind: a strict JSON schema (every field gets a
// value, a confidence 0–1 and the snippet of the document it came from) and
// the instructions. Bump PROMPT_VERSION whenever either changes: it is part of
// the cache key.

export const PROMPT_VERSION = 'd1'

export type Kind = 'submission' | 'bordereau_mapping'

/** Fields read from a slip / submission e-mail / quote request. */
export const SUBMISSION_FIELDS: { key: string; hint: string }[] = [
  { key: 'insured_name', hint: 'the insured / original assured (company name as written)' },
  { key: 'insured_country', hint: 'country of the insured or the risk, as an ISO 3166 alpha-2 code (UZ, KZ, AE…)' },
  { key: 'mga_name', hint: 'the MGA / coverholder / managing agent offering the risk' },
  { key: 'broker_name', hint: 'the reinsurance broker placing it, if any' },
  { key: 'lob_code', hint: 'line of business: one of the codes listed below' },
  { key: 'risk_description', hint: 'one or two sentences: what is insured, perils, location' },
  { key: 'period_from', hint: 'inception date, YYYY-MM-DD' },
  { key: 'period_to', hint: 'expiry date, YYYY-MM-DD' },
  { key: 'currency', hint: 'ISO 4217 code of the amounts (USD, EUR, UZS…)' },
  { key: 'sum_insured_100', hint: 'total sum insured at 100 %, digits with a dot for decimals, no separators' },
  { key: 'limit_100', hint: 'limit of liability at 100 %, same format' },
  { key: 'deductible', hint: 'deductible / excess, same format' },
  { key: 'gross_premium_100', hint: 'gross premium at 100 %, same format' },
  { key: 'commission_pct', hint: 'ceding commission / MGA commission, percent as a number (27.5)' },
  { key: 'brokerage_pct', hint: 'brokerage, percent as a number' },
  { key: 'written_share_pct', hint: 'the share offered to or requested from us, percent as a number' },
  { key: 'ppw_date', hint: 'premium payment warranty date, YYYY-MM-DD' },
  { key: 'payment_terms_days', hint: 'premium payment terms in days, a whole number' },
  { key: 'offer_valid_until', hint: 'date the quote / offer is valid until, YYYY-MM-DD' },
]

const field = {
  type: 'object',
  properties: {
    value: { type: ['string', 'null'] },
    confidence: { type: 'number' },
    source: { type: ['string', 'null'] },
  },
  required: ['value', 'confidence', 'source'],
  additionalProperties: false,
}

export function submissionSchema() {
  return {
    type: 'object',
    properties: {
      fields: {
        type: 'object',
        properties: Object.fromEntries(SUBMISSION_FIELDS.map((f) => [f.key, field])),
        required: SUBMISSION_FIELDS.map((f) => f.key),
        additionalProperties: false,
      },
      notes: { type: 'array', items: { type: 'string' } },
    },
    required: ['fields', 'notes'],
    additionalProperties: false,
  }
}

export function submissionPrompt(lobs: { code: string; name: string }[]) {
  return [
    'You read inward reinsurance submissions (slips, quote requests, broker e-mails, schedules) for an underwriter and fill in the fields of a submission form.',
    'For every field return: value (or null when the document does not state it), confidence between 0 and 1 (1 = stated plainly; 0.5 = inferred; below 0.3 = a guess), and source: the exact short snippet of the document the value comes from (null when value is null).',
    'Never invent values. Amounts at 100 % unless the document says otherwise; if only our share is stated, leave the 100 % amount null and say so in notes. Dates as YYYY-MM-DD. Numbers without thousands separators.',
    'Documents may be in English, Russian or Uzbek; keep names as written.',
    'Fields:',
    ...SUBMISSION_FIELDS.map((f) => `- ${f.key}: ${f.hint}`),
    `Line of business codes: ${lobs.map((l) => `${l.code} (${l.name})`).join(', ')}.`,
    'In notes, list anything the underwriter should check (conflicting figures, missing pages, several risks in one document).',
  ].join('\n')
}

export function mappingSchema() {
  return {
    type: 'object',
    properties: {
      mapping: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            column: { type: ['string', 'null'] },
            confidence: { type: 'number' },
            reason: { type: 'string' },
          },
          required: ['field', 'column', 'confidence', 'reason'],
          additionalProperties: false,
        },
      },
      header_row: { type: 'integer' },
    },
    required: ['mapping', 'header_row'],
    additionalProperties: false,
  }
}

export function mappingPrompt() {
  return [
    'You map the columns of an MGA bordereau (risk, premium or claims) to the fields of a reinsurer\'s system.',
    'You get the target fields with their meaning, the file\'s column titles and a few sample rows.',
    'For every target field return the exact column title that holds it (or null when none does), a confidence between 0 and 1, and a short reason.',
    'Use each column at most once. Titles may be in English, Russian or Uzbek. Amounts at 100 % are preferred over our-share columns.',
    'header_row: the 1-based row of the column titles as you were given it (keep the given value unless the samples show the titles are elsewhere).',
  ].join('\n')
}
