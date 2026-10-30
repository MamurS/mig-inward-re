import { useMemo, useState } from 'react'
import type { TFunction } from 'i18next'
import { toast } from 'sonner'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { registerLink } from '@/features/submissions/filters'
import { quoteValue } from '@/features/search/query'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Eye, FileSpreadsheet, FileStack, Loader2, Mail, Phone } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DataTable, type Column } from '@/components/data/DataTable'
import { highlight } from '@/components/data/highlight'
import { EmptyState } from '@/components/EmptyState'
import { Amount } from '@/components/Amount'
import { useAuth } from '@/auth/AuthProvider'
import { can } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { formatAmount, isoDate } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import { norm } from '@/features/search/normalize'
import { textWords } from '@/features/search/query'
import { hasFlag, matchesQuery, type ClientSpec } from '@/features/search/client'
import { COUNTERPARTIES_PAGE } from '@/features/search/pages'
import { useListSearch } from '@/features/search/useSearch'
import { SearchChips } from '@/features/search/SearchChips'
import { useCounterparties, useCountries, useLocalName } from '@/hooks/useReference'
import type { Json, Tables } from '@/lib/database.types'
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

export const registerLinkFor = (p: Pick<Party, 'id' | 'type' | 'name'>) =>
  p.type === 'mga' || p.type === 'broker' ? registerLink(`${p.type}:${quoteValue(p.name)}`) : '/submissions'

type Stat = { mga_id: string; broker_id: string | null; status: string; our_gross_premium_usd: number | null }

export function CounterpartiesPage() {
  const { t } = useTranslation()
  const { role } = useAuth()
  const navigate = useNavigate()
  const counterparties = useCounterparties()
  const countries = useCountries()
  const localName = useLocalName()
  const { q, parsed, setQ } = useListSearch(COUNTERPARTIES_PAGE)
  const [exporting, setExporting] = useState(false)
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

  // The search bar filters this list (it is loaded whole: a reference-sized table). Inactive ones show only with «inactive».
  const spec: ClientSpec<Party> = useMemo(() => {
    const byCode = new Map((countries.data ?? []).map((c) => [c.code, c]))
    return {
      text: (c) => {
        const co = c.country_code ? byCode.get(c.country_code) : undefined
        const people = contactsOf(c.contacts).flatMap((x) => [x.name, x.role, x.email, x.phone])
        return norm([c.name, c.country_code, co?.name, co?.name_ru, co?.name_uz, c.notes, ...people].filter(Boolean).join(' '))
      },
      list: { type: (c) => c.type, country: (c) => c.country_code },
      flags: { inactive: () => true },
    }
  }, [countries.data])
  const withInactive = hasFlag(parsed, 'inactive')
  const rows = (counterparties.data ?? []).filter((c) => (withInactive || c.active) && matchesQuery(parsed, c, spec))
  const words = parsed ? textWords(parsed) : []

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
          <>
            <Button
              variant="outline"
              disabled={!rows.length || exporting}
              onClick={async () => {
                setExporting(true)
                try {
                  await exportCounterpartiesXlsx(rows, perParty, countryName, t)
                  toast.success(t('cp.exported', { count: rows.length }))
                } catch (e) {
                  toast.error(errorMessage(e))
                } finally {
                  setExporting(false)
                }
              }}
            >
              {exporting ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
              {t('sub.exportExcel')}
            </Button>
            {can.editSubmissions(role) && <QuickAddCounterparty onCreated={(id) => navigate(`/counterparties/${id}`)} />}
          </>
        }
      />
      {parsed && (
        <SearchChips query={parsed} scope={COUNTERPARTIES_PAGE.scope} onChange={setQ} count={t('ui.rows', { count: rows.length })} />
      )}
      <Card className="gap-0 py-0">
        <DataTable
          id="counterparties"
          columns={columns}
          rows={rows}
          getRowId={(c) => c.id}
          loading={counterparties.isLoading}
          hl={(text) => highlight(text, words)}
          onRowClick={(c) => navigate(`/counterparties/${c.id}`)}
          rowActions={(c) => (
            <Button variant="ghost" size="icon" className="size-8" aria-label={t('ui.quickView')} title={t('ui.quickView')} onClick={() => setPeek(c)}>
              <Eye />
            </Button>
          )}
          empty={<EmptyState pictogram="people" title={t('cp.none')}>{q ? t('ui.emptyFiltered') : undefined}</EmptyState>}
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

/** Excel export of exactly the counterparties the search shows. */
async function exportCounterpartiesXlsx(rows: Party[], stats: Map<string, PartyStats>, countryName: (code: string | null) => string, t: TFunction) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const header = [t('fields.name'), t('cp.type'), t('fields.country'), t('common.active'), t('cp.submissions'), t('cp.bound'), t('cp.boundUsd'), t('cp.contacts')]
    .map((value) => ({ value, fontWeight: 'bold' as const, backgroundColor: '#E8EDF5' }))
  const body = rows.map((c) => {
    const s = stats.get(c.id)
    const people = contactsOf(c.contacts).filter((x) => x.name || x.email || x.phone).map((x) => [x.name, x.email, x.phone].filter(Boolean).join(' · ')).join('; ')
    return [
      { type: String, value: c.name },
      { type: String, value: t(`counterpartyType.${c.type}`) },
      { type: String, value: c.country_code ? countryName(c.country_code) : '' },
      { type: String, value: c.active ? t('common.yes') : t('common.no') },
      { type: Number, value: s?.count ?? 0 },
      { type: Number, value: s?.bound ?? 0 },
      { type: Number, value: Math.round((s?.boundUsd ?? 0) * 100) / 100, format: '#,##0.00' },
      { type: String, value: people },
    ]
  })
  await writeXlsxFile([header, ...body], {
    sheet: t('pages.counterparties.title').slice(0, 31),
    columns: [{ width: 36 }, { width: 10 }, { width: 18 }, { width: 8 }, { width: 12 }, { width: 10 }, { width: 16 }, { width: 60 }],
    stickyRowsCount: 1,
  }).toFile(`counterparties-${isoDate()}.xlsx`)
}
