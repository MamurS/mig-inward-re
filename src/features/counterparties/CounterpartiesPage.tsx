import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Eye, FileStack, Mail, Phone, Search } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SegmentedControl } from '@/components/SegmentedControl'
import { DataTable, type Column } from '@/components/data/DataTable'
import { highlight } from '@/components/data/highlight'
import { EmptyState } from '@/components/EmptyState'
import { Amount } from '@/components/Amount'
import { useAuth } from '@/auth/AuthProvider'
import { can } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { formatAmount } from '@/lib/format'
import { useCounterparties, useCountries, useLocalName } from '@/hooks/useReference'
import type { Enums, Json, Tables } from '@/lib/database.types'
import { QuickAddCounterparty } from './QuickAddCounterparty'

type Party = Tables<'counterparties'>
type PartyStats = { count: number; bound: number; boundUsd: number }

function contactsOf(j: Json): { name: string; role: string; email: string; phone: string }[] {
  if (!Array.isArray(j)) return []
  return j.map((c) => {
    const o = (c ?? {}) as Record<string, unknown>
    return { name: String(o.name ?? ''), role: String(o.role ?? ''), email: String(o.email ?? ''), phone: String(o.phone ?? '') }
  })
}

export const registerLinkFor = (p: Pick<Party, 'id' | 'type'>) =>
  p.type === 'mga' ? `/submissions?mga=${p.id}` : p.type === 'broker' ? `/submissions?broker=${p.id}` : '/submissions'

type Stat = { mga_id: string; broker_id: string | null; status: string; our_gross_premium_usd: number | null }

export function CounterpartiesPage() {
  const { t } = useTranslation()
  const { role } = useAuth()
  const navigate = useNavigate()
  const counterparties = useCounterparties()
  const countries = useCountries()
  const localName = useLocalName()
  const [q, setQ] = useState('')
  const [type, setType] = useState<'' | Enums<'counterparty_type'>>('')
  const [showInactive, setShowInactive] = useState(false)
  const [peek, setPeek] = useState<Party | null>(null)

  const stats = useQuery({
    queryKey: ['submissions', 'cp-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('submissions_v').select('mga_id, broker_id, status, our_gross_premium_usd').limit(10000)
      if (error) throw error
      return data as Stat[]
    },
  })

  const perParty = useMemo(() => {
    const map = new Map<string, PartyStats>()
    const add = (id: string | null, r: Stat) => {
      if (!id) return
      const e = map.get(id) ?? { count: 0, bound: 0, boundUsd: 0 }
      e.count++
      if (r.status === 'bound') {
        e.bound++
        e.boundUsd += r.our_gross_premium_usd ?? 0
      }
      map.set(id, e)
    }
    for (const r of stats.data ?? []) {
      add(r.mga_id, r)
      add(r.broker_id, r)
    }
    return map
  }, [stats.data])

  const rows = (counterparties.data ?? []).filter(
    (c) => (showInactive || c.active) && (!type || c.type === type) && (!q || c.name.toLowerCase().includes(q.toLowerCase())),
  )

  const countryName = (code: string | null) => localName(countries.data?.find((x) => x.code === code))

  const columns: Column<Party>[] = [
    {
      id: 'name',
      header: t('fields.name'),
      cell: (c, x) => (
        <span className="inline-flex items-center gap-2">
          <Link to={`/counterparties/${c.id}`} className="font-medium text-link hover:underline" onClick={(e) => e.stopPropagation()}>{x.hl(c.name)}</Link>
          {!c.active && <Badge>{t('common.inactive')}</Badge>}
        </span>
      ),
    },
    { id: 'type', header: t('cp.type'), cell: (c) => t(`counterpartyType.${c.type}`) },
    { id: 'country', header: t('fields.country'), cell: (c) => countryName(c.country_code) || '—' },
    { id: 'count', header: t('cp.submissions'), align: 'right', cell: (c) => perParty.get(c.id)?.count ?? 0 },
    { id: 'bound', header: t('cp.bound'), align: 'right', cell: (c) => perParty.get(c.id)?.bound ?? 0 },
    { id: 'boundUsd', header: t('cp.boundUsd'), align: 'right', cell: (c) => formatAmount(perParty.get(c.id)?.boundUsd ?? 0) },
  ]

  return (
    <>
      <PageHeader
        title={t('pages.counterparties.title')}
        subtitle={t('pages.counterparties.subtitle')}
        actions={
          can.editSubmissions(role) && (
            <div className="flex gap-2">
              {(['mga', 'broker', 'cedent'] as const).map((tp) => (
                <div key={tp} className="flex items-center gap-2 text-body">
                  <QuickAddCounterparty type={tp} onCreated={(id) => navigate(`/counterparties/${id}`)} />
                  <span className="hidden text-muted-foreground lg:inline">{t(`counterpartyType.${tp}`)}</span>
                </div>
              ))}
            </div>
          )
        }
      />
      <Card className="mb-4 flex-row flex-wrap items-center gap-3 px-4 py-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('cp.search')} className="pl-8" />
        </div>
        <SegmentedControl
          ariaLabel={t('cp.type')}
          value={type || 'all'}
          onChange={(v) => setType(v === 'all' ? '' : v)}
          options={[
            { value: 'all' as const, label: t('cp.allTypes') },
            ...(['mga', 'broker', 'cedent'] as const).map((tp) => ({ value: tp, label: t(`counterpartyType.${tp}`) })),
          ]}
        />
        <label className="flex items-center gap-2 text-body">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          {t('cp.showInactive')}
        </label>
      </Card>
      <Card className="gap-0 py-0">
        <DataTable
          id="counterparties"
          columns={columns}
          rows={rows}
          getRowId={(c) => c.id}
          loading={counterparties.isLoading}
          hl={(text) => highlight(text, q)}
          onRowClick={(c) => navigate(`/counterparties/${c.id}`)}
          rowActions={(c) => (
            <Button variant="ghost" size="icon" className="size-8" aria-label={t('ui.quickView')} title={t('ui.quickView')} onClick={() => setPeek(c)}>
              <Eye />
            </Button>
          )}
          toolbar={<span className="num">{t('ui.rows', { count: rows.length })}</span>}
          empty={<EmptyState pictogram="people" title={t('cp.none')}>{q || type ? t('ui.emptyFiltered') : undefined}</EmptyState>}
        />
      </Card>
      <CounterpartyQuickView party={peek} stats={peek ? perParty.get(peek.id) : undefined} country={peek ? countryName(peek.country_code) : ''} onClose={() => setPeek(null)} />
    </>
  )
}

function CounterpartyQuickView({ party, stats, country, onClose }: { party: Party | null; stats?: PartyStats; country?: string; onClose: () => void }) {
  const { t } = useTranslation()
  const contacts = party ? contactsOf(party.contacts).filter((c) => c.name || c.email || c.phone) : []
  return (
    <Dialog open={Boolean(party)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined}>
        {party && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Badge tone="brand">{t(`counterpartyType.${party.type}`)}</Badge>
                {!party.active && <Badge>{t('common.inactive')}</Badge>}
              </div>
              <DialogTitle>{party.name}</DialogTitle>
              <DialogDescription>{country || '—'}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted p-4">
              <div className="grid gap-1">
                <span className="text-caption text-muted-foreground">{t('cp.submissions')}</span>
                <span className="text-lead font-semibold num">{stats?.count ?? 0}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-caption text-muted-foreground">{t('cp.bound')}</span>
                <span className="text-lead font-semibold num">{stats?.bound ?? 0}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-caption text-muted-foreground">{t('cp.kpi.boundUsd')}</span>
                <Amount value={stats?.boundUsd ?? 0} human className="text-lead font-semibold" />
              </div>
            </div>
            <div className="grid gap-2">
              <h3 className="text-body font-semibold">{t('cp.contacts')}</h3>
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
            </div>
            {party.notes && <p className="text-body whitespace-pre-line text-muted-foreground">{party.notes}</p>}
            <DialogFooter>
              <Button variant="outline" asChild>
                <Link to={registerLinkFor(party)}><FileStack />{t('cp.openInRegister')}</Link>
              </Button>
              <Button asChild>
                <Link to={`/counterparties/${party.id}`}><ArrowUpRight />{t('ui.openCounterparty')}</Link>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
