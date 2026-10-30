import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Database, KeyRound, Loader2, Play, Plus, Save, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/Field'
import { SavedCheck, useFlash } from '@/components/SavedCheck'
import { useAuth } from '@/auth/AuthProvider'
import { DOCUMENTS_BUCKET } from '@/lib/documents'
import { supabase } from '@/lib/supabase'
import { ALL_ROLES, type AppRole } from '@/lib/roles'
import { formatDate, formatDateTime, isoDate } from '@/lib/format'
import { cleanDecimal, isDecimal } from '@/lib/decimal'
import { errorMessage } from '@/lib/errors'
import type { Tables } from '@/lib/database.types'
import { useCurrencies } from '@/hooks/useReference'
import { norm } from '@/features/search/normalize'
import type { ParsedQuery } from '@/features/search/query'
import { matchesQuery, type ClientSpec } from '@/features/search/client'
import { FX_PAGE, REFERENCE_PAGE, USERS_PAGE } from '@/features/search/pages'
import { useListSearch } from '@/features/search/useSearch'
import { SearchChips } from '@/features/search/SearchChips'
import { AiAdminTab } from '@/features/ai/AiAdminTab'

const TABS = ['users', 'reference', 'fx', 'settings', 'ai', 'jobs', 'demo'] as const

export function AdminPage() {
  const { t } = useTranslation()
  // the tab lives in the URL, so the search bar knows which list it filters (and links keep the tab)
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((x) => x === params.get('tab')) ?? 'users'
  return (
    <>
      <PageHeader title={t('pages.admin.title')} subtitle={t('pages.admin.subtitle')} />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="users">{t('admin.tabs.users')}</TabsTrigger>
          <TabsTrigger value="reference">{t('admin.tabs.reference')}</TabsTrigger>
          <TabsTrigger value="fx">{t('admin.tabs.fx')}</TabsTrigger>
          <TabsTrigger value="settings">{t('admin.tabs.settings')}</TabsTrigger>
          <TabsTrigger value="ai">{t('admin.tabs.ai')}</TabsTrigger>
          <TabsTrigger value="jobs">{t('admin.tabs.jobs')}</TabsTrigger>
          <TabsTrigger value="demo">{t('admin.tabs.demo')}</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="reference"><ReferenceTab /></TabsContent>
        <TabsContent value="fx"><FxTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
        <TabsContent value="ai"><AiAdminTab /></TabsContent>
        <TabsContent value="jobs"><JobsTab /></TabsContent>
        <TabsContent value="demo"><DemoTab /></TabsContent>
      </Tabs>
    </>
  )
}

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!#%+='
  const a = new Uint32Array(14)
  crypto.getRandomValues(a)
  return Array.from(a, (n) => chars[n % chars.length]).join('')
}

async function callAdminUsers(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    // surface the function's own error message when there is one
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const j = await ctx.json().catch(() => null)
      if (j?.error) throw new Error(j.error)
    }
    throw error
  }
  return data
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
function UsersTab() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { profile: me } = useAuth()
  const users = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at')
      if (error) throw error
      return data
    },
  })
  const { parsed, setQ } = useListSearch(USERS_PAGE)
  const spec: ClientSpec<Tables<'profiles'>> = useMemo(
    () => ({
      text: (u) => norm([u.full_name, u.email].filter(Boolean).join(' ')),
      list: { role: (u) => u.role },
      flags: { active: (u) => u.active, inactive: (u) => !u.active },
    }),
    [],
  )
  const shown = (users.data ?? []).filter((u) => matchesQuery(parsed, u, spec))
  const [edits, setEdits] = useState<Record<string, { full_name: string; role: AppRole | ''; active: boolean }>>({})
  const [creating, setCreating] = useState(false)
  const [pwFor, setPwFor] = useState<Tables<'profiles'> | null>(null)

  useEffect(() => {
    if (users.data) setEdits(Object.fromEntries(users.data.map((u) => [u.id, { full_name: u.full_name ?? '', role: u.role ?? '', active: u.active }])))
  }, [users.data])

  async function saveRow(u: Tables<'profiles'>) {
    const e = edits[u.id]
    if (!e.role) {
      toast.error(t('admin.users.pickRole'))
      return
    }
    const { error } = await supabase.rpc('admin_update_user', { p_user_id: u.id, p_role: e.role, p_active: e.active, p_full_name: e.full_name.trim() || undefined })
    if (error) {
      toast.error(errorMessage(error))
      return
    }
    toast.success(t('admin.saved'))
    await Promise.all([qc.invalidateQueries({ queryKey: ['admin', 'users'] }), qc.invalidateQueries({ queryKey: ['ref', 'users'] })])
  }

  return (
    <>
    {parsed && <SearchChips query={parsed} scope={USERS_PAGE.scope} onChange={setQ} count={t('ui.rows', { count: shown.length })} />}
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-4">
        <div>
          <CardTitle>{t('admin.tabs.users')}</CardTitle>
          <p className="mt-1 text-caption text-muted-foreground">{t('admin.users.help')}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <UserPlus />
          {t('admin.users.new')}
        </Button>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t('fields.name')}</TableHead>
            <TableHead>{t('auth.email')}</TableHead>
            <TableHead>{t('admin.users.role')}</TableHead>
            <TableHead>{t('common.active')}</TableHead>
            <TableHead>{t('admin.users.created')}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((u) => {
            const e = edits[u.id]
            if (!e) return null
            const changed = e.full_name !== (u.full_name ?? '') || e.role !== (u.role ?? '') || e.active !== u.active
            return (
              <TableRow key={u.id} className={!u.role || !u.active ? 'bg-warning-50' : undefined}>
                <TableCell><Input value={e.full_name} onChange={(ev) => setEdits({ ...edits, [u.id]: { ...e, full_name: ev.target.value } })} className="h-8 w-48" /></TableCell>
                <TableCell className="text-body">{u.email}</TableCell>
                <TableCell>
                  <div className="w-40">
                    <NativeSelect value={e.role} onChange={(ev) => setEdits({ ...edits, [u.id]: { ...e, role: ev.target.value as AppRole } })} className="h-8">
                      <option value="">{t('admin.users.noRole')}</option>
                      {ALL_ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
                    </NativeSelect>
                  </div>
                </TableCell>
                <TableCell>
                  <input type="checkbox" checked={e.active} disabled={u.id === me?.id} onChange={(ev) => setEdits({ ...edits, [u.id]: { ...e, active: ev.target.checked } })} />
                </TableCell>
                <TableCell className="text-caption text-muted-foreground">{formatDate(u.created_at)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setPwFor(u)} title={t('admin.users.setPassword')}>
                    <KeyRound />
                  </Button>
                  <Button size="sm" variant={changed ? 'default' : 'outline'} disabled={!changed} onClick={() => void saveRow(u)}>
                    <Save />
                    {t('common.save')}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <CreateUserDialog open={creating} onClose={() => setCreating(false)} />
      <SetPasswordDialog user={pwFor} onClose={() => setPwFor(null)} />
    </Card>
    </>
  )
}

function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<AppRole>('underwriter')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState(false)

  useEffect(() => {
    if (open) {
      setEmail('')
      setName('')
      setRole('underwriter')
      setPassword(randomPassword())
      setCreated(false)
    }
  }, [open])

  async function create() {
    setBusy(true)
    try {
      await callAdminUsers({ action: 'create', email, full_name: name, role, password })
      setCreated(true)
      toast.success(t('admin.users.created_ok', { email }))
      await Promise.all([qc.invalidateQueries({ queryKey: ['admin', 'users'] }), qc.invalidateQueries({ queryKey: ['ref', 'users'] })])
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.users.new')}</DialogTitle>
          <DialogDescription>{t('admin.users.newHelp')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label={t('auth.email')} required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={created} />
          </Field>
          <Field label={t('fields.name')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={created} />
          </Field>
          <Field label={t('admin.users.role')}>
            <NativeSelect value={role} onChange={(e) => setRole(e.target.value as AppRole)} disabled={created}>
              {ALL_ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
            </NativeSelect>
          </Field>
          <Field label={t('admin.users.tempPassword')} hint={t('admin.users.tempPasswordHint')}>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" disabled={created} />
          </Field>
          {created && <p className="rounded-md bg-success-100 p-3 text-body text-success-700">{t('admin.users.passOn', { email, password })}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{created ? t('common.close') : t('common.cancel')}</Button>
          {!created && (
            <Button onClick={() => void create()} disabled={busy || !email || password.length < 10}>
              {busy && <Loader2 className="animate-spin" />}
              {t('admin.users.create')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SetPasswordDialog({ user, onClose }: { user: Tables<'profiles'> | null; onClose: () => void }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => setPassword(randomPassword()), [user])
  if (!user) return null

  async function save() {
    setBusy(true)
    try {
      await callAdminUsers({ action: 'set_password', user_id: user!.id, password })
      toast.success(t('admin.users.passwordSet'))
      onClose()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.users.setPassword')}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <Field label={t('admin.users.tempPassword')} hint={t('admin.users.tempPasswordHint')}>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button onClick={() => void save()} disabled={busy || password.length < 10}>
            {busy && <Loader2 className="animate-spin" />}
            {t('admin.users.setPassword')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Reference data: currencies, countries, lines of business
// ---------------------------------------------------------------------------
type RefCol = { key: string; label: string; width?: string; upper?: boolean; maxLength?: number }

function RefTable({
  table,
  pk,
  cols,
  title,
  orderBy,
  query,
}: {
  query: ParsedQuery | null
  table: 'currencies' | 'countries' | 'lines_of_business'
  pk: 'code' | 'id'
  cols: RefCol[]
  title: string
  orderBy: string
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const rows = useQuery({
    queryKey: ['admin', table],
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select('*').order(orderBy)
      if (error) throw error
      return data as unknown as Record<string, string | boolean | number | null>[]
    },
  })
  const [edits, setEdits] = useState<Record<string, Record<string, string | boolean>>>({})
  const [draft, setDraft] = useState<Record<string, string>>({})
  const spec: ClientSpec<Record<string, string | boolean | number | null>> = useMemo(
    () => ({
      text: (r) => norm(cols.map((c) => r[c.key]).filter((v) => v !== null && v !== undefined).join(' ')),
      flags: { active: (r) => Boolean(r.active), inactive: (r) => !r.active },
    }),
    [cols],
  )
  const shown = (rows.data ?? []).filter((r) => matchesQuery(query, r, spec))

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['admin', table] }), qc.invalidateQueries({ queryKey: ['ref'] })])

  async function saveRow(id: string) {
    const patch = edits[id]
    const { error } = await supabase.from(table).update(patch as never).eq(pk as never, id as never)
    if (error) return toast.error(errorMessage(error))
    setEdits(({ [id]: _, ...rest }) => rest)
    toast.success(t('admin.saved'))
    await refresh()
  }

  async function add() {
    const row: Record<string, string> = {}
    for (const c of cols) if (draft[c.key]?.trim()) row[c.key] = c.upper ? draft[c.key].trim().toUpperCase() : draft[c.key].trim()
    const { error } = await supabase.from(table).insert(row as never)
    if (error) return toast.error(/duplicate key/i.test(error.message) ? t('admin.duplicate') : errorMessage(error))
    setDraft({})
    toast.success(t('admin.saved'))
    await refresh()
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="py-4"><CardTitle>{title}</CardTitle></CardHeader>
      <div className="max-h-[480px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {cols.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
              <TableHead>{t('common.active')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((r) => {
              const id = String(r[pk])
              const e = edits[id] ?? {}
              const val = (k: string) => (k in e ? e[k] : r[k]) as string | boolean | null
              return (
                <TableRow key={id}>
                  {cols.map((c) => (
                    <TableCell key={c.key} className="py-1">
                      {c.key === pk && pk === 'code' ? (
                        <span className="font-mono text-body">{String(r[c.key])}</span>
                      ) : (
                        <Input
                          className={`h-8 ${c.width ?? 'w-40'}`}
                          value={String(val(c.key) ?? '')}
                          onChange={(ev) => setEdits({ ...edits, [id]: { ...e, [c.key]: ev.target.value } })}
                        />
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                    <input type="checkbox" checked={Boolean(val('active'))} onChange={(ev) => setEdits({ ...edits, [id]: { ...e, active: ev.target.checked } })} />
                  </TableCell>
                  <TableCell className="text-right">
                    {edits[id] && (
                      <Button size="sm" onClick={() => void saveRow(id)}>
                        <Save />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-end gap-2 border-t p-3">
        {cols.map((c) => (
          <Input
            key={c.key}
            placeholder={c.label}
            className={`h-8 ${c.width ?? 'w-40'} ${c.upper ? 'uppercase' : ''}`}
            maxLength={c.maxLength}
            value={draft[c.key] ?? ''}
            onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })}
          />
        ))}
        <Button size="sm" variant="outline" onClick={() => void add()} disabled={!cols.every((c) => c.key.startsWith('name_') || draft[c.key]?.trim())}>
          <Plus />
          {t('admin.add')}
        </Button>
      </div>
    </Card>
  )
}

function ReferenceTab() {
  const { t } = useTranslation()
  const { parsed, setQ } = useListSearch(REFERENCE_PAGE)
  return (
    <div className="grid gap-4">
      {parsed && parsed.groups.length > 0 && <SearchChips query={parsed} scope={REFERENCE_PAGE.scope} onChange={setQ} count={null} />}
      <RefTable
        query={parsed}
        table="lines_of_business"
        pk="id"
        orderBy="sort_order"
        title={t('admin.ref.lob')}
        cols={[
          { key: 'code', label: t('admin.ref.code'), width: 'w-24', upper: true },
          { key: 'name', label: 'EN', width: 'w-56' },
          { key: 'name_ru', label: 'RU', width: 'w-56' },
          { key: 'name_uz', label: 'UZ', width: 'w-56' },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <RefTable
          query={parsed}
          table="currencies"
          pk="code"
          orderBy="sort_order"
          title={t('admin.ref.currencies')}
          cols={[
            { key: 'code', label: t('admin.ref.code'), width: 'w-20', upper: true, maxLength: 3 },
            { key: 'name', label: t('fields.name'), width: 'w-48' },
          ]}
        />
        <RefTable
          query={parsed}
          table="countries"
          pk="code"
          orderBy="name"
          title={t('admin.ref.countries')}
          cols={[
            { key: 'code', label: t('admin.ref.code'), width: 'w-16', upper: true, maxLength: 2 },
            { key: 'name', label: 'EN', width: 'w-36' },
            { key: 'name_ru', label: 'RU', width: 'w-36' },
            { key: 'name_uz', label: 'UZ', width: 'w-36' },
          ]}
        />
      </div>
      <p className="text-caption text-muted-foreground">{t('admin.ref.counterpartiesHint')}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FX rates
// ---------------------------------------------------------------------------
function FxTab() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const currencies = useCurrencies()
  const [ccy, setCcy] = useState('')
  const [date, setDate] = useState(isoDate())
  const [rate, setRate] = useState('')
  // the search bar filters the rates in the database (all of them, not only the 300 latest shown)
  const { parsed, filter, setQ } = useListSearch(FX_PAGE)
  const rates = useQuery({
    queryKey: ['admin', 'fx', filter],
    enabled: parsed !== null,
    queryFn: async () => {
      let q = supabase.from('fx_rates').select('*').order('rate_date', { ascending: false }).order('currency').limit(300)
      if (filter) q = q.or(filter)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })

  async function add() {
    if (!ccy || !date || !isDecimal(rate, 10) || Number(cleanDecimal(rate)) <= 0) {
      toast.error(t('admin.fx.invalid'))
      return
    }
    const { error } = await supabase.from('fx_rates').upsert({ currency: ccy, rate_date: date, rate_to_usd: cleanDecimal(rate) as never, source: 'manual' })
    if (error) return toast.error(errorMessage(error))
    setRate('')
    toast.success(t('admin.saved'))
    await Promise.all([qc.invalidateQueries({ queryKey: ['admin', 'fx'] }), qc.invalidateQueries({ queryKey: ['submissions'] }), qc.invalidateQueries({ queryKey: ['fx'] })])
  }

  async function remove(r: Tables<'fx_rates'>) {
    if (!window.confirm(t('admin.fx.confirmDelete', { ccy: r.currency, date: formatDate(r.rate_date) }))) return
    const { error } = await supabase.from('fx_rates').delete().eq('currency', r.currency).eq('rate_date', r.rate_date)
    if (error) return toast.error(errorMessage(error))
    await qc.invalidateQueries({ queryKey: ['admin', 'fx'] })
  }

  return (
    <div className="grid gap-4">
      {parsed && parsed.groups.length > 0 && <SearchChips query={parsed} scope={FX_PAGE.scope} onChange={setQ} count={t('ui.rows', { count: rates.data?.length ?? 0 })} />}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.fx.add')}</CardTitle>
          <p className="text-caption text-muted-foreground">{t('admin.fx.help')}</p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Field label={t('fields.currency')}>
            <div className="w-32">
              <NativeSelect value={ccy} onChange={(e) => setCcy(e.target.value)}>
                <option value="">—</option>
                {currencies.data?.filter((c) => c.code !== 'USD').map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </NativeSelect>
            </div>
          </Field>
          <Field label={t('admin.fx.date')}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
          </Field>
          <Field label={t('admin.fx.rate', { ccy: ccy || '…' })}>
            <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} className="w-48 text-right" placeholder="0.0000785" />
          </Field>
          <Button onClick={() => void add()}>
            <Plus />
            {t('admin.add')}
          </Button>
        </CardContent>
      </Card>
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-4">
          <CardTitle>{t('admin.tabs.fx')}</CardTitle>
        </CardHeader>
        <div className="max-h-[480px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('fields.currency')}</TableHead>
                <TableHead>{t('admin.fx.date')}</TableHead>
                <TableHead className="text-right">{t('admin.fx.rateShort')}</TableHead>
                <TableHead>{t('admin.fx.source')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.data?.map((r) => (
                <TableRow key={`${r.currency}-${r.rate_date}`}>
                  <TableCell className="font-mono">{r.currency}</TableCell>
                  <TableCell>{formatDate(r.rate_date)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{String(r.rate_to_usd)}</TableCell>
                  <TableCell className="text-caption text-muted-foreground">{r.source ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => void remove(r)} aria-label={t('common.delete')}>
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
/**
 * Settings, grouped by module. A number setting has a range and a label /
 * hint under admin.settings.<key> and <key>Hint; a switch (bool) can turn
 * the numbers after it on and off (`enables`).
 */
type SettingDef = { key: string; kind: 'days' | 'number' | 'bool'; min?: number; max?: number; enables?: string[] }
export const SETTING_GROUPS: { id: string; settings: SettingDef[] }[] = [
  {
    id: 'followUps',
    settings: [
      { key: 'follow_up_first_days', kind: 'days', min: 1, max: 365 },
      { key: 'follow_up_repeat_days', kind: 'days', min: 1, max: 365 },
      { key: 'auto_no_response_enabled', kind: 'bool', enables: ['auto_no_response_days'] },
      { key: 'auto_no_response_days', kind: 'days', min: 1, max: 365 },
    ],
  },
  {
    id: 'premium',
    settings: [
      { key: 'premium_default_terms_days', kind: 'days', min: 0, max: 365 },
      { key: 'premium_grace_days', kind: 'days', min: 0, max: 365 },
    ],
  },
  {
    id: 'claims',
    settings: [
      { key: 'large_loss_threshold_usd', kind: 'number', min: 0, max: 10_000_000_000 },
      { key: 'claim_review_days', kind: 'days', min: 1, max: 365 },
    ],
  },
]
const ALL_SETTINGS = SETTING_GROUPS.flatMap((g) => g.settings)

function SettingsTab() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const settings = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('settings').select('*')
      if (error) throw error
      return data
    },
  })
  const [vals, setVals] = useState<Record<string, string | boolean>>({})
  const [busy, setBusy] = useState(false)
  const [savedShown, flashSaved] = useFlash()

  useEffect(() => {
    if (settings.data) setVals(Object.fromEntries(settings.data.map((s) => [s.key, typeof s.value === 'boolean' ? s.value : String(s.value)])))
  }, [settings.data])

  const disabledBy = (key: string) => ALL_SETTINGS.find((s) => s.enables?.includes(key) && !vals[s.key])

  async function save() {
    for (const d of ALL_SETTINGS) {
      if (d.kind === 'bool' || disabledBy(d.key)) continue
      const n = Number(vals[d.key])
      if (!Number.isFinite(n) || (d.kind === 'days' && !Number.isInteger(n)) || n < (d.min ?? 0) || n > (d.max ?? Infinity)) {
        toast.error(t('admin.settings.invalid', { label: t(`admin.settings.${d.key}`), min: d.min ?? 0, max: d.max ?? '∞' }))
        return
      }
    }
    setBusy(true)
    const rows = ALL_SETTINGS.filter((d) => vals[d.key] !== undefined).map((d) => ({ key: d.key, value: d.kind === 'bool' ? Boolean(vals[d.key]) : Number(vals[d.key]) }))
    const { error } = await supabase.from('settings').upsert(rows)
    setBusy(false)
    if (error) return toast.error(errorMessage(error))
    flashSaved()
    await qc.invalidateQueries({ queryKey: ['admin', 'settings'] })
  }

  return (
    <div className="grid max-w-2xl gap-4">
      {SETTING_GROUPS.map((g) => (
        <Card key={g.id} data-settings-group={g.id}>
          <CardHeader><CardTitle>{t(`admin.settings.groups.${g.id}`)}</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            {g.settings.map((d) =>
              d.kind === 'bool' ? (
                <label key={d.key} className="flex items-center gap-2 text-body">
                  <input type="checkbox" checked={Boolean(vals[d.key])} onChange={(e) => setVals({ ...vals, [d.key]: e.target.checked })} />
                  {t(`admin.settings.${d.key}`)}
                </label>
              ) : (
                <Field key={d.key} label={t(`admin.settings.${d.key}`)} hint={t(`admin.settings.${d.key}Hint`)} htmlFor={`setting-${d.key}`}>
                  <Input
                    id={`setting-${d.key}`}
                    type="number"
                    min={d.min}
                    max={d.max}
                    className="w-40 text-right tabular-nums"
                    value={String(vals[d.key] ?? '')}
                    onChange={(e) => setVals({ ...vals, [d.key]: e.target.value })}
                    disabled={Boolean(disabledBy(d.key))}
                  />
                </Field>
              ),
            )}
          </CardContent>
        </Card>
      ))}
      <div className="flex items-center gap-3">
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Save />}
          {t('ui.form.saveSettings')}
        </Button>
        <SavedCheck show={savedShown} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
function JobsTab() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const runs = useQuery({
    queryKey: ['admin', 'jobs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('job_runs').select('*').order('started_at', { ascending: false }).limit(30)
      if (error) throw error
      return data
    },
  })

  async function runNow() {
    setBusy(true)
    const { data, error } = await supabase.rpc('run_daily_follow_ups_now')
    setBusy(false)
    if (error) return toast.error(errorMessage(error))
    const r = (data ?? {}) as Record<string, number | string>
    if (r.error) toast.error(String(r.error))
    else toast.success(t('admin.jobs.result', { repeats: r.repeat_follow_ups ?? 0, expiry: r.expiry_flags ?? 0, noresp: r.moved_to_no_response ?? 0 }))
    await Promise.all([qc.invalidateQueries({ queryKey: ['admin', 'jobs'] }), qc.invalidateQueries({ queryKey: ['agenda'] }), qc.invalidateQueries({ queryKey: ['submissions'] }), qc.invalidateQueries({ queryKey: ['my-overdue'] })])
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-4">
        <div>
          <CardTitle>{t('admin.jobs.title')}</CardTitle>
          <p className="mt-1 text-caption text-muted-foreground">{t('admin.jobs.help')}</p>
        </div>
        <Button onClick={() => void runNow()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Play />}
          {t('admin.jobs.runNow')}
        </Button>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t('admin.jobs.started')}</TableHead>
            <TableHead>{t('admin.jobs.trigger')}</TableHead>
            <TableHead>{t('admin.jobs.outcome')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.data?.map((r) => {
            const res = (r.result ?? {}) as Record<string, number>
            return (
              <TableRow key={r.id}>
                <TableCell>{formatDateTime(r.started_at)}</TableCell>
                <TableCell className="text-caption text-muted-foreground">{r.started_by ? t('admin.jobs.manual') : t('admin.jobs.scheduled')}</TableCell>
                <TableCell className="text-body">
                  {r.error ? (
                    <span className="text-destructive">{r.error}</span>
                  ) : (
                    t('admin.jobs.result', { repeats: res.repeat_follow_ups ?? 0, expiry: res.expiry_flags ?? 0, noresp: res.moved_to_no_response ?? 0 })
                  )}
                </TableCell>
              </TableRow>
            )
          })}
          {runs.data?.length === 0 && (
            <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">{t('admin.jobs.none')}</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  )
}

const DEMO_KINDS = ['counterparties', 'submissions', 'installments', 'receipts', 'claims', 'follow_ups'] as const

/**
 * Demo data: load it, check that it never links to real data, delete it all.
 * The database does the work (seed_demo_data / demo_link_violations /
 * delete_demo_data); deleting also removes the demo documents' files.
 */
function DemoTab() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [busy, setBusy] = useState<'seed' | 'check' | 'delete' | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [check, setCheck] = useState<{ kind: string; detail: string }[] | null>(null)
  const counts = useQuery({
    queryKey: ['admin', 'demo-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('demo_data_counts')
      if (error) throw error
      return (data ?? {}) as Record<string, number>
    },
  })
  const loaded = (counts.data?.submissions ?? 0) > 0 || (counts.data?.counterparties ?? 0) > 0

  async function seed() {
    setBusy('seed')
    const { error } = await supabase.rpc('seed_demo_data')
    setBusy(null)
    if (error) return toast.error(errorMessage(error))
    toast.success(t('admin.demo.loaded'))
    await qc.invalidateQueries({ queryKey: ['admin', 'demo-counts'] })
  }

  async function runCheck() {
    setBusy('check')
    const { data, error } = await supabase.rpc('demo_link_violations')
    setBusy(null)
    if (error) return toast.error(errorMessage(error))
    setCheck((data ?? []) as { kind: string; detail: string }[])
  }

  async function remove() {
    setBusy('delete')
    const { data, error } = await supabase.rpc('delete_demo_data')
    if (error) {
      setBusy(null)
      return toast.error(errorMessage(error))
    }
    const paths = ((data ?? {}) as { document_paths?: string[] }).document_paths ?? []
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from(DOCUMENTS_BUCKET).remove(paths)
      if (storageError) toast.error(errorMessage(storageError))
    }
    setBusy(null)
    setConfirm(false)
    setCheck(null)
    toast.success(t('admin.demo.deleted'))
    await qc.invalidateQueries()
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-4">
        <div>
          <CardTitle>{t('admin.demo.title')}</CardTitle>
          <p className="mt-1 max-w-3xl text-caption text-muted-foreground">{t('admin.demo.help')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void runCheck()} disabled={busy !== null}>
            {busy === 'check' ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            {t('admin.demo.check')}
          </Button>
          <Button variant="outline" onClick={() => void seed()} disabled={busy !== null || loaded || counts.isLoading}>
            {busy === 'seed' ? <Loader2 className="animate-spin" /> : <Database />}
            {t('admin.demo.load')}
          </Button>
          <Button variant="destructive" onClick={() => setConfirm(true)} disabled={busy !== null || !loaded}>
            <Trash2 />
            {t('admin.demo.delete')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 border-t py-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6" data-demo-counts>
          {DEMO_KINDS.map((k) => (
            <div key={k}>
              <dt className="text-caption text-muted-foreground">{t(`admin.demo.kinds.${k}`)}</dt>
              <dd className="text-title font-semibold tabular-nums">{counts.data?.[k] ?? 0}</dd>
            </div>
          ))}
        </dl>
        {check !== null && (
          <div role="status" className={check.length ? 'text-danger-700' : 'text-success-700'}>
            {check.length === 0 ? t('admin.demo.checkOk') : t('admin.demo.checkBad', { count: check.length })}
            {check.length > 0 && (
              <ul className="mt-2 list-disc pl-6 text-caption">
                {check.slice(0, 20).map((c, i) => <li key={i}>{c.kind}: {c.detail}</li>)}
              </ul>
            )}
          </div>
        )}
      </CardContent>
      <Dialog open={confirm} onOpenChange={(o) => !o && setConfirm(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.demo.confirmTitle')}</DialogTitle>
            <DialogDescription>{t('admin.demo.confirmText', { count: counts.data?.submissions ?? 0 })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={() => void remove()} disabled={busy !== null}>
              {busy === 'delete' ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {t('admin.demo.deleteConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
