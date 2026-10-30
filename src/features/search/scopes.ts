/**
 * What each page's search knows — its fields, values and keywords (EN / RU /
 * UZ), and how a query reaches its rows: in the database (server: a
 * PostgREST filter) or over the rows already loaded (client: small,
 * reference-sized lists). One parser (query.ts) reads them all.
 */
import type { ListField, Option, Scope, SearchContext } from './query'
import type { ServerSpec } from './postgrest'

const label = (ctx: SearchContext, key: string, fallback: string) => ctx.t?.(key) ?? fallback

// ---------------------------------------------------------------------------
// Submissions (the register)
// ---------------------------------------------------------------------------

export const STATUS_KEYS = ['received', 'under_review', 'offered', 'no_response', 'bound', 'declined', 'ntu'] as const
export type StatusKey = (typeof STATUS_KEYS)[number]

/** Every status in EN / RU / UZ, with the usual synonyms. */
export const STATUS_WORDS: Record<StatusKey, string[]> = {
  received: ['received', 'new', 'получена', 'получен', 'получено', 'новая', 'новые', 'qabulqilindi', 'qabul', 'yangi'],
  under_review: ['under_review', 'underreview', 'review', 'inreview', 'на рассмотрении', 'рассмотрение', 'korib chiqilmoqda', 'korib'],
  offered: ['offered', 'offer', 'quoted', 'предложение', 'предложена', 'котировка', 'taklif berildi', 'taklif'],
  no_response: ['no_response', 'noresponse', 'nores', 'нет ответа', 'безответа', 'javob yoq', 'javobsiz'],
  bound: ['bound', 'подтверждена', 'подтвержден', 'связан', 'связана', 'связанные', 'связанный', 'tasdiqlandi', 'tasdiqlangan', 'boglangan'],
  declined: ['declined', 'decline', 'отклонена', 'отклонено', 'отказ', 'rad etildi', 'rad', 'radetilgan'],
  ntu: ['ntu', 'nottakenup', 'не принята', 'qabulqilinmadi'],
}

const BUSINESS_TYPE_WORDS: Record<string, string[]> = {
  facultative: ['facultative', 'fac', 'факультатив', 'факультативный', 'fakultativ'],
  binder: ['binder', 'биндер'],
}

const NO_BROKER = ['none', 'direct', 'нет', 'прямой', 'прямая', 'без', 'yoq', 'togridan']
const MINE = ['mine', 'my', 'me', 'мои', 'мое', 'моё', 'я', 'mening', 'meniki']

const statusOptions = (ctx: SearchContext): Option[] =>
  STATUS_KEYS.map((s) => ({ value: s, label: label(ctx, `status.${s}`, s), insert: s, names: [...STATUS_WORDS[s], label(ctx, `status.${s}`, s)] }))

const partyOptions = (type: string) => (ctx: SearchContext): Option[] => [
  ...(type === 'broker' ? [{ value: 'none', label: label(ctx, 'sub.directNoBroker', '—'), insert: 'none', names: [], codes: NO_BROKER }] : []),
  ...ctx.counterparties.filter((c) => c.type === type).map((c) => ({ value: c.id, label: c.name, insert: c.name, names: [c.name] })),
]

const lobOptions = (ctx: SearchContext): Option[] =>
  ctx.lobs.map((l) => ({
    value: l.id, label: ctx.localName?.(l) ?? l.name, insert: l.name,
    names: [l.name, l.name_ru, l.name_uz].filter((x): x is string => Boolean(x)), codes: [l.code],
  }))

const countryOptions = (ctx: SearchContext): Option[] =>
  ctx.countries.map((c) => ({
    value: c.code, label: ctx.localName?.(c) ?? c.name, insert: c.code,
    names: [c.name, c.name_ru, c.name_uz].filter((x): x is string => Boolean(x)), codes: [c.code],
  }))

const currencyOptions = (ctx: SearchContext): Option[] => ctx.currencies.map((c) => ({ value: c, label: c, insert: c, names: [c] }))

const userOptions = (filter?: (u: SearchContext['users'][number]) => boolean) => (ctx: SearchContext): Option[] =>
  ctx.users.filter((u) => !filter || filter(u)).map((u) => ({ value: u.id, label: u.name, insert: u.name, names: [u.name], codes: u.id === ctx.userId ? MINE : [] }))

const businessTypeOptions = (ctx: SearchContext): Option[] =>
  Object.keys(BUSINESS_TYPE_WORDS).map((k) => ({ value: k, label: label(ctx, `businessType.${k}`, k), insert: k, names: [...BUSINESS_TYPE_WORDS[k], label(ctx, `businessType.${k}`, k)] }))

export const SUBMISSIONS: Scope = {
  id: 'submissions',
  fields: [
    { key: 'status', kind: 'list', aliases: ['state', 'статус', 'состояние', 'holat', 'holati'], labelKey: 'fields.status', options: statusOptions, partial: 'prefix' },
    { key: 'mga', kind: 'list', aliases: ['мга', 'agent', 'агент'], labelKey: 'fields.mga', options: partyOptions('mga'), partial: 'contains' },
    { key: 'broker', kind: 'list', aliases: ['брокер', 'vositachi'], labelKey: 'fields.broker', options: partyOptions('broker'), partial: 'contains' },
    { key: 'lob', kind: 'list', aliases: ['line', 'class', 'вид', 'класс', 'линия', 'yonalish', 'sinf', 'soha'], labelKey: 'fields.lob', options: lobOptions, partial: 'contains' },
    { key: 'country', kind: 'list', aliases: ['страна', 'mamlakat', 'davlat'], labelKey: 'fields.insuredCountry', options: countryOptions, partial: 'contains' },
    { key: 'ccy', kind: 'list', aliases: ['currency', 'cur', 'валюта', 'вал', 'valyuta'], labelKey: 'fields.currency', options: currencyOptions, partial: 'none' },
    { key: 'uw', kind: 'list', aliases: ['underwriter', 'андеррайтер', 'андер', 'anderrayter'], labelKey: 'fields.underwriter', options: userOptions(), partial: 'contains' },
    { key: 'type', kind: 'list', aliases: ['тип', 'turi', 'tur'], labelKey: 'fields.businessType', options: businessTypeOptions, partial: 'prefix' },
    { key: 'ref', kind: 'like', aliases: ['refno', 'номер', 'реф', 'raqam'], labelKey: 'fields.refNo' },
    { key: 'premium', kind: 'num', aliases: ['prem', 'премия', 'mukofot'], labelKey: 'search.f.premium' },
    { key: 'share', kind: 'num', aliases: ['доля', 'ulush'], labelKey: 'fields.share' },
    { key: 'si', kind: 'num', aliases: ['suminsured', 'sum', 'сумма', 'сс', 'summa'], labelKey: 'search.f.si' },
    { key: 'received', kind: 'date', looksBack: true, aliases: ['recv', 'получена', 'получено', 'поступила', 'qabul', 'qabulqilindi', 'kelgan'], labelKey: 'fields.receivedAt' },
    { key: 'inception', kind: 'date', looksBack: false, aliases: ['start', 'from', 'начало', 'с', 'boshlanish', 'boshi'], labelKey: 'fields.periodFrom' },
    { key: 'expiry', kind: 'date', looksBack: false, aliases: ['expires', 'end', 'to', 'окончание', 'конец', 'по', 'tugash', 'oxiri'], labelKey: 'fields.periodTo' },
    { key: 'bound', kind: 'date', looksBack: true, aliases: ['boundon', 'подтверждена', 'tasdiqlandi'], labelKey: 'fields.boundAt' },
  ],
  flags: [
    { flag: 'overdue', words: ['late', 'просрочено', 'просрочен', 'просроченные', 'просрочка', 'kechikkan', 'muddati otgan'], labelKey: 'search.flag.overdue' },
    { flag: 'expired', words: ['истекло', 'истек', 'истекшие', 'просроченное предложение', 'eskirgan', 'muddati tugagan'], labelKey: 'search.flag.expired' },
    { flag: 'mine', words: MINE.filter((w) => w !== 'me' && w !== 'я'), labelKey: 'search.flag.mine', needsUser: true },
  ],
  dateKeywordField: 'received',
  exactFields: ['status', 'ccy', 'mga', 'broker', 'lob', 'country'],
  weak: ['new', 'yangi', 'review', 'offer', 'quoted', 'taklif', 'qabul', 'rad', 'korib', 'decline', 'отказ', 'javobsiz', 'nores', 'my', 'late', 'week', 'month', 'hafta', 'неделя', 'месяц', 'с', 'по'],
}

export const SUBMISSIONS_SERVER: ServerSpec = {
  list: { status: 'status', mga: 'mga_id', broker: 'broker_id', lob: 'lob_id', country: 'insured_country', ccy: 'currency', uw: 'underwriter_id', type: 'business_type' },
  like: { ref: 'ref_no' },
  num: { premium: 'our_gross_premium_usd', share: 'share_pct', si: 'sum_insured_100_usd' },
  date: { received: 'received_at', inception: 'period_from', expiry: 'period_to', bound: 'bound_at' },
  flags: {
    overdue: (neg) => `follow_up_overdue.${neg ? 'not.is' : 'is'}.true`,
    expired: (neg) => `offer_expired.${neg ? 'not.is' : 'is'}.true`,
    mine: (neg, userId) => (!userId ? null : neg ? `or(underwriter_id.is.null,underwriter_id.neq.${userId})` : `underwriter_id.eq.${userId}`),
  },
  textColumn: 'search_text',
}


// ---------------------------------------------------------------------------
// Counterparties
// ---------------------------------------------------------------------------

const CP_TYPE_WORDS: Record<string, string[]> = {
  mga: ['mga', 'мга', 'agent', 'агент'],
  broker: ['broker', 'brokers', 'брокер', 'брокеры', 'vositachi'],
  cedent: ['cedent', 'cedents', 'цедент', 'цеденты', 'sedent'],
}
const cpTypeOptions = (ctx: SearchContext): Option[] =>
  Object.keys(CP_TYPE_WORDS).map((k) => ({ value: k, label: label(ctx, `counterpartyType.${k}`, k), insert: k, names: [...CP_TYPE_WORDS[k], label(ctx, `counterpartyType.${k}`, k)] }))

const COUNTRY_FIELD: ListField = { key: 'country', kind: 'list', aliases: ['страна', 'mamlakat', 'davlat'], labelKey: 'fields.country', options: countryOptions, partial: 'contains' }

export const COUNTERPARTIES: Scope = {
  id: 'counterparties',
  fields: [
    { key: 'type', kind: 'list', aliases: ['тип', 'turi', 'tur'], labelKey: 'cp.type', options: cpTypeOptions, partial: 'prefix' },
    COUNTRY_FIELD,
  ],
  flags: [{ flag: 'inactive', words: ['inactive', 'archived', 'неактивные', 'неактивный', 'архив', 'nofaol'], labelKey: 'search.flag.inactive' }],
  exactFields: ['type', 'country'],
  weak: ['agent', 'агент'],
}

// ---------------------------------------------------------------------------
// Agenda (follow-ups)
// ---------------------------------------------------------------------------

const FU_TYPE_WORDS: Record<string, string[]> = {
  request_update: ['request_update', 'request', 'update', 'запрос', 'запросить', 'sorov'],
  offer_expiry: ['offer_expiry', 'expiry', 'истечение', 'срок предложения', 'muddat'],
  premium_overdue: ['premium_overdue', 'premium', 'премия', 'mukofot'],
  other: ['other', 'другое', 'boshqa'],
}
const fuTypeOptions = (ctx: SearchContext): Option[] =>
  Object.keys(FU_TYPE_WORDS).map((k) => ({ value: k, label: label(ctx, `fuType.${k}`, k), insert: k, names: [...FU_TYPE_WORDS[k], label(ctx, `fuType.${k}`, k)] }))

const EVERYONE = ['all', 'everyone', 'anyone', 'все', 'всех', 'hamma', 'hammasi']
const assigneeOptions = (ctx: SearchContext): Option[] => [
  { value: 'all', label: label(ctx, 'agenda.everyone', 'Everyone'), insert: 'all', names: [], codes: EVERYONE },
  ...userOptions((u) => Boolean(u.role))(ctx),
]

export const AGENDA: Scope = {
  id: 'agenda',
  fields: [
    { key: 'assignee', kind: 'list', aliases: ['who', 'assigned', 'исполнитель', 'кто', 'masul', 'kim'], labelKey: 'fu.assignedTo', options: assigneeOptions, partial: 'contains' },
    { key: 'type', kind: 'list', aliases: ['тип', 'turi', 'tur'], labelKey: 'fu.type', options: fuTypeOptions, partial: 'prefix' },
    { key: 'due', kind: 'date', looksBack: false, aliases: ['срок', 'muddat'], labelKey: 'fu.due' },
  ],
  flags: [{ flag: 'overdue', words: ['late', 'просрочено', 'просрочен', 'просроченные', 'kechikkan', 'muddati otgan'], labelKey: 'search.flag.fuOverdue' }],
  dateKeywordField: 'due',
  exactFields: ['type'],
  weak: ['request', 'update', 'expiry', 'premium', 'other', 'late', 'week', 'month', 'hafta', 'неделя', 'месяц'],
}

// ---------------------------------------------------------------------------
// Admin: users, reference data, FX rates
// ---------------------------------------------------------------------------

const ROLE_WORDS: Record<string, string[]> = {
  admin: ['admin', 'админ', 'администратор', 'administrator'],
  underwriter: ['underwriter', 'uw', 'андеррайтер', 'anderrayter'],
  finance: ['finance', 'финансы', 'бухгалтерия', 'moliya'],
  claims: ['claims', 'убытки', 'zarar'],
  management: ['management', 'руководство', 'rahbariyat'],
}
const roleOptions = (ctx: SearchContext): Option[] =>
  Object.keys(ROLE_WORDS).map((k) => ({ value: k, label: label(ctx, `roles.${k}`, k), insert: k, names: [...ROLE_WORDS[k], label(ctx, `roles.${k}`, k)] }))

const ACTIVE_FLAGS = [
  { flag: 'active', words: ['активные', 'активный', 'faol'], labelKey: 'search.flag.active' },
  { flag: 'inactive', words: ['archived', 'неактивные', 'неактивный', 'архив', 'nofaol'], labelKey: 'search.flag.onlyInactive' },
]

export const USERS: Scope = {
  id: 'users',
  fields: [{ key: 'role', kind: 'list', aliases: ['роль', 'rol'], labelKey: 'admin.users.role', options: roleOptions, partial: 'prefix' }],
  flags: ACTIVE_FLAGS,
  exactFields: ['role'],
  weak: ['uw'],
}

export const REFERENCE: Scope = { id: 'reference', fields: [], flags: ACTIVE_FLAGS, exactFields: [], weak: [] }

export const FX: Scope = {
  id: 'fx',
  fields: [
    { key: 'ccy', kind: 'list', aliases: ['currency', 'cur', 'валюта', 'вал', 'valyuta'], labelKey: 'fields.currency', options: (ctx) => currencyOptions(ctx).filter((o) => o.value !== 'USD'), partial: 'none' },
    { key: 'date', kind: 'date', looksBack: true, aliases: ['дата', 'sana', 'on'], labelKey: 'admin.fx.date' },
    { key: 'source', kind: 'like', aliases: ['источник', 'manba'], labelKey: 'admin.fx.source' },
  ],
  flags: [],
  dateKeywordField: 'date',
  exactFields: ['ccy'],
  weak: [],
}

export const FX_SERVER: ServerSpec = {
  list: { ccy: 'currency' },
  like: { source: 'source' },
  num: {},
  date: { date: 'rate_date' },
  flags: {},
  textColumn: (w, neg) => `currency.${neg ? 'not.' : ''}ilike."*${w.replace(/["\\*%]/g, '')}*"`,
}

// ---------------------------------------------------------------------------
// Receipts (premium received)
// ---------------------------------------------------------------------------

const anyPartyOptions = (ctx: SearchContext): Option[] =>
  ctx.counterparties.map((c) => ({ value: c.id, label: c.name, insert: c.name, names: [c.name] }))

export const RECEIPTS: Scope = {
  id: 'receipts',
  fields: [
    { key: 'payer', kind: 'list', aliases: ['from', 'mga', 'broker', 'плательщик', 'от', 'tolovchi'], labelKey: 'rcp.payer', options: anyPartyOptions, partial: 'contains' },
    { key: 'ccy', kind: 'list', aliases: ['currency', 'cur', 'валюта', 'вал', 'valyuta'], labelKey: 'fields.currency', options: currencyOptions, partial: 'none' },
    { key: 'ref', kind: 'like', aliases: ['refno', 'номер', 'raqam'], labelKey: 'fields.refNo' },
    { key: 'bank', kind: 'like', aliases: ['bankref', 'swift', 'банк', 'bank_reference'], labelKey: 'rcp.bankReference' },
    { key: 'received', kind: 'date', looksBack: true, aliases: ['date', 'recv', 'получен', 'дата', 'sana', 'qabul'], labelKey: 'rcp.receivedDate' },
    { key: 'amount', kind: 'num', aliases: ['сумма', 'summa'], labelKey: 'rcp.amount' },
  ],
  flags: [
    { flag: 'unallocated', words: ['open', 'нераспределено', 'нераспределённые', 'taqsimlanmagan'], labelKey: 'search.flag.unallocated' },
    { flag: 'allocated', words: ['fully', 'распределено', 'taqsimlangan'], labelKey: 'search.flag.allocated' },
  ],
  dateKeywordField: 'received',
  exactFields: ['ccy', 'payer'],
  weak: ['open', 'fully', 'from', 'от'],
}

/** Receipts have no single normalised text column: free text looks at ref no., bank reference, payer and notes. */
const RECEIPT_TEXT = ['ref_no', 'bank_reference', 'payer_name', 'notes']
export const RECEIPTS_SERVER: ServerSpec = {
  list: { payer: 'payer_id', ccy: 'currency' },
  like: { ref: 'ref_no', bank: 'bank_reference' },
  num: { amount: 'amount' },
  date: { received: 'received_date' },
  flags: {
    unallocated: (neg) => `unallocated_amount.${neg ? 'lte' : 'gt'}.0`,
    allocated: (neg) => `unallocated_amount.${neg ? 'gt' : 'lte'}.0`,
  },
  textColumn: (w, neg) => {
    const v = `"*${w.replace(/["\\*%]/g, '')}*"`
    return neg ? `and(${RECEIPT_TEXT.map((c) => `or(${c}.is.null,${c}.not.ilike.${v})`).join(',')})` : `or(${RECEIPT_TEXT.map((c) => `${c}.ilike.${v}`).join(',')})`
  },
}

// ---------------------------------------------------------------------------
// Receivables (premium installments: what MGAs owe us, what we owe them back)
// ---------------------------------------------------------------------------

export const AGING_BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const
const bucketOptions = (): Option[] => AGING_BUCKETS.map((b) => ({ value: b, label: b, insert: b, names: [b] }))

const INSTALLMENT_STATUS_WORDS: Record<string, string[]> = {
  open: ['open', 'unpaid', 'открыт', 'открытые', 'не оплачен', 'ochiq', 'tolanmagan'],
  partially_paid: ['partially_paid', 'partly', 'partial', 'частично', 'частично оплачен', 'qisman'],
  paid: ['paid', 'оплачен', 'оплачено', 'оплаченные', 'tolangan'],
  written_off: ['written_off', 'writtenoff', 'writeoff', 'списан', 'списано', 'hisobdan chiqarilgan'],
}
const installmentStatusOptions = (ctx: SearchContext): Option[] =>
  Object.keys(INSTALLMENT_STATUS_WORDS).map((k) => ({ value: k, label: label(ctx, `prem.status.${k}`, k), insert: k, names: [...INSTALLMENT_STATUS_WORDS[k], label(ctx, `prem.status.${k}`, k)] }))

export const RECEIVABLES: Scope = {
  id: 'receivables',
  fields: [
    { key: 'mga', kind: 'list', aliases: ['мга', 'agent', 'агент'], labelKey: 'fields.mga', options: partyOptions('mga'), partial: 'contains' },
    { key: 'broker', kind: 'list', aliases: ['брокер', 'vositachi'], labelKey: 'fields.broker', options: partyOptions('broker'), partial: 'contains' },
    { key: 'uw', kind: 'list', aliases: ['underwriter', 'андеррайтер', 'андер', 'anderrayter'], labelKey: 'fields.underwriter', options: userOptions(), partial: 'contains' },
    { key: 'ccy', kind: 'list', aliases: ['currency', 'cur', 'валюта', 'вал', 'valyuta'], labelKey: 'fields.currency', options: currencyOptions, partial: 'none' },
    { key: 'bucket', kind: 'list', aliases: ['aging', 'ageing', 'age', 'корзина', 'возраст', 'yosh'], labelKey: 'rcv.bucket', options: bucketOptions, partial: 'none' },
    { key: 'status', kind: 'list', aliases: ['state', 'статус', 'holat', 'holati'], labelKey: 'fields.status', options: installmentStatusOptions, partial: 'prefix' },
    { key: 'ref', kind: 'like', aliases: ['refno', 'номер', 'реф', 'raqam'], labelKey: 'fields.refNo' },
    { key: 'overdue', kind: 'num', aliases: ['days', 'dpd', 'дней', 'просрочено', 'kun', 'kechikkan'], labelKey: 'rcv.daysOverdue' },
    { key: 'outstanding', kind: 'num', aliases: ['amount', 'left', 'остаток', 'сумма', 'qoldiq', 'summa'], labelKey: 'rcv.outstanding' },
    { key: 'due', kind: 'date', looksBack: false, aliases: ['duedate', 'срок', 'оплата', 'muddat', 'tolov'], labelKey: 'prem.dueDate' },
  ],
  flags: [
    { flag: 'overdue', words: ['late', 'просрочено', 'просрочен', 'просроченные', 'kechikkan', 'muddati otgan'], labelKey: 'search.flag.premOverdue' },
    { flag: 'payable', words: ['return', 'returns', 'к оплате', 'кредиторка', 'возврат', 'возвраты', 'qaytarish', 'tolanadigan'], labelKey: 'search.flag.payable' },
    { flag: 'mine', words: MINE.filter((w) => w !== 'me' && w !== 'я'), labelKey: 'search.flag.mine', needsUser: true },
  ],
  dateKeywordField: 'due',
  exactFields: ['ccy', 'mga', 'broker', 'bucket', 'status'],
  weak: ['open', 'paid', 'partly', 'partial', 'return', 'late', 'my', 'age', 'days', 'amount', 'left', 'week', 'month', 'hafta', 'неделя', 'месяц'],
}

/** Free text looks at the submission number, insured, MGA and broker. */
const RECEIVABLE_TEXT = ['ref_no', 'insured_name', 'mga_name', 'broker_name']
export const RECEIVABLES_SERVER: ServerSpec = {
  list: { mga: 'mga_id', broker: 'broker_id', uw: 'underwriter_id', ccy: 'currency', bucket: 'aging_bucket', status: 'status' },
  like: { ref: 'ref_no' },
  num: { overdue: 'days_overdue', outstanding: 'outstanding_amount' },
  date: { due: 'due_date' },
  flags: {
    overdue: (neg) => `days_overdue.${neg ? 'eq' : 'gt'}.0`,
    payable: (neg) => `payable_amount.${neg ? 'lte' : 'gt'}.0`,
    mine: (neg, userId) => (!userId ? null : neg ? `or(underwriter_id.is.null,underwriter_id.neq.${userId})` : `underwriter_id.eq.${userId}`),
  },
  textColumn: (w, neg) => {
    const v = `"*${w.replace(/["\\*%]/g, '')}*"`
    return neg ? `and(${RECEIVABLE_TEXT.map((c) => `or(${c}.is.null,${c}.not.ilike.${v})`).join(',')})` : `or(${RECEIVABLE_TEXT.map((c) => `${c}.ilike.${v}`).join(',')})`
  },
}

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

const CLAIM_STATUS_WORDS: Record<string, string[]> = {
  notified: ['notified', 'new', 'заявлен', 'заявлена', 'заявленные', 'новый', 'xabar', 'yangi'],
  open: ['open', 'открыт', 'открыта', 'открытые', 'ochiq'],
  reopened: ['reopened', 'переоткрыт', 'переоткрыта', 'qayta'],
  closed: ['closed', 'закрыт', 'закрыта', 'закрытые', 'yopilgan', 'yopiq'],
  declined: ['declined', 'отклонён', 'отклонен', 'отклонена', 'отказ', 'rad'],
}
const claimStatusOptions = (ctx: SearchContext): Option[] =>
  Object.keys(CLAIM_STATUS_WORDS).map((k) => ({ value: k, label: label(ctx, `claim.status.${k}`, k), insert: k, names: [...CLAIM_STATUS_WORDS[k], label(ctx, `claim.status.${k}`, k)] }))

export const CLAIMS: Scope = {
  id: 'claims',
  fields: [
    { key: 'status', kind: 'list', aliases: ['state', 'статус', 'holat', 'holati'], labelKey: 'fields.status', options: claimStatusOptions, partial: 'prefix' },
    { key: 'mga', kind: 'list', aliases: ['мга', 'agent', 'агент'], labelKey: 'fields.mga', options: partyOptions('mga'), partial: 'contains' },
    { key: 'broker', kind: 'list', aliases: ['брокер', 'vositachi'], labelKey: 'fields.broker', options: partyOptions('broker'), partial: 'contains' },
    { key: 'lob', kind: 'list', aliases: ['line', 'class', 'вид', 'класс', 'yonalish', 'sinf'], labelKey: 'fields.lob', options: lobOptions, partial: 'contains' },
    { key: 'handler', kind: 'list', aliases: ['adjuster', 'урегулировщик', 'ответственный', 'masul'], labelKey: 'claim.handler', options: userOptions((u) => u.role === 'claims' || u.role === 'admin'), partial: 'contains' },
    { key: 'uw', kind: 'list', aliases: ['underwriter', 'андеррайтер', 'anderrayter'], labelKey: 'fields.underwriter', options: userOptions(), partial: 'contains' },
    { key: 'ccy', kind: 'list', aliases: ['currency', 'cur', 'валюта', 'вал', 'valyuta'], labelKey: 'fields.currency', options: currencyOptions, partial: 'none' },
    { key: 'ref', kind: 'like', aliases: ['claimno', 'номер', 'raqam'], labelKey: 'claim.claimNo' },
    { key: 'dol', kind: 'date', looksBack: true, aliases: ['loss', 'dateofloss', 'убыток', 'дата убытка', 'zarar'], labelKey: 'claim.dateOfLoss' },
    { key: 'notified', kind: 'date', looksBack: true, aliases: ['reported', 'заявлен', 'xabar'], labelKey: 'claim.notifiedDate' },
    { key: 'outstanding', kind: 'num', aliases: ['os', 'reserve', 'остаток', 'резерв', 'qoldiq'], labelKey: 'claim.outstandingUsd' },
    { key: 'incurred', kind: 'num', aliases: ['понесено', 'kelgan'], labelKey: 'claim.incurredUsd' },
    { key: 'paid', kind: 'num', aliases: ['оплачено', 'tolangan'], labelKey: 'claim.paidUsd' },
  ],
  flags: [
    { flag: 'large', words: ['largeloss', 'крупный', 'крупные', 'yirik'], labelKey: 'search.flag.largeLoss' },
    { flag: 'cashcall', words: ['cash_call', 'кэшколл', 'денежный запрос', 'naqd'], labelKey: 'search.flag.cashCall' },
    { flag: 'review', words: ['stale', 'пересмотр', 'korib'], labelKey: 'search.flag.claimReview' },
    { flag: 'mine', words: MINE.filter((w) => w !== 'me' && w !== 'я'), labelKey: 'search.flag.myClaims', needsUser: true },
  ],
  dateKeywordField: 'notified',
  exactFields: ['status', 'mga', 'broker', 'lob', 'ccy'],
  weak: ['new', 'yangi', 'open', 'loss', 'reserve', 'os', 'stale', 'my', 'week', 'month', 'hafta', 'неделя', 'месяц'],
}

export const CLAIMS_SERVER: ServerSpec = {
  list: { status: 'status', mga: 'mga_id', broker: 'broker_id', lob: 'lob_id', handler: 'handler_id', uw: 'underwriter_id', ccy: 'currency' },
  like: { ref: 'claim_no' },
  num: { outstanding: 'outstanding_usd', incurred: 'incurred_usd', paid: 'paid_usd' },
  date: { dol: 'date_of_loss', notified: 'notified_date' },
  flags: {
    large: (neg) => `large_loss.is.${neg ? 'false' : 'true'}`,
    cashcall: (neg) => `cash_call_due_at.${neg ? 'is' : 'not.is'}.null`,
    review: (neg) => (neg ? 'days_since_reserve.lt.90' : 'and(days_since_reserve.gte.90,status.in.(notified,open,reopened))'),
    mine: (neg, userId) => (!userId ? null : neg ? `or(handler_id.is.null,handler_id.neq.${userId})` : `handler_id.eq.${userId}`),
  },
  textColumn: 'search_text',
}
