// AI-assisted data entry. Reads a submission document (PDF, image, text) or a
// bordereau's column titles and returns suggestions — value, confidence and
// source snippet per field — for the user to review. Nothing is saved here:
// the screens fill the form and the user saves.
//
// Checks, in order: signed in and active → AI switched on and the role allowed
// (Admin › AI) → size caps → the provider configured → cache → daily limit.
// Every call is logged in ai_usage_log (service role). Works on Supabase Cloud
// and self-hosted Supabase (edge-runtime).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { provider, type Attachment } from './adapters.ts'
import { PROMPT_VERSION, SUBMISSION_FIELDS, mappingPrompt, mappingSchema, submissionPrompt, submissionSchema, type Kind } from './schemas.ts'

const MAX_FILE_BYTES = 8 * 1024 * 1024 // per document
const MAX_TEXT_CHARS = 200_000 // pasted text or a text file
const MAX_MAPPING_COLUMNS = 200

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

async function sha256(data: Uint8Array | string) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function b64ToBytes(b64: string) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const clamp = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0)
const str = (v: unknown, max = 2000) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

/** Keep only the fields we asked for, in the shape we promised. */
function cleanSubmission(data: unknown) {
  const d = (data ?? {}) as { fields?: Record<string, { value?: unknown; confidence?: unknown; source?: unknown }>; notes?: unknown }
  const fields: Record<string, { value: string | null; confidence: number; source: string | null }> = {}
  for (const f of SUBMISSION_FIELDS) {
    const x = d.fields?.[f.key]
    const value = str(x?.value, 4000)
    fields[f.key] = { value, confidence: value === null ? 0 : clamp(x?.confidence), source: value === null ? null : str(x?.source, 500) }
  }
  const notes = Array.isArray(d.notes) ? d.notes.map((n) => str(n, 500)).filter((n): n is string => n !== null).slice(0, 20) : []
  return { fields, notes }
}

function cleanMapping(data: unknown, targets: string[], columns: string[]) {
  const d = (data ?? {}) as { mapping?: { field?: unknown; column?: unknown; confidence?: unknown; reason?: unknown }[]; header_row?: unknown }
  const used = new Set<string>()
  const mapping: { field: string; column: string | null; confidence: number; reason: string | null }[] = []
  for (const m of d.mapping ?? []) {
    const field = str(m.field)
    if (!field || !targets.includes(field) || mapping.some((x) => x.field === field)) continue
    const column = str(m.column)
    const ok = column !== null && columns.includes(column) && !used.has(column)
    if (ok) used.add(column!)
    mapping.push({ field, column: ok ? column : null, confidence: ok ? clamp(m.confidence) : 0, reason: str(m.reason, 300) })
  }
  return { mapping, header_row: typeof d.header_row === 'number' && d.header_row >= 1 && d.header_row <= 50 ? Math.floor(d.header_row) : null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const started = Date.now()

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: userData, error: userErr } = await asCaller.auth.getUser()
  if (userErr || !userData.user) return json({ error: 'Not signed in', code: 'auth' }, 401)
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: me } = await admin.from('profiles').select('id, role, active, ui_demo_mode').eq('id', userData.user.id).maybeSingle()
  if (!me || !me.active || !me.role) return json({ error: 'No access', code: 'auth' }, 403)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON', code: 'bad_request' }, 400)
  }
  const kind = body.kind as Kind
  if (kind !== 'submission' && kind !== 'bordereau_mapping') return json({ error: 'Unknown kind', code: 'bad_request' }, 400)

  const ai = provider()
  const log = async (row: Record<string, unknown>) => {
    await admin.from('ai_usage_log').insert({
      user_id: me.id, kind, provider: ai.name, model: ai.model, duration_ms: Date.now() - started, is_demo: Boolean(me.ui_demo_mode), ...row,
    })
  }

  // 1. switched on, for this role
  const { data: settings } = await admin.from('settings').select('key, value').in('key', ['ai_enabled', 'ai_roles', 'ai_daily_limit'])
  const setting = (k: string) => settings?.find((s) => s.key === k)?.value
  if (setting('ai_enabled') !== true || !Array.isArray(setting('ai_roles')) || !(setting('ai_roles') as string[]).includes(me.role)) {
    await log({ status: 'disabled' })
    return json({ error: 'AI-assisted entry is switched off for your role', code: 'disabled' }, 403)
  }

  // 2. the input, within the caps
  let attachment: Attachment | null = null
  let fileName: string | null = null
  let fileBytes: number | null = null
  let hashInput: Uint8Array | string
  let system: string
  let instruction: string
  let schema: Record<string, unknown>
  let targets: string[] = []
  let columns: string[] = []
  if (kind === 'submission') {
    const file = body.file as { name?: string; mime?: string; base64?: string } | undefined
    const text = typeof body.text === 'string' ? body.text : null
    if (file?.base64) {
      const bytes = b64ToBytes(file.base64)
      fileName = String(file.name ?? 'document').slice(0, 200)
      fileBytes = bytes.length
      const mime = String(file.mime ?? '').toLowerCase()
      if (bytes.length > MAX_FILE_BYTES) {
        await log({ status: 'too_big', file_name: fileName, file_bytes: fileBytes })
        return json({ error: `The file is over ${MAX_FILE_BYTES / 1024 / 1024} MB`, code: 'too_big' }, 413)
      }
      if (mime.startsWith('text/') || mime === 'message/rfc822') {
        const t = new TextDecoder().decode(bytes)
        if (t.length > MAX_TEXT_CHARS) return json({ error: 'The text is too long', code: 'too_big' }, 413)
        attachment = { text: t }
      } else if (ai.accepts(mime)) attachment = { mime, base64: file.base64 }
      else return json({ error: `This file type cannot be read (${mime || 'unknown'})`, code: 'bad_type' }, 415)
      hashInput = bytes
    } else if (text) {
      if (text.length > MAX_TEXT_CHARS) return json({ error: 'The text is too long', code: 'too_big' }, 413)
      attachment = { text }
      hashInput = text
      fileBytes = text.length
    } else return json({ error: 'Send a file or text', code: 'bad_request' }, 400)
    const { data: lobs } = await admin.from('lines_of_business').select('code, name').eq('active', true).order('code')
    system = submissionPrompt(lobs ?? [])
    instruction = 'Fill in the submission fields from this document.'
    schema = submissionSchema()
    hashInput = typeof hashInput === 'string' ? hashInput + JSON.stringify(lobs) : new Uint8Array([...hashInput, ...new TextEncoder().encode(JSON.stringify(lobs))])
  } else {
    const t = (body.targets ?? []) as { key?: string; label?: string; required?: boolean }[]
    targets = t.map((x) => String(x.key ?? '')).filter(Boolean)
    columns = ((body.columns ?? []) as unknown[]).map((c) => String(c)).slice(0, MAX_MAPPING_COLUMNS)
    const samples = ((body.samples ?? []) as unknown[][]).slice(0, 5).map((r) => (Array.isArray(r) ? r.slice(0, MAX_MAPPING_COLUMNS).map((c) => (c === null || c === undefined ? '' : String(c).slice(0, 80))) : []))
    if (!targets.length || !columns.length) return json({ error: 'Send the target fields and the column titles', code: 'bad_request' }, 400)
    const payload = JSON.stringify({ kind: body.bordereau_kind, header_row: body.header_row ?? 1, targets: t, columns, samples })
    attachment = { text: payload }
    system = mappingPrompt()
    instruction = 'Map the columns to the target fields.'
    schema = mappingSchema()
    hashInput = payload
  }

  if (!ai.configured) {
    await log({ status: 'disabled', error: 'provider not configured', file_name: fileName, file_bytes: fileBytes })
    return json({ error: 'The AI provider is not configured yet (ask the admin to set the key)', code: 'not_configured' }, 503)
  }

  // 3. the same input asked before: the cached answer, free
  const fileSha = await sha256(hashInput)
  const cacheKey = await sha256(`${kind}|${PROMPT_VERSION}|${ai.name}|${ai.model}|${fileSha}`)
  const isDemo = Boolean(me.ui_demo_mode)
  const { data: hit } = await admin.from('ai_cache').select('result, hits').eq('cache_key', cacheKey).eq('is_demo', isDemo).maybeSingle()
  if (hit) {
    await admin.from('ai_cache').update({ hits: hit.hits + 1, last_hit_at: new Date().toISOString() }).eq('cache_key', cacheKey).eq('is_demo', isDemo)
    await log({ status: 'cached', file_name: fileName, file_bytes: fileBytes, file_sha256: fileSha })
    return json({ ...(hit.result as object), cached: true, model: ai.model })
  }

  // 4. the daily limit (cached answers do not count)
  const limit = typeof setting('ai_daily_limit') === 'number' ? (setting('ai_daily_limit') as number) : 100
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count } = await admin.from('ai_usage_log').select('id', { count: 'exact', head: true }).eq('user_id', me.id).gte('created_at', since).in('status', ['ok', 'error', 'refused'])
  if ((count ?? 0) >= limit) {
    await log({ status: 'limit', file_name: fileName, file_bytes: fileBytes })
    return json({ error: `Daily limit reached (${limit} requests in 24 hours)`, code: 'limit' }, 429)
  }

  // 5. ask the model
  const out = await ai.extract({ system, instruction, attachment, schema })
  if (!out.ok) {
    await log({ status: out.status, error: out.error.slice(0, 500), file_name: fileName, file_bytes: fileBytes, file_sha256: fileSha })
    return json({ error: out.error, code: out.status }, out.status === 'refused' ? 422 : 502)
  }
  const result = kind === 'submission' ? cleanSubmission(out.data) : cleanMapping(out.data, targets, columns)
  await admin.from('ai_cache').upsert({ cache_key: cacheKey, is_demo: isDemo, kind, model: ai.model, result })
  await log({ status: 'ok', file_name: fileName, file_bytes: fileBytes, file_sha256: fileSha, input_tokens: out.inputTokens, output_tokens: out.outputTokens })
  return json({ ...result, cached: false, model: ai.model })
})
