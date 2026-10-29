import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Eye, FileSpreadsheet, SlidersHorizontal, FilterX, Loader2, Pencil, Plus, Search, AlertTriangle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/data/DataTable'
import { highlight } from '@/components/data/highlight'
import { EmptyState } from '@/components/EmptyState'
import { Amount } from '@/components/Amount'
import { Badge } from '@/components/ui/badge'
import { usePref } from '@/lib/prefs'
import { StatusBadge } from '@/components/StatusBadge'
import { useAuth } from '@/auth/AuthProvider'
import { can } from '@/lib/roles'
import { STATUSES, STATUS_SOLID, STATUS_STYLES } from '@/lib/status'
import { formatAmount, formatDate, formatPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/errors'
import { useCounterparties, useCurrencies, useLinesOfBusiness, useLocalName, useUsers, userName } from '@/hooks/useReference'
import { activeFilterCount, EMPTY_FILTERS, filtersToParams, parseFilters, type SortKey, type SubmissionFilters } from './filters'
import { MAX_ROWS, useSubmissionsList, type SubmissionRow } from './api'
import { ExportButton, exportSubmissionsXlsx } from './ExportButton'
import { SubmissionQuickView } from './SubmissionQuickView'

export function SubmissionsPage() {
  const { t } = useTranslation()
  const { role } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(params), [params])
  const [search, setSearch] = useState(filters.q)

  // Merge into the browser's current URL, not this render's copy: React Router applies URL updates in a
  // transition, so a debounced search could otherwise resurrect a filter that was just removed.
  const setFilters = (patch: Partial<SubmissionFilters>) =>
    setParams(filtersToParams({ ...parseFilters(new URLSearchParams(window.location.search)), ...patch }), { replace: true })

  // Debounced search box → URL
  useEffect(() => {
    if (search === filters.q) return
    const h = setTimeout(() => setFilters({ q: search }), 300)
    return () => clearTimeout(h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])
  useEffect(() => setSearch(filters.q), [filters.q])

  const { data, isLoading, isFetching, error } = useSubmissionsList(filters)
  const counterparties = useCounterparties()
  const lobs = useLinesOfBusiness()
  const currencies = useCurrencies()
  const users = useUsers()
  const localName = useLocalName()

  const mgas = counterparties.data?.filter((c) => c.type === 'mga') ?? []
  const brokers = counterparties.data?.filter((c) => c.type === 'broker') ?? []
  const underwriters = users.data?.filter((u) => u.role === 'underwriter' || u.role === 'admin') ?? []

  const rows = data?.rows ?? []
  const totalUsd = rows.reduce((s, r) => s + (r.our_gross_premium_usd ?? 0), 0)
  const filterCount = activeFilterCount(filters)

  const [peek, setPeek] = useState<SubmissionRow | null>(null)
  const [moreOpen, setMoreOpen] = usePref('register.moreFilters', false)
  const moreCount = [filters.mga, filters.broker, filters.lob, filters.uw, filters.ccy, filters.from, filters.to].filter(Boolean).length
  const showMore = moreOpen || moreCount > 0
  const clearFilters = () => {
    setSearch('')
    setParams(filtersToParams({ ...EMPTY_FILTERS, sort: filters.sort, dir: filters.dir }), { replace: true })
  }

  const columns: Column<SubmissionRow>[] = [
    {
      id: 'ref_no',
      header: t('fields.refNo'),
      sortKey: 'ref_no',
      cell: (r, c) => (
        <Link to={`/submissions/${r.id}`} className="font-medium text-link hover:underline num" onClick={(e) => e.stopPropagation()}>
          {c.hl(r.ref_no)}
        </Link>
      ),
    },
    { id: 'received_at', header: t('fields.receivedAt'), sortKey: 'received_at', cell: (r) => formatDate(r.received_at) },
    {
      id: 'insured_name',
      header: t('fields.insuredName'),
      sortKey: 'insured_name',
      className: 'max-w-64 truncate',
      cell: (r, c) => <span title={r.insured_name ?? ''}>{c.hl(r.insured_name)}</span>,
    },
    { id: 'mga_name', header: t('fields.mga'), sortKey: 'mga_name', className: 'max-w-48 truncate', cell: (r, c) => c.hl(r.mga_name) },
    { id: 'broker_name', header: t('fields.broker'), sortKey: 'broker_name', className: 'max-w-48 truncate text-muted-foreground', cell: (r, c) => (r.broker_name ? c.hl(r.broker_name) : '—') },
    { id: 'lob_name', header: t('fields.lob'), sortKey: 'lob_name', className: 'max-w-40 truncate', cell: (r) => r.lob_name ?? '—' },
    {
      id: 'status',
      header: t('fields.status'),
      sortKey: 'status',
      cell: (r) => (
        <div className="flex items-center gap-1">
          <StatusBadge status={r.status} />
          {r.offer_expired && <span title={t('sub.offerExpired')}><AlertTriangle className="size-4 text-warning-600" /></span>}
        </div>
      ),
    },
    { id: 'currency', header: t('fields.currencyShort'), sortKey: 'currency', cell: (r) => r.currency },
    { id: 'gross_premium_100', header: t('fields.grossPremium100'), sortKey: 'gross_premium_100', align: 'right', cell: (r) => formatAmount(r.gross_premium_100) },
    { id: 'share_pct', header: t('fields.share'), sortKey: 'share_pct', align: 'right', cell: (r) => (r.share_pct === null ? '—' : formatPct(r.share_pct)) },
    { id: 'our_gross_premium', header: t('fields.ourGrossPremium'), sortKey: 'our_gross_premium', align: 'right', cell: (r) => formatAmount(r.our_gross_premium) },
    { id: 'our_gross_premium_usd', header: t('fields.ourGrossUsd'), sortKey: 'our_gross_premium_usd', align: 'right', cell: (r) => formatAmount(r.our_gross_premium_usd) },
    { id: 'underwriter_name', header: t('fields.underwriter'), sortKey: 'underwriter_name', className: 'max-w-40 truncate', cell: (r) => r.underwriter_name ?? '—' },
    {
      id: 'next_follow_up_at',
      header: t('fields.nextFollowUp'),
      sortKey: 'next_follow_up_at',
      cell: (r) =>
        r.next_follow_up_at ? (
          <span className={cn('inline-flex items-center gap-1', r.follow_up_overdue && 'font-medium text-destructive')}>
            {r.follow_up_overdue && <Clock className="size-4" />}
            {formatDate(r.next_follow_up_at)}
          </span>
        ) : '—',
    },
  ]

  const toggleStatus = (s: (typeof STATUSES)[number]) => {
    const current = parseFilters(new URLSearchParams(window.location.search)).status
    setFilters({ status: current.includes(s) ? current.filter((x) => x !== s) : [...current, s] })
  }

  const sortBy = (key: SortKey) =>
    setFilters(filters.sort === key ? { dir: filters.dir === 'asc' ? 'desc' : 'asc' } : { sort: key, dir: key === 'received_at' ? 'desc' : 'asc' })

  return (
    <>
      <PageHeader
        title={t('pages.submissions.title')}
        subtitle={t('pages.submissions.subtitle')}
        actions={
          <>
            <ExportButton filters={filters} disabled={!rows.length} />
            {can.editSubmissions(role) && (
              <Button asChild>
                <Link to="/submissions/new">
                  <Plus />
                  {t('sub.new')}
                </Link>
              </Button>
            )}
          </>
        }
      />

      {/* Filters */}
      <Card className="mb-4 gap-3 py-4">
        <div className="flex flex-wrap items-center gap-2 px-4">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('sub.searchPlaceholder')} className="pl-8" />
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => {
              const on = filters.status.includes(s)
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  aria-pressed={on}
                  className={cn(
                    'inline-flex h-8 items-center gap-2 rounded-md border px-3 text-caption font-medium transition-colors',
                    on ? STATUS_STYLES[s] : 'bg-background text-foreground hover:bg-muted',
                  )}
                >
                  <span className="size-2 rounded-full" style={{ background: STATUS_SOLID[s] }} />
                  {t(`status.${s}`)}
                </button>
              )
            })}
          </div>
          <Button variant="ghost" size="sm" className="ml-auto" aria-expanded={showMore} onClick={() => setMoreOpen(!showMore)}>
            <SlidersHorizontal />
            {t('ui.moreFilters')}
            {moreCount > 0 && <Badge tone="brand" className="num">{moreCount}</Badge>}
          </Button>
        </div>
        {showMore && (
          <div className="grid grid-cols-2 gap-2 px-4 md:grid-cols-4 xl:grid-cols-7">
            <NativeSelect value={filters.mga} onChange={(e) => setFilters({ mga: e.target.value })} aria-label={t('fields.mga')}>
              <option value="">{t('sub.allMgas')}</option>
              {mgas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
            <NativeSelect value={filters.broker} onChange={(e) => setFilters({ broker: e.target.value })} aria-label={t('fields.broker')}>
              <option value="">{t('sub.allBrokers')}</option>
              <option value="none">{t('sub.directNoBroker')}</option>
              {brokers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
            <NativeSelect value={filters.lob} onChange={(e) => setFilters({ lob: e.target.value })} aria-label={t('fields.lob')}>
              <option value="">{t('sub.allLobs')}</option>
              {lobs.data?.map((l) => <option key={l.id} value={l.id}>{localName(l)}</option>)}
            </NativeSelect>
            <NativeSelect value={filters.uw} onChange={(e) => setFilters({ uw: e.target.value })} aria-label={t('fields.underwriter')}>
              <option value="">{t('sub.allUnderwriters')}</option>
              {underwriters.map((u) => <option key={u.id} value={u.id}>{userName(u)}</option>)}
            </NativeSelect>
            <NativeSelect value={filters.ccy} onChange={(e) => setFilters({ ccy: e.target.value })} aria-label={t('fields.currency')}>
              <option value="">{t('sub.allCurrencies')}</option>
              {currencies.data?.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </NativeSelect>
            <Input type="date" value={filters.from} onChange={(e) => setFilters({ from: e.target.value })} aria-label={t('sub.receivedFrom')} title={t('sub.receivedFrom')} />
            <Input type="date" value={filters.to} onChange={(e) => setFilters({ to: e.target.value })} aria-label={t('sub.receivedTo')} title={t('sub.receivedTo')} />
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 text-caption text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 whitespace-nowrap text-foreground">
              <input type="checkbox" checked={filters.overdue} onChange={(e) => setFilters({ overdue: e.target.checked })} />
              {t('sub.overdueOnly')}
            </label>
            <label className="flex items-center gap-2 whitespace-nowrap text-foreground">
              <input type="checkbox" checked={filters.expired} onChange={(e) => setFilters({ expired: e.target.checked })} />
              {t('sub.expiredOnly')}
            </label>
            {(filters.boundFrom || filters.boundTo) && (
              <span className="rounded bg-muted px-2 py-0.5">
                {t('sub.boundBetween', { from: filters.boundFrom ? formatDate(filters.boundFrom) : '…', to: filters.boundTo ? formatDate(filters.boundTo) : '…' })}
              </span>
            )}
            {(data?.count ?? 0) > MAX_ROWS && <span className="text-warning-600">{t('sub.tooMany', { max: MAX_ROWS })}</span>}
          </div>
          {filterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <FilterX />
              {t('sub.clearFilters')}
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="gap-0 py-0">
        {error ? (
          <p className="p-6 text-body text-destructive">{errorMessage(error)}</p>
        ) : (
          <DataTable
            id="submissions"
            columns={columns}
            rows={rows}
            getRowId={(r) => r.id!}
            loading={isLoading}
            hl={(text) => highlight(text, filters.q)}
            sort={{ key: filters.sort, dir: filters.dir }}
            onSort={(k) => sortBy(k as SortKey)}
            onRowClick={(r) => navigate(`/submissions/${r.id}`)}
            rowActions={(r) => (
              <>
                <Button variant="ghost" size="icon" className="size-8" aria-label={t('ui.quickView')} title={t('ui.quickView')} onClick={() => setPeek(r)}>
                  <Eye />
                </Button>
                {can.editSubmissions(role) && (
                  <Button variant="ghost" size="icon" className="size-8" aria-label={t('common.edit')} title={t('common.edit')} asChild>
                    <Link to={`/submissions/${r.id}/edit`}><Pencil /></Link>
                  </Button>
                )}
              </>
            )}
            bulkActions={(selected) => (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={async () => {
                  try {
                    await exportSubmissionsXlsx(selected, t)
                    toast.success(t('sub.exported', { count: selected.length }))
                  } catch (e) {
                    toast.error(errorMessage(e))
                  }
                }}
              >
                <FileSpreadsheet />
                {t('ui.exportSelected')}
              </Button>
            )}
            empty={
              <EmptyState
                pictogram="search"
                title={t('sub.noResults')}
                action={filterCount > 0 ? <Button variant="outline" size="sm" onClick={clearFilters}><FilterX />{t('sub.clearFilters')}</Button> : undefined}
              >
                {filterCount > 0 ? t('ui.emptyFiltered') : undefined}
              </EmptyState>
            }
            toolbar={
              <>
                <span className="num">{t('sub.resultCount', { count: data?.count ?? 0 })}</span>
                {isFetching && !isLoading && <Loader2 className="size-3.5 animate-spin" />}
                {rows.length > 0 && (
                  <span className="ml-auto">
                    {t('sub.totalOurGrossUsd')}: <Amount value={totalUsd} human className="font-semibold text-foreground" />
                  </span>
                )}
              </>
            }
          />
        )}
      </Card>
      <SubmissionQuickView row={peek} onClose={() => setPeek(null)} />
    </>
  )
}
