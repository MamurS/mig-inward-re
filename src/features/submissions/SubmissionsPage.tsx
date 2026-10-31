import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Eye, FileSpreadsheet, FilterX, Info, Loader2, Pencil, Plus, AlertTriangle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/data/DataTable'
import { highlight } from '@/components/data/highlight'
import { NameCell } from '@/components/data/NameCell'
import { EmptyState } from '@/components/EmptyState'
import { Amount } from '@/components/Amount'
import { StatusBadge } from '@/components/StatusBadge'
import { Tooltip } from '@/components/ui/tooltip'
import { useAuth } from '@/auth/AuthProvider'
import { useRefNames } from '@/hooks/useReference'
import { can } from '@/lib/roles'
import { formatAmount, formatDate, formatPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/errors'
import { hasLegacyFilters, legacyToQuery, parseRegister, registerParams, type RegisterState, type SortKey } from './filters'
import { useParsedQuery } from '@/features/search/useSearch'
import { SUBMISSIONS_PAGE } from '@/features/search/pages'
import { textWords } from '@/features/search/query'
import { SearchChips } from '@/features/search/SearchChips'
import { FOCUS_SEARCH } from '@/features/search/SearchBar'
import { MAX_ROWS, useSubmissionsList, type RegisterQuery, type SubmissionRow } from './api'
import { ExportButton, exportSubmissionsXlsx } from './ExportButton'
import { SubmissionQuickView } from './SubmissionQuickView'
import { registerTotals } from './totals'

export function SubmissionsPage() {
  const { t } = useTranslation()
  const { role } = useAuth()
  const navigate = useNavigate()
  const names = useRefNames()
  const [params, setParams] = useSearchParams()
  const state = useMemo(() => parseRegister(params), [params])
  const { ctx, parsed, filter } = useParsedQuery(state.q, SUBMISSIONS_PAGE)

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
  // bound business only; offered / no response apart as «pending»; the rest nowhere
  const totals = registerTotals(rows)
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
    {
      id: 'insured_name',
      header: t('fields.insuredName'),
      sortKey: 'insured_name',
      className: 'max-w-32 min-[1440px]:max-w-64', // 128 px at 1280: room for the line of business beside it
      cell: (r, c) => <NameCell name={c.hl(r.insured_name)} sub={r.mga_name && c.hl(r.mga_name)} title={[r.insured_name, r.mga_name].filter(Boolean).join('\n')} />,
    },
    // the short name of the line (the full one in the tooltip); a long one («Кредит и поручительство»)
    // takes a second line, as the insured does, rather than an ellipsis
    {
      id: 'lob_name',
      header: t('fields.lobShort'),
      sortKey: 'lob_name',
      // large text: a little wider; a name longer than the column still breaks rather than being cut
      className: 'max-w-32 pr-2 min-[1440px]:max-w-40 [[data-text-size=large]_&]:max-w-40 min-[1440px]:[[data-text-size=large]_&]:max-w-48',
      cell: (r) => <span data-lob-cell className="line-clamp-2 leading-tight break-words whitespace-normal" title={names.lob(r.lob_id, r.lob_name) ?? ''}>{names.lobShort(r.lob_id, r.lob_name) ?? '—'}</span>,
    },
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
    {
      // written share; once bound, «written / signed»
      id: 'share_pct',
      header: t('fields.writtenSignedShare'),
      sortKey: 'share_pct',
      align: 'right',
      cell: (r) =>
        r.written_share_pct === null ? '—'
        : r.status === 'bound' && r.signed_share_pct !== null ? `${formatPct(r.written_share_pct)} / ${formatPct(r.signed_share_pct)}`
        : formatPct(r.written_share_pct),
    },
    { id: 'our_gross_premium_usd', header: t('fields.ourGrossUsd'), sortKey: 'our_gross_premium_usd', align: 'right', cell: (r) => formatAmount(r.our_gross_premium_usd) },
    { id: 'received_at', header: t('fields.receivedAt'), sortKey: 'received_at', cell: (r) => formatDate(r.received_at) },
    // available in «Columns», hidden by default
    { id: 'mga_name', header: t('fields.mga'), sortKey: 'mga_name', defaultHidden: true, className: 'max-w-48 truncate', cell: (r, c) => c.hl(r.mga_name) },
    { id: 'broker_name', header: t('fields.broker'), sortKey: 'broker_name', defaultHidden: true, className: 'max-w-48 truncate text-muted-foreground', cell: (r, c) => (r.broker_name ? c.hl(r.broker_name) : '—') },
    { id: 'underwriter_name', header: t('fields.underwriter'), sortKey: 'underwriter_name', defaultHidden: true, className: 'max-w-40 truncate', cell: (r) => r.underwriter_name ?? '—' },
    {
      id: 'period',
      header: t('fields.period'),
      defaultHidden: true,
      cell: (r) => (r.period_from || r.period_to ? `${formatDate(r.period_from)} – ${formatDate(r.period_to)}` : '—'),
    },
    { id: 'currency', header: t('fields.currencyShort'), sortKey: 'currency', defaultHidden: true, cell: (r) => r.currency },
    { id: 'gross_premium_100', header: t('fields.grossPremium100'), sortKey: 'gross_premium_100', defaultHidden: true, align: 'right', cell: (r) => formatAmount(r.gross_premium_100) },
    { id: 'our_gross_premium', header: t('fields.ourGrossPremium'), sortKey: 'our_gross_premium', defaultHidden: true, align: 'right', cell: (r) => formatAmount(r.our_gross_premium) },
    {
      id: 'next_follow_up_at',
      header: t('fields.nextFollowUp'),
      sortKey: 'next_follow_up_at',
      defaultHidden: true,
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
          scope={SUBMISSIONS_PAGE.scope}
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
            id="submissions.v2"
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
                    await exportSubmissionsXlsx(selected, t, (r) => names.lob(r.lob_id, r.lob_name))
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
                  <span className="ml-auto inline-flex flex-wrap items-center gap-x-3 gap-y-1" data-register-totals>
                    <span data-total-bound>
                      {t('sub.totalBoundUsd')}: <Amount value={totals.boundUsd} human className="font-semibold text-foreground" />
                    </span>
                    <span data-total-pending>
                      {t('sub.totalPending')}: <Amount value={totals.pendingUsd} human className="text-foreground" />
                    </span>
                    <Tooltip content={t('sub.totalsHint')}>
                      <button type="button" className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-slate-100" aria-label={t('sub.totalsHint')}>
                        <Info className="size-4" aria-hidden />
                      </button>
                    </Tooltip>
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
