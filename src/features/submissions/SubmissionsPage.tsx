import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Eye, FileSpreadsheet, FilterX, Loader2, Pencil, Plus, AlertTriangle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/data/DataTable'
import { highlight } from '@/components/data/highlight'
import { EmptyState } from '@/components/EmptyState'
import { Amount } from '@/components/Amount'
import { StatusBadge } from '@/components/StatusBadge'
import { useAuth } from '@/auth/AuthProvider'
import { can } from '@/lib/roles'
import { formatAmount, formatDate, formatPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/errors'
import { hasLegacyFilters, legacyToQuery, parseRegister, registerParams, type RegisterState, type SortKey } from './filters'
import { useParsedQuery } from '@/features/search/useSearch'
import { textWords } from '@/features/search/query'
import { SearchChips } from '@/features/search/SearchChips'
import { FOCUS_SEARCH } from '@/features/search/SearchBar'
import { MAX_ROWS, useSubmissionsList, type RegisterQuery, type SubmissionRow } from './api'
import { ExportButton, exportSubmissionsXlsx } from './ExportButton'
import { SubmissionQuickView } from './SubmissionQuickView'

export function SubmissionsPage() {
  const { t } = useTranslation()
  const { role } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const state = useMemo(() => parseRegister(params), [params])
  const { ctx, parsed, filter } = useParsedQuery(state.q)

  // Merge into the browser's current URL, not this render's copy (the search bar writes it too).
  const setState = (patch: Partial<RegisterState>, push = false) =>
    setParams(registerParams({ ...parseRegister(new URLSearchParams(window.location.search)), ...patch }), { replace: !push })

  // Old bookmarks (?status=…&mga=…&overdue=1) become the same search in the query language
  useEffect(() => {
    if (ctx && hasLegacyFilters(params)) setState({ q: legacyToQuery(params, ctx) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, params])

  const query: RegisterQuery = useMemo(() => ({ filter, sort: state.sort, dir: state.dir }), [filter, state.sort, state.dir])
  const { data, isLoading, isFetching, error } = useSubmissionsList(query, parsed !== null && !hasLegacyFilters(params))
  const words = useMemo(() => (parsed ? textWords(parsed) : []), [parsed])

  const rows = data?.rows ?? []
  const totalUsd = rows.reduce((s, r) => s + (r.our_gross_premium_usd ?? 0), 0)
  const searching = state.q.trim().length > 0

  const [peek, setPeek] = useState<SubmissionRow | null>(null)
  const clearSearch = () => setState({ q: '' }, true)

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

  const sortBy = (key: SortKey) =>
    setState(state.sort === key ? { dir: state.dir === 'asc' ? 'desc' : 'asc' } : { sort: key, dir: key === 'received_at' ? 'desc' : 'asc' })

  return (
    <>
      <PageHeader
        title={t('pages.submissions.title')}
        subtitle={t('pages.submissions.subtitle')}
        actions={
          <>
            <ExportButton query={query} disabled={!rows.length} />
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

      {/* How the search bar's query was understood, and how many rows it finds */}
      {parsed && (
        <SearchChips
          query={parsed}
          onChange={(q) => setState({ q }, true)}
          count={
            <span className="inline-flex items-center gap-2">
              {isLoading ? t('common.loading') : t('search.count', { count: data?.count ?? 0 })}
              {isFetching && !isLoading && <Loader2 className="size-3.5 animate-spin" />}
              {(data?.count ?? 0) > MAX_ROWS && <span className="text-warning-600">{t('sub.tooMany', { max: MAX_ROWS })}</span>}
            </span>
          }
        />
      )}

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
            hl={(text) => highlight(text, words)}
            sort={{ key: state.sort, dir: state.dir }}
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
                action={
                  searching ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button variant="outline" size="sm" onClick={clearSearch}><FilterX />{t('search.clearSearch')}</Button>
                      <Button variant="ghost" size="sm" onClick={() => window.dispatchEvent(new Event(FOCUS_SEARCH))}>{t('search.editSearch')}</Button>
                    </div>
                  ) : undefined
                }
              >
                {searching ? t('ui.emptyFiltered') : undefined}
              </EmptyState>
            }
            toolbar={
              <>
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
