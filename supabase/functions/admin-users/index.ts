// Admin-only user management (create login, set password).
// Runs server-side with the service_role key, which never reaches the browser.
// Works on Supabase Cloud and self-hosted Supabase (edge-runtime).
import { createClient } from 'npm:@supabase/supabase-js@2'

const ROLES = ['admin', 'underwriter', 'finance', 'claims', 'management'] as const

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''

  // 1. Who is calling?
  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await asCaller.auth.getUser()
  if (userErr || !userData.user) return json({ error: 'Not signed in' }, 401)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: caller } = await admin.from('profiles').select('role, active').eq('id', userData.user.id).maybeSingle()
  if (!caller || caller.role !== 'admin' || !caller.active) return json({ error: 'Only admins can manage users' }, 403)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const password = typeof body.password === 'string' ? body.password : ''
  if (body.action === 'create' || body.action === 'set_password') {
    if (password.length < 10) return json({ error: 'Password must be at least 10 characters' }, 400)
  }

  if (body.action === 'create') {
    const email = String(body.email ?? '').trim().toLowerCase()
    const fullName = String(body.full_name ?? '').trim()
    const role = String(body.role ?? '')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Invalid email' }, 400)
    if (!ROLES.includes(role as (typeof ROLES)[number])) return json({ error: 'Invalid role' }, 400)

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (error) return json({ error: error.message }, 400)

    // profile row is created by the on_auth_user_created trigger; set role + name
    const { error: pErr } = await admin.from('profiles').update({ role, full_name: fullName || null }).eq('id', data.user.id)
    if (pErr) return json({ error: pErr.message }, 400)
    return json({ id: data.user.id })
  }

  if (body.action === 'set_password') {
    const userId = String(body.user_id ?? '')
    const { error } = await admin.auth.admin.updateUserById(userId, { password })
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  }

  return json({ error: 'Unknown action' }, 400)
})
