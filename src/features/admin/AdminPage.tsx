import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Loader2, Play, Plus, Save, Trash2, UserPlus } from 'lucide-react'
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
import { supabase } from '@/lib/supabase'
import { ALL_ROLES, type AppRole } from '@/lib/roles'
import { formatDate, formatDateTime, isoDate } from '@/lib/format'
import { cleanDecimal, isDecimal } from '@/lib/decimal'
import { errorMessage } from '@/lib/errors'
import type { Tables } from '@/lib/database.types'
import { useCurrencies } from '@/hooks/useReference'

export function AdminPage() {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={t('pages.admin.title')} subtitle={t('pages.admin.subtitle')} />
      <Tabs defaultValue="users">
        <TabsList className="flex-wrap">
          <TabsTrigger value="users">{t('admin.tabs.users')}</TabsTrigger>
          <TabsTrigger value="reference">{t('admin.tabs.reference')}</TabsTrigger>
          <TabsTrigger value="fx">{t('admin.tabs.fx')}</TabsTrigger>
          <TabsTrigger value="settings">{t('admin.tabs.settings')}</TabsTrigger>
          <TabsTrigger value="jobs">{t('admin.tabs.jobs')}</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="reference"><ReferenceTab /></TabsContent>
        <TabsContent value="fx"><FxTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
        <TabsContent value="jobs"><JobsTab /></TabsContent>
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
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between py-4">
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
          {users.data?.map((u) => {
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
}: {
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
            {rows.data?.map((r) => {
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
  return (
    <div className="grid gap-4">
      <RefTable
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
  const [filter, setFilter] = useState('')
  const rates = useQuery({
    queryKey: ['admin', 'fx', filter],
    queryFn: async () => {
      let q = supabase.from('fx_rates').select('*').order('rate_date', { ascending: false }).order('currency').limit(300)
      if (filter) q = q.eq('currency', filter)
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
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle>{t('admin.tabs.fx')}</CardTitle>
          <div className="w-36">
            <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">{t('sub.allCurrencies')}</option>
              {currencies.data?.filter((c) => c.code !== 'USD').map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </NativeSelect>
          </div>
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
const SETTING_KEYS = ['follow_up_first_days', 'follow_up_repeat_days', 'auto_no_response_enabled', 'auto_no_response_days'] as const

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
    if (settings.data) setVals(Object.fromEntries(settings.data.map((s) => [s.key, s.value as string | boolean])))
  }, [settings.data])

  async function save() {
    for (const k of ['follow_up_first_days', 'follow_up_repeat_days', 'auto_no_response_days']) {
      const n = Number(vals[k])
      if (!Number.isInteger(n) || n < 1 || n > 365) {
        toast.error(t('admin.settings.invalidDays'))
        return
      }
    }
    setBusy(true)
    const rows = SETTING_KEYS.map((k) => ({ key: k, value: k === 'auto_no_response_enabled' ? Boolean(vals[k]) : Number(vals[k]) }))
    const { error } = await supabase.from('settings').upsert(rows)
    setBusy(false)
    if (error) return toast.error(errorMessage(error))
    flashSaved()
    await qc.invalidateQueries({ queryKey: ['admin', 'settings'] })
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle>{t('admin.tabs.settings')}</CardTitle></CardHeader>
      <CardContent className="grid gap-4">
        <Field label={t('admin.settings.firstDays')} hint={t('admin.settings.firstDaysHint')}>
          <Input type="number" min={1} max={365} className="w-32" value={String(vals.follow_up_first_days ?? '')} onChange={(e) => setVals({ ...vals, follow_up_first_days: e.target.value })} />
        </Field>
        <Field label={t('admin.settings.repeatDays')} hint={t('admin.settings.repeatDaysHint')}>
          <Input type="number" min={1} max={365} className="w-32" value={String(vals.follow_up_repeat_days ?? '')} onChange={(e) => setVals({ ...vals, follow_up_repeat_days: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-body">
          <input type="checkbox" checked={Boolean(vals.auto_no_response_enabled)} onChange={(e) => setVals({ ...vals, auto_no_response_enabled: e.target.checked })} />
          {t('admin.settings.autoEnabled')}
        </label>
        <Field label={t('admin.settings.autoDays')} hint={t('admin.settings.autoDaysHint')}>
          <Input type="number" min={1} max={365} className="w-32" value={String(vals.auto_no_response_days ?? '')} onChange={(e) => setVals({ ...vals, auto_no_response_days: e.target.value })} disabled={!vals.auto_no_response_enabled} />
        </Field>
        <div className="flex items-center gap-3">
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Save />}
            {t('ui.form.saveSettings')}
          </Button>
          <SavedCheck show={savedShown} />
        </div>
      </CardContent>
    </Card>
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
      <CardHeader className="flex flex-row items-center justify-between py-4">
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
