import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Clock, FileStack, Loader2, Mail, Pencil, Phone, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DataTable, type Column } from '@/components/data/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { Amount } from '@/components/Amount'
import { SegmentedControl } from '@/components/SegmentedControl'
import { STATUSES, STATUS_SOLID } from '@/lib/status'
import { Field } from '@/components/Field'
import { StatusBadge } from '@/components/StatusBadge'
import { useAuth } from '@/auth/AuthProvider'
import { can } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { formatAmount, formatDate, formatPct, locale } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import type { Enums, Json } from '@/lib/database.types'
import { useCountries, useLocalName } from '@/hooks/useReference'
import { SavedCheck, useFlash } from '@/components/SavedCheck'
import type { SubmissionRow } from '@/features/submissions/api'

type Contact = { name: string; role: string; email: string; phone: string }

function toContacts(j: Json): Contact[] {
  if (!Array.isArray(j)) return []
  return j.map((c) => {
    const o = (c ?? {}) as Record<string, unknown>
    return { name: String(o.name ?? ''), role: String(o.role ?? ''), email: String(o.email ?? ''), phone: String(o.phone ?? '') }
  })
}

export function CounterpartyDetailPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const { role } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const countries = useCountries()
  const localName = useLocalName()
  const editable = can.editSubmissions(role)

  const party = useQuery({
    queryKey: ['counterparty', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('counterparties').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      return data
    },
  })

  const subs = useQuery({
    queryKey: ['submissions', 'by-party', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('submissions_v')
        .select('*')
        .or(`mga_id.eq.${id},broker_id.eq.${id},source_party_id.eq.${id}`)
        .order('received_at', { ascending: false })
        .limit(5000)
      if (error) throw error
      return data as SubmissionRow[]
    },
  })

  const [form, setForm] = useState<{ name: string; type: Enums<'counterparty_type'>; country_code: string; notes: string; active: boolean; contacts: Contact[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [savedShown, flashSaved] = useFlash()
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (party.data)
      setForm({
        name: party.data.name,
        type: party.data.type,
        country_code: party.data.country_code ?? '',
        notes: party.data.notes ?? '',
        active: party.data.active,
        contacts: toContacts(party.data.contacts),
      })
  }, [party.data])

  const kpi = useMemo(() => {
    const rows = subs.data ?? []
    const year = String(new Date().getFullYear())
    const offered = rows.filter((r) => r.offered_at)
    const bound = rows.filter((r) => r.status === 'bound')
    const boundYear = bound.filter((r) => r.bound_at?.startsWith(year))
    const openOffers = rows.filter((r) => r.status === 'offered' || r.status === 'no_response')
    const avg = (xs: (number | null)[]) => {
      const v = xs.filter((x): x is number => x !== null)
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
    }
    return {
      total: rows.length,
      thisYear: rows.filter((r) => r.received_at?.startsWith(year)).length,
      offered: offered.length,
      bound: bound.length,
      hit: offered.length ? offered.filter((r) => r.status === 'bound').length / offered.length : null,
      boundUsd: bound.reduce((s, r) => s + (r.our_gross_premium_usd ?? 0), 0),
      boundYearUsd: boundYear.reduce((s, r) => s + (r.our_gross_premium_usd ?? 0), 0),
      openOffers: openOffers.length,
      openOffersUsd: openOffers.reduce((s, r) => s + (r.our_gross_premium_usd ?? 0), 0),
      avgWritten: avg(offered.map((r) => r.written_share_pct)),
      avgSigned: avg(bound.map((r) => r.signed_share_pct)),
      declined: rows.filter((r) => r.status === 'declined').length,
    }
  }, [subs.data])

  if (party.isLoading)
    return (
      <div className="grid gap-4" aria-busy>
        <Skeleton className="h-16 w-1/2" />
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  if (!party.data || !form) return <p className="p-6 text-body text-muted-foreground">{t('cp.notFound')}</p>

  const p = party.data
  const registerLink = p.type === 'mga' ? `/submissions?mga=${p.id}` : p.type === 'broker' ? `/submissions?broker=${p.id}` : '/submissions'
  const setContact = (i: number, patch: Partial<Contact>) =>
    setForm((f) => f && { ...f, contacts: f.contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)) })

  async function save() {
    if (!form || !form.name.trim()) return
    setBusy(true)
    const { error } = await supabase
      .from('counterparties')
      .update({
        name: form.name.trim(),
        type: form.type,
        country_code: form.country_code || null,
        notes: form.notes.trim() || null,
        active: form.active,
        contacts: form.contacts.filter((c) => c.name || c.email || c.phone),
      })
      .eq('id', p.id)
    setBusy(false)
    if (error) {
      toast.error(/duplicate key/i.test(error.message) ? t('cp.duplicate') : errorMessage(error))
      return
    }
    await Promise.all([qc.invalidateQueries({ queryKey: ['counterparty', id] }), qc.invalidateQueries({ queryKey: ['ref', 'counterparties'] }), qc.invalidateQueries({ queryKey: ['submissions'] })])
    setEditing(false)
    flashSaved()
  }

  const pct = (v: number | null) => (v === null ? '—' : `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(v * 100)} %`)

  const contacts = toContacts(p.contacts).filter((c) => c.name || c.email || c.phone)
  const rows = subs.data ?? []
  const mix = STATUSES.map((st) => ({ status: st, count: rows.filter((r) => r.status === st).length })).filter((x) => x.count > 0)
  const overdue = rows.filter((r) => r.follow_up_overdue).length

  const columns: Column<SubmissionRow>[] = [
    { id: 'ref_no', header: t('fields.refNo'), cell: (r) => <Link to={`/submissions/${r.id}`} className="font-medium text-link hover:underline num" onClick={(e) => e.stopPropagation()}>{r.ref_no}</Link> },
    { id: 'received_at', header: t('fields.receivedAt'), cell: (r) => formatDate(r.received_at) },
    { id: 'insured_name', header: t('fields.insuredName'), className: 'max-w-56 truncate', cell: (r) => r.insured_name },
    {
      id: 'role',
      header: t('cp.role'),
      className: 'text-caption text-muted-foreground',
      cell: (r) => [r.mga_id === p.id && t('counterpartyType.mga'), r.broker_id === p.id && t('counterpartyType.broker'), r.source_party_id === p.id && t('cp.sender')].filter(Boolean).join(', '),
    },
    { id: 'status', header: t('fields.status'), cell: (r) => <StatusBadge status={r.status} /> },
    { id: 'share', header: t('fields.share'), align: 'right', cell: (r) => (r.share_pct === null ? '—' : formatPct(r.share_pct)) },
    { id: 'usd', header: t('fields.ourGrossUsd'), align: 'right', cell: (r) => formatAmount(r.our_gross_premium_usd) },
  ]

  const facts: { label: string; value: ReactNode; sub?: ReactNode }[] = [
    { label: t('cp.kpi.submissions'), value: kpi.total, sub: t('cp.kpi.thisYear', { count: kpi.thisYear }) },
    { label: t('cp.kpi.offered'), value: kpi.offered, sub: t('cp.kpi.declined', { count: kpi.declined }) },
    { label: t('cp.kpi.bound'), value: kpi.bound, sub: `${t('dash.hitRatio')}: ${pct(kpi.hit)}` },
    { label: t('cp.kpi.boundUsd'), value: <Amount value={kpi.boundUsd} human />, sub: <>{t('ui.thisYear')}: <Amount value={kpi.boundYearUsd} human /></> },
    { label: t('cp.kpi.openOffers'), value: kpi.openOffers, sub: <Amount value={kpi.openOffersUsd} currency="USD" human /> },
    {
      label: t('cp.kpi.avgShare'),
      value: kpi.avgSigned === null ? '—' : formatPct(Math.round(kpi.avgSigned * 100) / 100),
      sub: `${t('fields.writtenSharePct')}: ${kpi.avgWritten === null ? '—' : formatPct(Math.round(kpi.avgWritten * 100) / 100)}`,
    },
  ]

  return (
    <>
      <div className="mb-2">
        <Link to="/counterparties" className="inline-flex items-center gap-1 text-body text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          {t('pages.counterparties.title')}
        </Link>
      </div>
      <PageHeader
        title={p.name}
        subtitle={[t(`counterpartyType.${p.type}`), localName(countries.data?.find((c) => c.code === p.country_code))].filter(Boolean).join(' · ')}
        actions={
          <>
            <SavedCheck show={savedShown} />
            <Button variant="outline" asChild>
              <Link to={registerLink}><FileStack />{t('cp.openInRegister')}</Link>
            </Button>
            {editable && (
              <Button onClick={() => setEditing(true)}>
                <Pencil />
                {t('ui.editDetails')}
              </Button>
            )}
          </>
        }
      />

      {/* Summary card: who they are to us, in numbers, and what is open */}
      <Card className="mb-4 gap-0 py-0">
        <CardContent className="grid gap-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{t(`counterpartyType.${p.type}`)}</Badge>
            {!p.active && <Badge>{t('common.inactive')}</Badge>}
            {kpi.openOffers > 0 && <Badge tone="offered">{t('ui.openOffers', { count: kpi.openOffers })}</Badge>}
            {overdue > 0 && <Badge tone="danger"><Clock />{t('ui.overdueFollowUps', { count: overdue })}</Badge>}
          </div>
          <dl className="grid grid-cols-2 gap-y-4 md:grid-cols-3 xl:grid-cols-6 xl:divide-x">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0 xl:px-5 xl:first:pl-0">
                <dt className="text-caption font-medium text-muted-foreground">{f.label}</dt>
                <dd className="mt-1 font-display-bold text-headline num">{f.value}</dd>
                {f.sub && <dd className="text-caption text-muted-foreground">{f.sub}</dd>}
              </div>
            ))}
          </dl>
          {mix.length > 0 && (
            <div className="grid gap-2 border-t pt-4">
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                {mix.map((x) => <span key={x.status} style={{ width: `${(x.count / rows.length) * 100}%`, background: STATUS_SOLID[x.status] }} />)}
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
                {mix.map((x) => (
                  <li key={x.status} className="inline-flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: STATUS_SOLID[x.status] }} />
                    {t(`status.${x.status}`)} <span className="font-medium text-foreground num">{x.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="gap-0 py-0">
          <CardHeader className="py-4"><CardTitle>{t('cp.theirSubmissions')}</CardTitle></CardHeader>
          <DataTable
            id="counterparty-submissions"
            columns={columns}
            rows={rows}
            getRowId={(r) => r.id!}
            loading={subs.isLoading}
            onRowClick={(r) => navigate(`/submissions/${r.id}`)}
            toolbar={<span className="num">{t('ui.rows', { count: rows.length })}</span>}
            empty={<EmptyState pictogram="inbox" title={t('ui.noSubmissionsYet')} />}
            maxHeight="max-h-[560px]"
          />
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader><CardTitle>{t('cp.contacts')}</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {contacts.length === 0 ? (
                <p className="text-body text-muted-foreground">{t('cp.noContacts')}</p>
              ) : (
                contacts.map((c, i) => (
                  <div key={i} className="grid gap-1 rounded-md border p-3 text-body">
                    <span className="font-medium">{c.name}{c.role && <span className="font-normal text-muted-foreground"> · {c.role}</span>}</span>
                    {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-2 text-link hover:underline"><Mail className="size-4" />{c.email}</a>}
                    {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-2 text-link hover:underline num"><Phone className="size-4" />{c.phone}</a>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          {p.notes && (
            <Card>
              <CardHeader><CardTitle>{t('fields.notes')}</CardTitle></CardHeader>
              <CardContent><p className="text-body whitespace-pre-line">{p.notes}</p></CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit details in a side panel */}
      <Dialog open={editing} onOpenChange={(o) => !busy && setEditing(o)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('cp.details')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label={t('fields.name')} required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label={t('cp.type')}>
              <SegmentedControl
                ariaLabel={t('cp.type')}
                value={form.type}
                onChange={(v) => setForm({ ...form, type: v })}
                options={(['mga', 'broker', 'cedent'] as const).map((tp) => ({ value: tp, label: t(`counterpartyType.${tp}`) }))}
              />
            </Field>
            <Field label={t('fields.country')}>
              <NativeSelect value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value })}>
                <option value="">—</option>
                {countries.data?.map((c) => <option key={c.code} value={c.code}>{localName(c)}</option>)}
              </NativeSelect>
            </Field>
            <Field label={t('fields.notes')}>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-body">
              <input type="checkbox" className="size-4 accent-navy-600" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              {t('common.active')}
            </label>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <span className="text-body font-medium">{t('cp.contacts')}</span>
                <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, contacts: [...form.contacts, { name: '', role: '', email: '', phone: '' }] })}>
                  <Plus />
                  {t('cp.addContact')}
                </Button>
              </div>
              {form.contacts.length === 0 && <p className="text-caption text-muted-foreground">{t('cp.noContacts')}</p>}
              {form.contacts.map((c, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-md border p-2">
                  <Input placeholder={t('cp.contactName')} value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} />
                  <Input placeholder={t('cp.contactRole')} value={c.role} onChange={(e) => setContact(i, { role: e.target.value })} />
                  <Input placeholder="email@…" type="email" value={c.email} onChange={(e) => setContact(i, { email: e.target.value })} />
                  <div className="flex gap-1">
                    <Input placeholder="+998 …" value={c.phone} onChange={(e) => setContact(i, { phone: e.target.value })} />
                    <Button variant="ghost" size="icon" aria-label={t('common.remove')} onClick={() => setForm({ ...form, contacts: form.contacts.filter((_, j) => j !== i) })}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)} disabled={busy}>{t('common.cancel')}</Button>
            <Button onClick={() => void save()} disabled={busy || !form.name.trim()}>
              {busy ? <Loader2 className="animate-spin" /> : <Save />}
              {t('ui.form.saveDetails')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
