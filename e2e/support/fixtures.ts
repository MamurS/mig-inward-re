/**
 * Offline demo data for the browser checks and screenshots: the same 22
 * submissions as supabase/seed.sql, with dates relative to today and every
 * figure computed by the app's own money maths (src/lib/decimal.ts), so the
 * screens look exactly as they would against the database — without one.
 */
import { norm } from '../../src/features/search/normalize'
import { calcFigures } from '../../src/lib/decimal'

type Row = Record<string, unknown>

const DAY = 86_400_000
const now = Date.now()
const iso = (msAgo: number) => new Date(now - msAgo).toISOString()
const date = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString().slice(0, 10)
const plusDays = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10)

export const USERS = {
  admin: { id: '00000000-0000-4000-8000-000000000001', email: 'admin@mig.example', full_name: 'Dilshod Admin', role: 'admin' },
  underwriter: { id: '00000000-0000-4000-8000-000000000002', email: 'uw@mig.example', full_name: 'Malika Karimova', role: 'underwriter' },
  management: { id: '00000000-0000-4000-8000-000000000003', email: 'ceo@mig.example', full_name: 'Rustam Aliyev', role: 'management' },
  finance: { id: '00000000-0000-4000-8000-000000000004', email: 'fin@mig.example', full_name: 'Nodira Saidova', role: 'finance' },
} as const
export type FixtureRole = keyof typeof USERS

const profiles: Row[] = Object.values(USERS).map((u) => ({
  ...u,
  active: true,
  preferred_language: 'en',
  ui_theme: 'grey',
  ui_text_size: 'normal',
  created_at: iso(200 * DAY),
  updated_at: iso(200 * DAY),
}))
const UW = USERS.underwriter.id

const currencies: Row[] = [
  ['USD', 'US Dollar', 1], ['EUR', 'Euro', 2], ['GBP', 'Pound Sterling', 3], ['UZS', 'Uzbek Sum', 4],
  ['AED', 'UAE Dirham', 10], ['KZT', 'Kazakhstani Tenge', 11], ['TRY', 'Turkish Lira', 12],
].map(([code, name, sort_order]) => ({ code, name, sort_order, active: true }))

const countries: Row[] = [
  ['UZ', 'Uzbekistan', 'Узбекистан', "O'zbekiston"], ['KZ', 'Kazakhstan', 'Казахстан', "Qozog'iston"],
  ['KG', 'Kyrgyzstan', 'Кыргызстан', "Qirg'iziston"], ['AZ', 'Azerbaijan', 'Азербайджан', 'Ozarbayjon'],
  ['GE', 'Georgia', 'Грузия', 'Gruziya'], ['TR', 'Turkey', 'Турция', 'Turkiya'], ['AE', 'United Arab Emirates', 'ОАЭ', 'BAA'],
  ['SA', 'Saudi Arabia', 'Саудовская Аравия', 'Saudiya Arabistoni'], ['OM', 'Oman', 'Оман', 'Ummon'], ['GB', 'United Kingdom', 'Великобритания', 'Buyuk Britaniya'],
].map(([code, name, name_ru, name_uz]) => ({ code, name, name_ru, name_uz, active: true }))

const LOB = [
  ['PROP', 'Property', 'Имущество', 'Mulk'], ['ENG', 'Engineering & Construction', 'Строительно-монтажные риски', 'Muhandislik va qurilish'],
  ['ENER', 'Energy', 'Энергетика', 'Energetika'], ['CARGO', 'Marine Cargo', 'Грузы', 'Yuklar'], ['HULL', 'Marine Hull', 'Каско судов', 'Kema kaskosi'],
  ['AVIA', 'Aviation', 'Авиация', 'Aviatsiya'], ['CRED', 'Credit & Surety', 'Кредит и поручительство', 'Kredit va kafillik'],
  ['FINL', 'Financial Lines (D&O, PI, FI)', 'Финансовые риски (D&O, PI, FI)', 'Moliyaviy xavflar (D&O, PI, FI)'],
  ['CYBER', 'Cyber', 'Кибер-риски', 'Kiber xavflar'], ['AGRI', 'Agriculture', 'Сельское хозяйство', "Qishloq xo'jaligi"],
]
const lines_of_business: Row[] = LOB.map(([code, name, name_ru, name_uz], i) => ({
  id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, code, name, name_ru, name_uz, active: true, sort_order: (i + 1) * 10,
}))
const lobId = (code: string) => lines_of_business.find((l) => l.code === code)!.id as string
const lobName = (code: string) => lines_of_business.find((l) => l.code === code)!.name as string

const CP = [
  ['Silk Road Underwriting Agency', 'mga', 'AE', 'Farhod Karimov', 'Managing Director'],
  ['Caspian Specialty MGA', 'mga', 'KZ', 'Aigerim Nurlanova', 'Head of Underwriting'],
  ['Meridian Risk Partners', 'mga', 'GB', 'James Whitfield', 'Class Underwriter'],
  ['Tashkent Re Brokers', 'broker', 'UZ', 'Dilnoza Rakhimova', 'Account Executive'],
  ['Gulf Placement Partners', 'broker', 'AE', 'Omar Haddad', 'Partner'],
  ['Anadolu Re (run-off)', 'cedent', 'TR', 'Mehmet Yılmaz', 'Run-off Manager'], // inactive
  // demo data (is_demo): only users in demo mode see these
  ['DEMO Anatolia MGA', 'mga', 'TR', 'Elif Demir', 'Managing Director'],
  ['DEMO Bosphorus Re Brokers', 'broker', 'TR', 'Kerem Aydin', 'Senior Broker'],
] as const
const counterparties: Row[] = CP.map(([name, type, country_code, contact, role], i) => ({
  id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  name, type, country_code, active: type !== 'cedent', notes: null, is_demo: name.startsWith('DEMO '),
  contacts: [{ name: contact, role, email: `${contact.split(' ')[0].toLowerCase()}@example.com`, phone: '+998 71 000 0000' }],
  created_at: iso(300 * DAY), created_by: null, updated_at: iso(300 * DAY), updated_by: null,
}))
const cpId = (name: string | null) => (name ? (counterparties.find((c) => c.name === name)?.id as string) : null)

// FX: 1st of each month, same drift formula as seed.sql
const FX_BASE: Record<string, [number, number]> = {
  EUR: [1.08, 0.02], GBP: [1.27, 0.01], UZS: [0.0000785, -0.05], AED: [0.27228, 0], KZT: [0.002, -0.06], TRY: [0.029, -0.25],
}
const fx_rates: Row[] = []
for (const [ccy, [rate, drift]] of Object.entries(FX_BASE)) {
  const start = new Date('2025-01-01T00:00:00Z')
  for (let d = new Date(start); d <= new Date(now); d.setUTCMonth(d.getUTCMonth() + 1)) {
    const years = (d.getTime() - start.getTime()) / (365 * DAY)
    fx_rates.push({ currency: ccy, rate_date: d.toISOString().slice(0, 10), rate_to_usd: Number((rate * (1 + drift * years)).toFixed(10)), source: 'demo' })
  }
}
export function fxRate(ccy: string, on: string): number | null {
  if (ccy === 'USD') return 1
  const rows = fx_rates.filter((r) => r.currency === ccy).sort((a, b) => String(a.rate_date).localeCompare(String(b.rate_date)))
  const before = rows.filter((r) => String(r.rate_date) <= on).at(-1) ?? rows[0]
  return before ? (before.rate_to_usd as number) : null
}

// insured, country, lob, mga, broker, biz, ccy, si, limit, ded, gp, comm, brok, written, signed, path, received, review, offer, noresp, final, validity, reason, risk
type Spec = [string, string, string, string, string | null, string, string, number, number, number, number, number, number, number | null, number | null, string[], number, number | null, number | null, number | null, number | null, number | null, string | null, string]
const SPECS: Spec[] = [
  ['Navoiyazot Chemical Plant', 'UZ', 'PROP', 'Silk Road Underwriting Agency', 'Tashkent Re Brokers', 'facultative', 'USD', 180000000, 60000000, 500000, 720000, 22.5, 5, 10, 8, ['under_review', 'offered', 'bound'], 400, 396, 390, null, 380, 30, null, 'Chemical plant, fire & explosion, BI 12 months'],
  ['Tashkent City Mall', 'UZ', 'PROP', 'Silk Road Underwriting Agency', 'Tashkent Re Brokers', 'facultative', 'USD', 95000000, 95000000, 250000, 285000, 25, 5, 15, 12.5, ['under_review', 'offered', 'bound'], 280, 277, 268, null, 250, 30, null, 'Shopping mall PD/BI, earthquake zone 8'],
  ['Almalyk MMC Fleet Cargo Programme', 'UZ', 'CARGO', 'Caspian Specialty MGA', null, 'binder', 'USD', 40000000, 5000000, 25000, 410000, 27.5, 0, 20, 20, ['under_review', 'offered', 'bound'], 200, 198, 192, null, 180, 30, null, 'Annual cargo open cover, copper concentrate'],
  ['Kazakh Telecom Cyber Programme', 'KZ', 'CYBER', 'Caspian Specialty MGA', 'Gulf Placement Partners', 'facultative', 'USD', 20000000, 20000000, 250000, 640000, 20, 7.5, 10, 7.5, ['under_review', 'offered', 'bound'], 140, 137, 131, null, 120, 30, null, 'Primary cyber tower, USD 20m xs 250k'],
  ['Georgian Wine Exporters Credit', 'GE', 'CRED', 'Meridian Risk Partners', null, 'facultative', 'EUR', 12000000, 12000000, 100000, 168000, 30, 0, 15, 15, ['under_review', 'offered', 'no_response', 'bound'], 110, 108, 100, 65, 50, 30, null, 'Trade credit whole turnover, EU buyers'],
  ['Emirates Aviation Services Hull', 'AE', 'AVIA', 'Silk Road Underwriting Agency', 'Gulf Placement Partners', 'facultative', 'USD', 310000000, 310000000, 1000000, 1550000, 17.5, 5, 5, 5, ['under_review', 'offered', 'bound'], 90, 88, 82, null, 70, 30, null, 'Hull all risks + war, 6 narrow-body aircraft'],
  ['Bukhara Gas Compressor Station', 'UZ', 'ENER', 'Silk Road Underwriting Agency', 'Tashkent Re Brokers', 'facultative', 'USD', 75000000, 75000000, 1000000, 525000, 20, 5, 10, null, ['under_review', 'offered', 'no_response'], 80, 78, 70, 35, null, 30, null, 'Onshore energy PD, gas compression'],
  ['Ankara Metro Rolling Stock', 'TR', 'ENG', 'Meridian Risk Partners', null, 'facultative', 'EUR', 140000000, 140000000, 500000, 392000, 25, 0, 7.5, null, ['under_review', 'offered', 'ntu'], 75, 73, 65, null, 45, 30, 'Placed with another reinsurer at a lower rate', 'CAR/EAR rolling stock delivery & testing'],
  ['Riyadh Logistics Hub', 'SA', 'PROP', 'Silk Road Underwriting Agency', 'Gulf Placement Partners', 'facultative', 'USD', 60000000, 60000000, 250000, 132000, 22.5, 5, 10, null, ['under_review', 'offered'], 60, 58, 50, null, null, 21, null, 'Warehouse complex PD, high-value stock'],
  ['Ferghana Textile Mills', 'UZ', 'PROP', 'Caspian Specialty MGA', 'Tashkent Re Brokers', 'facultative', 'UZS', 250000000000, 250000000000, 1000000000, 1875000000, 20, 5, null, null, ['under_review', 'declined'], 55, 52, null, null, 48, null, 'Poor fire protection; 5-year loss ratio above 140%', 'Textile mills fire & allied perils'],
  ['Bishkek Hydro Cascade', 'KG', 'ENER', 'Caspian Specialty MGA', null, 'facultative', 'USD', 210000000, 100000000, 2000000, 840000, 20, 0, null, null, ['under_review', 'declined'], 40, 38, null, null, 33, null, 'Outside appetite: dam risk, no loss history available', 'Hydro power plants cascade, PD/BI'],
  ['Muscat Desalination Plant', 'OM', 'ENER', 'Silk Road Underwriting Agency', 'Gulf Placement Partners', 'facultative', 'USD', 120000000, 120000000, 500000, 480000, 20, 5, 7.5, null, ['under_review', 'offered'], 35, 33, 28, null, null, 45, null, 'Desalination plant operational PD/BI'],
  ['Baku Data Centre', 'AZ', 'CYBER', 'Caspian Specialty MGA', null, 'facultative', 'USD', 15000000, 15000000, 100000, 300000, 20, 0, 10, null, ['under_review', 'offered'], 25, 23, 18, null, null, 30, null, 'Cyber & tech E&O, tier-III data centre'],
  ['London Market D&O Lineslip — Central Asia', 'GB', 'FINL', 'Meridian Risk Partners', null, 'binder', 'GBP', 25000000, 25000000, 50000, 450000, 27.5, 0, 12.5, null, ['under_review', 'offered'], 20, 18, 12, null, null, 30, null, 'D&O lineslip for Central Asian listed companies'],
  ['Gulf Pharma Distribution', 'AE', 'CARGO', 'Silk Road Underwriting Agency', 'Gulf Placement Partners', 'facultative', 'USD', 18000000, 3000000, 10000, 126000, 25, 5, null, null, ['under_review'], 15, 13, null, null, null, null, null, 'Cold-chain pharma cargo, GCC distribution'],
  ['Caspian Offshore Supply Vessels', 'AZ', 'HULL', 'Caspian Specialty MGA', null, 'facultative', 'USD', 48000000, 48000000, 150000, 336000, 20, 0, null, null, ['under_review'], 12, 10, null, null, null, null, null, 'Hull & machinery, 4 offshore supply vessels'],
  ['Aktau Port Cargo Programme', 'KZ', 'CARGO', 'Caspian Specialty MGA', 'Tashkent Re Brokers', 'binder', 'USD', 30000000, 4000000, 15000, 270000, 25, 5, 15, null, ['under_review', 'offered'], 10, 8, 3, null, null, 30, null, 'Port storage & transit cargo binder'],
  ['Samarkand Solar Park', 'UZ', 'ENG', 'Meridian Risk Partners', 'Tashkent Re Brokers', 'facultative', 'USD', 85000000, 85000000, 250000, 212500, 22.5, 5, null, null, ['under_review'], 9, 7, null, null, null, null, null, 'CAR 200 MW solar PV, 18-month construction'],
  ['Tashkent Metro Extension Lot 3', 'UZ', 'ENG', 'Silk Road Underwriting Agency', 'Tashkent Re Brokers', 'facultative', 'UZS', 900000000000, 900000000000, 2500000000, 4050000000, 20, 5, null, null, ['under_review'], 6, 5, null, null, null, null, null, 'CAR tunnelling works, 6.4 km'],
  ['Almaty Grain Terminal JSC', 'KZ', 'AGRI', 'Caspian Specialty MGA', null, 'facultative', 'USD', 22000000, 22000000, 50000, 154000, 20, 0, null, null, [], 4, null, null, null, null, null, null, 'Grain elevator & stock, fire/explosion'],
  ['Navoi Mining Logistics LLC', 'UZ', 'PROP', 'Silk Road Underwriting Agency', 'Tashkent Re Brokers', 'facultative', 'USD', 35000000, 35000000, 100000, 105000, 22.5, 5, null, null, [], 2, null, null, null, null, null, null, 'Mining logistics depot PD'],
  ['Dubai Marina Tower 7', 'AE', 'PROP', 'Meridian Risk Partners', 'Gulf Placement Partners', 'facultative', 'AED', 550000000, 550000000, 1000000, 1100000, 25, 5, null, null, [], 1, null, null, null, null, null, null, 'Residential high-rise PD, terrorism excluded'],
]

// demo submissions (is_demo, DEMO-SUB numbers): hidden unless the user is in demo mode
const DEMO_SPECS: Spec[] = [
  ['DEMO Izmir Port Logistics Centre', 'TR', 'PROP', 'DEMO Anatolia MGA', 'DEMO Bosphorus Re Brokers', 'facultative', 'USD', 120000000, 120000000, 500000, 600000, 22.5, 5, 10, 10, ['under_review', 'offered', 'bound'], 130, 127, 120, null, 110, 30, null, 'Container terminal PD/BI, earthquake zone 1'],
  ['DEMO Konya Solar Field', 'TR', 'ENG', 'DEMO Anatolia MGA', 'DEMO Bosphorus Re Brokers', 'facultative', 'USD', 65000000, 65000000, 200000, 195000, 22.5, 5, 12.5, null, ['under_review', 'offered'], 70, 68, 62, null, null, 30, null, 'Operational PV plant, hail and fire'],
  ['DEMO Gaziantep Textile Park', 'TR', 'PROP', 'DEMO Anatolia MGA', null, 'facultative', 'USD', 70000000, 70000000, 250000, 210000, 22.5, 0, null, null, [], 3, null, null, null, null, null, null, 'Textile park fire & earthquake'],
]

const submissions: Row[] = []
const submission_status_history: Row[] = []
const follow_ups: Row[] = []
const counters: Record<string, number> = {}

function build(s: Spec, idx: number, demo: boolean) {
    const [insured, country, lob, mga, broker, biz, ccy, si, lim, ded, gp, comm, brok, written, signed, path, dRec, dRev, dOff, dNr, dFin, validity, reason, risk] = s
    const id = `${demo ? '3d000000' : '30000000'}-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`
    const received = date(dRec)
    const year = Number(received.slice(0, 4))
    const series = `${demo ? 'DEMO-' : ''}SUB-${year}`
    counters[series] = (counters[series] ?? 0) + 1
    const status = path.at(-1) ?? 'received'
    const offeredAt = dOff !== null && path.includes('offered') ? iso(dOff * DAY) : null
    const boundAt = status === 'bound' ? iso(dFin! * DAY) : null
    const stepAgo = (st: string) => (st === 'under_review' ? dRev : st === 'offered' ? dOff : st === 'no_response' ? dNr : dFin)!
    const statusChangedAt = path.length ? iso(stepAgo(path.at(-1)!) * DAY) : iso(dRec * DAY)

    const share = status === 'bound' ? signed : written
    const rate = fxRate(ccy, boundAt ? boundAt.slice(0, 10) : received)
    const f = calcFigures({ grossPremium100: String(gp), sumInsured100: String(si), limit100: String(lim), sharePct: share === null ? null : String(share), commissionPct: String(comm), brokeragePct: String(brok), fxRateToUsd: rate })
    const num = (v: string | null) => (v === null ? null : Number(v))
    const offerValid = offeredAt && validity ? plusDays(offeredAt.slice(0, 10), validity) : null

    // history
    let prev: string | null = null
    submission_status_history.push({ id: submission_status_history.length + 1, submission_id: id, from_status: null, to_status: 'received', written_share_pct: null, signed_share_pct: null, comment: 'Submission registered', document_id: null, changed_by: UW, changed_at: iso(dRec * DAY), is_demo: demo })
    prev = 'received'
    for (const st of path) {
      submission_status_history.push({
        id: submission_status_history.length + 1, submission_id: id, from_status: prev, to_status: st,
        written_share_pct: ['offered', 'bound', 'ntu', 'no_response'].includes(st) ? written : null,
        signed_share_pct: st === 'bound' ? signed : null,
        comment: st === 'declined' || st === 'ntu' ? reason : st === 'bound' ? 'Firm order received from MGA' : st === 'offered' ? 'Quote sent' : null,
        document_id: null, changed_by: UW, changed_at: iso(stepAgo(st) * DAY), is_demo: demo,
      })
      prev = st
    }

    // follow-ups: one request_update per offer; open while offered
    let next: string | null = null
    if (offeredAt) {
      const due = new Date(new Date(offeredAt).getTime() + 7 * DAY).toISOString()
      const open = status === 'offered'
      const doneAgo = status === 'offered' ? null : stepAgo(path[path.indexOf('offered') + 1])
      follow_ups.push({
        id: `40000000-0000-4000-8000-${String(follow_ups.length + 1).padStart(12, '0')}`, entity_type: 'submission', entity_id: id, type: 'request_update',
        title: 'Request update on offer', due_at: due, assigned_to: UW, done_at: open ? null : iso(doneAgo! * DAY), done_by: open ? null : UW,
        outcome: open ? null : `Closed automatically: status changed to ${path[path.indexOf('offered') + 1]}`, created_at: offeredAt, created_by: UW, updated_at: offeredAt, is_demo: demo,
      })
      if (open) next = due
      if (open && offerValid && offerValid < date(0)) {
        follow_ups.push({
          id: `40000000-0000-4000-8000-${String(follow_ups.length + 1).padStart(12, '0')}`, entity_type: 'submission', entity_id: id, type: 'offer_expiry',
          title: 'Offer validity has passed', due_at: `${offerValid}T00:00:00Z`, assigned_to: UW, done_at: null, done_by: null, outcome: null,
          created_at: iso(DAY), created_by: null, updated_at: iso(DAY), is_demo: demo,
        })
        if (`${offerValid}T00:00:00Z` < next!) next = `${offerValid}T00:00:00Z`
      }
    }

    const row: Row = {
      id, ref_no: `${series}-${String(counters[series]).padStart(4, '0')}`, received_at: received, is_demo: demo,
      source_party_id: cpId(broker) ?? cpId(mga), mga_id: cpId(mga), broker_id: cpId(broker), business_type: biz,
      insured_name: insured, insured_country: country, risk_description: risk, lob_id: lobId(lob),
      period_from: plusDays(received, 30), period_to: plusDays(received, 395), currency: ccy,
      sum_insured_100: si, limit_100: lim, deductible: ded, gross_premium_100: gp, commission_pct: comm, brokerage_pct: brok,
      written_share_pct: written, signed_share_pct: status === 'bound' ? signed : null, offer_valid_until: offerValid,
      payment_terms_days: 90, ppw_date: null, status, decision_reason: status === 'declined' || status === 'ntu' ? reason : null,
      underwriter_id: UW, next_follow_up_at: next, status_changed_at: statusChangedAt, offered_at: offeredAt, bound_at: boundAt,
      notes: null, created_at: iso(dRec * DAY), created_by: UW, updated_at: statusChangedAt, updated_by: UW,
      // view columns
      share_pct: share, fx_rate_to_usd: rate,
      our_gross_premium: num(f.ourGross), our_sum_insured: num(f.ourSumInsured), our_limit: num(f.ourLimit),
      commission_amount: num(f.commission), brokerage_amount: num(f.brokerage), deductions_amount: num(f.deductions), our_net_premium: num(f.ourNet),
      gross_premium_100_usd: rate === null ? null : Math.round(gp * rate * 100) / 100,
      our_gross_premium_usd: num(f.ourGrossUsd), our_net_premium_usd: num(f.ourNetUsd),
      sum_insured_100_usd: rate === null ? null : Math.round(si * rate * 100) / 100,
      mga_name: mga, broker_name: broker, source_party_name: broker ?? mga, source_party_type: broker ? 'broker' : 'mga',
      lob_code: lob, lob_name: lobName(lob), underwriter_name: USERS.underwriter.full_name,
      offer_expired: status === 'offered' && offerValid !== null && offerValid < date(0),
      follow_up_overdue: next !== null && next < new Date(now).toISOString(),
      days_since_offered: ['offered', 'no_response'].includes(status) && offeredAt ? Math.floor((now - new Date(offeredAt).getTime()) / DAY) : null,
    }
    // search_text, as public.search_norm(concat_ws(' ', …)) builds it in the view
    const ctry = countries.find((c) => c.code === country)
    const l = lines_of_business.find((x) => x.code === lob)
    row.search_text = norm(
      [row.ref_no, insured, risk, mga, broker, broker ?? mga, country, ctry?.name, ctry?.name_ru, ctry?.name_uz, lob, l?.name, l?.name_ru, l?.name_uz, null]
        .filter((x) => x !== null && x !== undefined).join(' '),
    )
    submissions.push(row)
}
SPECS.slice()
  .sort((a, b) => b[16] - a[16])
  .forEach((s, idx) => build(s, idx, false))
DEMO_SPECS.forEach((s, idx) => build(s, idx, true))

const follow_ups_v: Row[] = follow_ups.map((f) => {
  const s = submissions.find((x) => x.id === f.entity_id)!
  const overdue = f.done_at === null && String(f.due_at) < new Date(now).toISOString()
  return {
    ...f, entity_ref: s.ref_no, entity_label: s.insured_name, submission_status: s.status, mga_id: s.mga_id, mga_name: s.mga_name,
    offer_valid_until: s.offer_valid_until, assigned_to_name: USERS.underwriter.full_name, done_by_name: f.done_by ? USERS.underwriter.full_name : null,
    is_overdue: overdue, days_overdue: overdue ? Math.floor((now - new Date(String(f.due_at)).getTime()) / DAY) : null,
  }
})

const settings: Row[] = [
  { key: 'follow_up_first_days', value: 7, description: null, updated_at: iso(DAY), updated_by: null },
  { key: 'follow_up_repeat_days', value: 7, description: null, updated_at: iso(DAY), updated_by: null },
  { key: 'auto_no_response_enabled', value: false, description: null, updated_at: iso(DAY), updated_by: null },
  { key: 'auto_no_response_days', value: 30, description: null, updated_at: iso(DAY), updated_by: null },
  { key: 'premium_grace_days', value: 0, description: null, updated_at: iso(DAY), updated_by: null },
  { key: 'premium_default_terms_days', value: 60, description: null, updated_at: iso(DAY), updated_by: null },
]

const job_runs: Row[] = [{ id: 1, job: 'daily_follow_ups', started_at: iso(5 * 3_600_000), finished_at: iso(5 * 3_600_000 - 400), result: { repeat_follow_ups: 0, expiry_flags: 1, moved_to_no_response: 0 }, error: null, started_by: null }]

/** Every table / view the app reads, by PostgREST name. */
export const TABLES: Record<string, Row[]> = {
  profiles, currencies, countries, lines_of_business, counterparties, fx_rates, settings, job_runs,
  submissions, submissions_v: submissions, submission_status_history, follow_ups, follow_ups_v,
  documents: [], audit_log: [], ref_counters: [],
}

/** What a user out of demo mode sees: the tables without the demo rows. */
export const SEEN: Record<string, Row[]> = Object.fromEntries(Object.entries(TABLES).map(([k, v]) => [k, v.filter((r) => !r.is_demo)]))
