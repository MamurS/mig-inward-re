/**
 * A small in-memory stand-in for the Supabase REST / auth API, so the browser
 * checks and screenshots run the real app with no database (and never touch
 * production). It understands the PostgREST subset the app uses: eq, neq, in,
 * is, gt/gte/lt/lte, ilike, not.<op>, or=(…) with nested and(…) / or(…) / not.and(…)
 * and quoted values (the search bar's filters), order, limit / offset, exact counts,
 * single-object responses, the fx_rate_to_usd RPC, and simple writes.
 */
import type { BrowserContext, Route } from '@playwright/test'
import { TABLES, USERS, fxRate, type FixtureRole } from './fixtures'
import { generateSchedule, normalizePremium, premiumSeed, premiumViews } from './premium'

const PROJECT_REF = 'jltrtqwaxvsrnqmjemzc'
type Row = Record<string, unknown>

function b64url(obj: unknown) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url')
}

function fakeJwt(userId: string) {
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24 * 365
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: userId, role: 'authenticated', exp, aud: 'authenticated' })}.sig`
}

function authUser(role: FixtureRole) {
  const u = USERS[role]
  return {
    id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email,
    app_metadata: { provider: 'email' }, user_metadata: { full_name: u.full_name },
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  }
}

/** Splits `a,b(c,d),e` on top-level commas (not inside quotes). */
function splitTop(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  let inQ = false
  for (const ch of s) {
    if (ch === '"') inQ = !inQ
    if (!inQ && ch === '(') depth++
    if (!inQ && ch === ')') depth--
    if (ch === ',' && depth === 0 && !inQ) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur) out.push(cur)
  return out
}

function cmp(a: unknown, b: string): number {
  if (typeof a === 'number') return a - Number(b)
  return String(a).localeCompare(b)
}

/** One `column=op.value` condition. */
function test(row: Row, col: string, expr: string): boolean {
  if (expr.startsWith('not.')) {
    // SQL: NOT on a NULL value is still NULL (the row is not returned)
    const v = row[col]
    if ((v === null || v === undefined) && !expr.startsWith('not.is.')) return false
    return !test(row, col, expr.slice(4))
  }
  const dot = expr.indexOf('.')
  const op = expr.slice(0, dot)
  const raw = expr.slice(dot + 1).replace(/^"(.*)"$/s, '$1')
  const v = row[col]
  switch (op) {
    case 'eq':
      return v !== null && v !== undefined && String(v) === raw
    case 'neq':
      return String(v) !== raw
    case 'is':
      return raw === 'null' ? v === null || v === undefined : String(v) === raw
    case 'in':
      return raw.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, '')).includes(String(v))
    case 'gt':
      return v !== null && cmp(v, raw) > 0
    case 'gte':
      return v !== null && cmp(v, raw) >= 0
    case 'lt':
      return v !== null && cmp(v, raw) < 0
    case 'lte':
      return v !== null && cmp(v, raw) <= 0
    case 'ilike': {
      const re = new RegExp(`^${raw.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '.*')}$`, 'i')
      return v !== null && v !== undefined && re.test(String(v))
    }
    default:
      return true
  }
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'or', 'and', 'on_conflict', 'columns'])

/** One node of a PostgREST logic tree: and(…), or(…), not.and(…), not.or(…) or col.[not.]op.value. */
function evalNode(row: Row, node: string): boolean {
  const m = /^(not\.)?(and|or)\((.*)\)$/s.exec(node)
  if (m) {
    const kids = splitTop(m[3])
    const v = m[2] === 'and' ? kids.every((k) => evalNode(row, k)) : kids.some((k) => evalNode(row, k))
    return m[1] ? !v : v
  }
  const i = node.indexOf('.')
  return test(row, node.slice(0, i), node.slice(i + 1))
}

function filterRows(rows: Row[], params: URLSearchParams): Row[] {
  let out = rows
  for (const [key, value] of params) {
    if (RESERVED.has(key)) continue
    out = out.filter((r) => test(r, key, value))
  }
  for (const or of params.getAll('or')) {
    const parts = splitTop(or.replace(/^\(/, '').replace(/\)$/, ''))
    out = out.filter((r) => parts.some((p) => evalNode(r, p)))
  }
  return out
}

function sortRows(rows: Row[], order: string | null): Row[] {
  if (!order) return rows
  const keys = order.split(',').map((o) => {
    const [col, ...mods] = o.split('.')
    return { col, desc: mods.includes('desc'), nullsFirst: mods.includes('nullsfirst') }
  })
  return rows.slice().sort((a, b) => {
    for (const k of keys) {
      const av = a[k.col]
      const bv = b[k.col]
      if (av === bv) continue
      if (av === null || av === undefined) return k.nullsFirst ? -1 : 1
      if (bv === null || bv === undefined) return k.nullsFirst ? 1 : -1
      const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      if (c !== 0) return k.desc ? -c : c
    }
    return 0
  })
}

/** Installs the mock and a signed-in session for `role` on a browser context. */
export async function installMock(
  context: BrowserContext,
  role: FixtureRole | null = 'admin',
  lang: 'en' | 'ru' | 'uz' = 'en',
  appearance: { theme?: 'grey' | 'blue' | 'green' | 'orange'; textSize?: 'normal' | 'large' } = {},
) {
  const db: Record<string, Row[]> = Object.fromEntries(Object.entries(TABLES).map(([k, v]) => [k, structuredClone(v)]))
  // the signed-in user's saved appearance (profiles.ui_theme / ui_text_size)
  const look = { theme: appearance.theme ?? 'grey', textSize: appearance.textSize ?? 'normal' }
  if (role) {
    const me = db.profiles?.find((p) => p.id === authUser(role).id)
    if (me) Object.assign(me, { ui_theme: look.theme, ui_text_size: look.textSize })
  }
  Object.assign(db, premiumSeed(db.submissions_v))
  normalizePremium(db, null)
  const PREMIUM_VIEWS = new Set(['premium_installments_v', 'premium_receipts_v', 'premium_schedule_check_v'])

  const user = role ? authUser(role) : null
  await context.addInitScript(
    ([key, session, language, cached]) => {
      try {
        if (session) localStorage.setItem(key as string, session as string)
        else localStorage.removeItem(key as string)
        localStorage.setItem('mig.lang', language as string)
        localStorage.setItem('mig.appearance', cached as string)
      } catch {
        /* ignore */
      }
    },
    [
      `sb-${PROJECT_REF}-auth-token`,
      user
        ? JSON.stringify({
            access_token: fakeJwt(user.id), refresh_token: 'fake-refresh', token_type: 'bearer',
            expires_in: 3600 * 24 * 365, expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365, user,
          })
        : null,
      lang,
      JSON.stringify(look),
    ],
  )

  await context.route(`https://${PROJECT_REF}.supabase.co/**`, async (route: Route) => {
    const req = route.request()
    const url = new URL(req.url())
    const method = req.method()
    const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
      route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...headers }, body: JSON.stringify(body) })

    if (method === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    }
    if (url.pathname.startsWith('/auth/v1/')) {
      if (url.pathname.endsWith('/logout')) return json({}, 204)
      return json(user ?? {}, user ? 200 : 401)
    }
    if (url.pathname.startsWith('/functions/v1/')) return json({ id: 'new-user' })
    if (url.pathname.startsWith('/storage/v1/')) return json({ signedURL: '/favicon.svg', signedUrl: '/favicon.svg' })

    const rpc = /^\/rest\/v1\/rpc\/(.+)$/.exec(url.pathname)
    if (rpc) {
      const args = (req.postDataJSON() ?? {}) as Record<string, string>
      if (rpc[1] === 'fx_rate_to_usd') return json(fxRate(args.p_currency, args.p_date))
      if (rpc[1] === 'change_submission_status') {
        const a = args as unknown as { p_submission_id: string; p_to_status: string; p_signed_share_pct?: string; p_written_share_pct?: string; p_offer_valid_until?: string }
        const now = new Date().toISOString()
        for (const t of ['submissions', 'submissions_v']) {
          const r = db[t].find((x) => x.id === a.p_submission_id)
          if (!r) continue
          r.status = a.p_to_status
          r.status_changed_at = now
          if (a.p_written_share_pct) r.written_share_pct = Number(a.p_written_share_pct)
          if (a.p_offer_valid_until) r.offer_valid_until = a.p_offer_valid_until
          if (a.p_to_status === 'bound') {
            r.signed_share_pct = Number(a.p_signed_share_pct ?? r.written_share_pct)
            r.share_pct = r.signed_share_pct
            r.bound_at = now
          }
        }
        return json(db.submissions.find((x) => x.id === a.p_submission_id) ?? {})
      }
      if (rpc[1] === 'generate_premium_schedule') {
        const out = generateSchedule(db, args.p_submission_id, (args as unknown as { p_installments?: { due_date: string; gross_amount: string }[] }).p_installments ?? null)
        normalizePremium(db, user?.id ?? null)
        return out.error ? json({ message: out.error, code: '23514' }, 400) : json(out.data)
      }
      return json({})
    }

    const m = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname)
    if (!m) return json({ message: 'not found' }, 404)
    const table = m[1]
    if (PREMIUM_VIEWS.has(table)) Object.assign(db, premiumViews(db, fxRate))
    const rows = (db[table] ??= [])
    const params = url.searchParams

    if (method === 'GET' || method === 'HEAD') {
      let out = sortRows(filterRows(rows, params), params.get('order'))
      // embedded receipt on allocations: select=*,premium_receipts(...)
      if (table === 'premium_allocations' && (params.get('select') ?? '').includes('premium_receipts(')) {
        out = out.map((a) => ({ ...a, premium_receipts: (db.premium_receipts ?? []).find((r) => r.id === a.receipt_id) ?? null }))
      }
      const total = out.length
      const offset = Number(params.get('offset') ?? 0)
      const limit = params.get('limit') ? Number(params.get('limit')) : undefined
      out = out.slice(offset, limit === undefined ? undefined : offset + limit)
      const headers: Record<string, string> = {}
      if ((req.headers()['prefer'] ?? '').includes('count=exact')) headers['content-range'] = `${offset}-${offset + out.length - 1}/${total}`
      if ((req.headers()['accept'] ?? '').includes('vnd.pgrst.object')) {
        return out.length ? json(out[0], 200, headers) : json({ message: 'no rows' }, 406)
      }
      return json(method === 'HEAD' ? null : out, 200, headers)
    }
    if (method === 'POST') {
      const body = req.postDataJSON()
      const items = (Array.isArray(body) ? body : [body]) as Row[]
      const created = items.map((i) => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...i }))
      rows.push(...created)
      if (table.startsWith('premium_')) normalizePremium(db, user?.id ?? null)
      return json((req.headers()['accept'] ?? '').includes('vnd.pgrst.object') ? created[0] : created, 201)
    }
    if (method === 'PATCH') {
      const patch = req.postDataJSON() as Row
      const hit = filterRows(rows, params)
      for (const r of hit) Object.assign(r, patch)
      if (table.startsWith('premium_')) normalizePremium(db, user?.id ?? null)
      return json((req.headers()['accept'] ?? '').includes('vnd.pgrst.object') ? hit[0] ?? null : hit)
    }
    if (method === 'DELETE') {
      const hit = filterRows(rows, params)
      db[table] = rows.filter((r) => !hit.includes(r))
      return json(hit)
    }
    return json({}, 405)
  })
}
