import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Field } from '@/components/Field'
import { StatusBadge } from '@/components/StatusBadge'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { useAuth } from '@/auth/AuthProvider'
import { can } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { formatAmount, formatCompactUsd, formatDate, formatPct, locale } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import type { Enums, Json } from '@/lib/database.types'
import { useCountries, useLocalName } from '@/hooks/useReference'
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

  if (party.isLoading) return <FullPageSpinner />
  if (!party.data || !form) return <p className="p-6 text-sm text-muted-foreground">{t('cp.notFound')}</p>

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
    toast.success(t('cp.saved'))
  }

  const pct = (v: number | null) => (v === null ? '—' : `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(v * 100)} %`)

  return (
    <>
      <div className="mb-2">
        <Link to="/counterparties" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          {t('pages.counterparties.title')}
        </Link>
      </div>
      <PageHeader
        title={p.name}
        subtitle={[t(`counterpartyType.${p.type}`), localName(countries.data?.find((c) => c.code === p.country_code)), p.active ? null : t('common.inactive')].filter(Boolean).join(' · ')}
        actions={
          <Button variant="outline" asChild>
            <Link to={registerLink}>{t('cp.openInRegister')}</Link>
          </Button>
        }
      />

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Kpi label={t('cp.kpi.submissions')} value={String(kpi.total)} sub={t('cp.kpi.thisYear', { count: kpi.thisYear })} />
        <Kpi label={t('cp.kpi.offered')} value={String(kpi.offered)} sub={t('cp.kpi.declined', { count: kpi.declined })} />
        <Kpi label={t('cp.kpi.bound')} value={String(kpi.bound)} sub={`${t('dash.hitRatio')}: ${pct(kpi.hit)}`} />
        <Kpi label={t('cp.kpi.boundUsd')} value={formatCompactUsd(kpi.boundUsd)} sub={t('cp.kpi.thisYearUsd', { amount: formatCompactUsd(kpi.boundYearUsd) })} />
        <Kpi label={t('cp.kpi.openOffers')} value={String(kpi.openOffers)} sub={formatCompactUsd(kpi.openOffersUsd)} />
        <Kpi label={t('cp.kpi.avgShare')} value={kpi.avgSigned === null ? '—' : formatPct(Math.round(kpi.avgSigned * 100) / 100)} sub={`${t('fields.writtenSharePct')}: ${kpi.avgWritten === null ? '—' : formatPct(Math.round(kpi.avgWritten * 100) / 100)}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card className="gap-0 py-0">
          <CardHeader className="py-4"><CardTitle>{t('cp.theirSubmissions')}</CardTitle></CardHeader>
          {subs.isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('fields.refNo')}</TableHead>
                  <TableHead>{t('fields.receivedAt')}</TableHead>
                  <TableHead>{t('fields.insuredName')}</TableHead>
                  <TableHead>{t('cp.role')}</TableHead>
                  <TableHead>{t('fields.status')}</TableHead>
                  <TableHead className="text-right">{t('fields.share')}</TableHead>
                  <TableHead className="text-right">{t('fields.ourGrossUsd')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.data?.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/submissions/${r.id}`)}>
                    <TableCell className="font-medium text-primary">{r.ref_no}</TableCell>
                    <TableCell>{formatDate(r.received_at)}</TableCell>
                    <TableCell className="max-w-56 truncate">{r.insured_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {[r.mga_id === p.id && t('counterpartyType.mga'), r.broker_id === p.id && t('counterpartyType.broker'), r.source_party_id === p.id && t('cp.sender')].filter(Boolean).join(', ')}
                    </TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-right tabular-nums">{r.share_pct === null ? '—' : formatPct(r.share_pct)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatAmount(r.our_gross_premium_usd)}</TableCell>
                  </TableRow>
                ))}
                {subs.data?.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{t('sub.noResults')}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('cp.details')}</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <Field label={t('fields.name')} required>
              <Input value={form.name} disabled={!editable} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('cp.type')}>
                <NativeSelect value={form.type} disabled={!editable} onChange={(e) => setForm({ ...form, type: e.target.value as Enums<'counterparty_type'> })}>
                  {(['mga', 'broker', 'cedent'] as const).map((tp) => <option key={tp} value={tp}>{t(`counterpartyType.${tp}`)}</option>)}
                </NativeSelect>
              </Field>
              <Field label={t('fields.country')}>
                <NativeSelect value={form.country_code} disabled={!editable} onChange={(e) => setForm({ ...form, country_code: e.target.value })}>
                  <option value="">—</option>
                  {countries.data?.map((c) => <option key={c.code} value={c.code}>{localName(c)}</option>)}
                </NativeSelect>
              </Field>
            </div>
            <Field label={t('fields.notes')}>
              <Textarea rows={2} value={form.notes} disabled={!editable} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} disabled={!editable} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              {t('common.active')}
            </label>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('cp.contacts')}</span>
                {editable && (
                  <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, contacts: [...form.contacts, { name: '', role: '', email: '', phone: '' }] })}>
                    <Plus />
                    {t('cp.addContact')}
                  </Button>
                )}
              </div>
              {form.contacts.length === 0 && <p className="text-xs text-muted-foreground">{t('cp.noContacts')}</p>}
              {form.contacts.map((c, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-md border p-2">
                  <Input placeholder={t('cp.contactName')} value={c.name} disabled={!editable} onChange={(e) => setContact(i, { name: e.target.value })} />
                  <Input placeholder={t('cp.contactRole')} value={c.role} disabled={!editable} onChange={(e) => setContact(i, { role: e.target.value })} />
                  <Input placeholder="email@…" type="email" value={c.email} disabled={!editable} onChange={(e) => setContact(i, { email: e.target.value })} />
                  <div className="flex gap-1">
                    <Input placeholder="+998 …" value={c.phone} disabled={!editable} onChange={(e) => setContact(i, { phone: e.target.value })} />
                    {editable && (
                      <Button variant="ghost" size="icon" aria-label={t('common.remove')} onClick={() => setForm({ ...form, contacts: form.contacts.filter((_, j) => j !== i) })}>
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {editable && (
              <Button onClick={() => void save()} disabled={busy || !form.name.trim()}>
                {busy ? <Loader2 className="animate-spin" /> : <Save />}
                {t('common.save')}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="px-4">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  )
}
