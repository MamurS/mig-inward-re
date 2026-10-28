import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, ChevronsUpDown, FilterX, Loader2, Plus, Search, AlertTriangle, Clock } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/StatusBadge'
import { useAuth } from '@/auth/AuthProvider'
import { can } from '@/lib/roles'
import { STATUSES, STATUS_STYLES } from '@/lib/status'
import { formatAmount, formatDate, formatPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/errors'
import { useCounterparties, useCurrencies, useLinesOfBusiness, useLocalName, useUsers, userName } from '@/hooks/useReference'
import { activeFilterCount, EMPTY_FILTERS, filtersToParams, parseFilters, type SortKey, type SubmissionFilters } from './filters'
import { MAX_ROWS, useSubmissionsList } from './api'
import { ExportButton } from './ExportButton'

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

  const toggleStatus = (s: (typeof STATUSES)[number]) => {
    const current = parseFilters(new URLSearchParams(window.location.search)).status
    setFilters({ status: current.includes(s) ? current.filter((x) => x !== s) : [...current, s] })
  }

  const sortBy = (key: SortKey) =>
    setFilters(filters.sort === key ? { dir: filters.dir === 'asc' ? 'desc' : 'asc' } : { sort: key, dir: key === 'received_at' ? 'desc' : 'asc' })

  const SortHead = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button type="button" onClick={() => sortBy(k)} className={cn('inline-flex items-center gap-1 hover:text-foreground', className?.includes('text-right') && 'flex-row-reverse')}>
        {children}
        {filters.sort === k ? filters.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-40" />}
      </button>
    </TableHead>
  )

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
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => {
              const on = filters.status.includes(s)
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  className={cn(
                    'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                    on ? STATUS_STYLES[s] + ' ring-1 ring-current/30' : 'bg-background text-muted-foreground hover:bg-muted',
                  )}
                >
                  {t(`status.${s}`)}
                </button>
              )
            })}
          </div>
        </div>
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
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-1.5 whitespace-nowrap text-foreground">
              <input type="checkbox" checked={filters.overdue} onChange={(e) => setFilters({ overdue: e.target.checked })} />
              {t('sub.overdueOnly')}
            </label>
            <label className="flex items-center gap-1.5 whitespace-nowrap text-foreground">
              <input type="checkbox" checked={filters.expired} onChange={(e) => setFilters({ expired: e.target.checked })} />
              {t('sub.expiredOnly')}
            </label>
            {isFetching && <Loader2 className="size-3.5 animate-spin" />}
            {t('sub.resultCount', { count: data?.count ?? 0 })}
            {(filters.boundFrom || filters.boundTo) && (
              <span className="rounded bg-muted px-1.5 py-0.5">
                {t('sub.boundBetween', { from: filters.boundFrom ? formatDate(filters.boundFrom) : '…', to: filters.boundTo ? formatDate(filters.boundTo) : '…' })}
              </span>
            )}
            {(data?.count ?? 0) > MAX_ROWS && <span className="text-amber-700">{t('sub.tooMany', { max: MAX_ROWS })}</span>}
          </div>
          {filterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setParams(filtersToParams({ ...EMPTY_FILTERS, sort: filters.sort, dir: filters.dir }), { replace: true }) }}>
              <FilterX />
              {t('sub.clearFilters')}
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="gap-0 py-0">
        {error ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(error)}</p>
        ) : isLoading ? (
          <div className="flex justify-center p-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">{t('sub.noResults')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortHead k="ref_no">{t('fields.refNo')}</SortHead>
                <SortHead k="received_at">{t('fields.receivedAt')}</SortHead>
                <SortHead k="insured_name">{t('fields.insuredName')}</SortHead>
                <SortHead k="mga_name">{t('fields.mga')}</SortHead>
                <SortHead k="broker_name">{t('fields.broker')}</SortHead>
                <SortHead k="lob_name">{t('fields.lob')}</SortHead>
                <SortHead k="status">{t('fields.status')}</SortHead>
                <SortHead k="currency">{t('fields.currencyShort')}</SortHead>
                <SortHead k="gross_premium_100" className="text-right">{t('fields.grossPremium100')}</SortHead>
                <SortHead k="share_pct" className="text-right">{t('fields.share')}</SortHead>
                <SortHead k="our_gross_premium" className="text-right">{t('fields.ourGrossPremium')}</SortHead>
                <SortHead k="our_gross_premium_usd" className="text-right">{t('fields.ourGrossUsd')}</SortHead>
                <SortHead k="underwriter_name">{t('fields.underwriter')}</SortHead>
                <SortHead k="next_follow_up_at">{t('fields.nextFollowUp')}</SortHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/submissions/${r.id}`)}>
                  <TableCell className="font-medium">
                    <Link to={`/submissions/${r.id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                      {r.ref_no}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(r.received_at)}</TableCell>
                  <TableCell className="max-w-64 truncate" title={r.insured_name ?? ''}>{r.insured_name}</TableCell>
                  <TableCell className="max-w-48 truncate">{r.mga_name}</TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">{r.broker_name ?? '—'}</TableCell>
                  <TableCell className="max-w-40 truncate">{r.lob_name ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <StatusBadge status={r.status} />
                      {r.offer_expired && <span title={t('sub.offerExpired')}><AlertTriangle className="size-3.5 text-amber-600" /></span>}
                    </div>
                  </TableCell>
                  <TableCell>{r.currency}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatAmount(r.gross_premium_100)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.share_pct === null ? '—' : formatPct(r.share_pct)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatAmount(r.our_gross_premium)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatAmount(r.our_gross_premium_usd)}</TableCell>
                  <TableCell className="max-w-40 truncate">{r.underwriter_name ?? '—'}</TableCell>
                  <TableCell>
                    {r.next_follow_up_at ? (
                      <span className={cn('inline-flex items-center gap-1', r.follow_up_overdue && 'font-medium text-destructive')}>
                        {r.follow_up_overdue && <Clock className="size-3.5" />}
                        {formatDate(r.next_follow_up_at)}
                      </span>
                    ) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <tfoot>
              <TableRow className="bg-muted/40 font-medium hover:bg-muted/40">
                <TableCell colSpan={11} className="text-right text-xs text-muted-foreground">{t('sub.totalOurGrossUsd')}</TableCell>
                <TableCell className="text-right tabular-nums">{formatAmount(totalUsd)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </tfoot>
          </Table>
        )}
      </Card>
    </>
  )
}
