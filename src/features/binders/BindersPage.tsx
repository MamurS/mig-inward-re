import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { FileSpreadsheet, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/data/DataTable'
import { highlight } from '@/components/data/highlight'
import { EmptyState } from '@/components/EmptyState'
import { useAuth } from '@/auth/AuthProvider'
import { useRefNames } from '@/hooks/useReference'
import { can } from '@/lib/roles'
import { errorMessage } from '@/lib/errors'
import { fitWidth, formatAmount, formatDate, formatPct, isoDate } from '@/lib/format'
import { textWords } from '@/features/search/query'
import { BINDERS_PAGE } from '@/features/search/pages'
import { useListSearch } from '@/features/search/useSearch'
import { SearchChips } from '@/features/search/SearchChips'
import { MAX_BINDERS, useBinders, type BinderRow } from './api'
import { BinderStatusBadge, CapacityBar } from './BinderBadges'
import { BinderDialog } from './BinderDialog'

/** Binders register: every MGA authority, its terms, capacity used and bordereaux still owed. */
export function BindersPage() {
  const { t } = useTranslation()
  const names = useRefNames()
  const { role } = useAuth()
  const navigate = useNavigate()
  const { q, parsed, filter, setQ } = useListSearch(BINDERS_PAGE)
  const { data, isLoading, isFetching } = useBinders(filter, parsed !== null)
  const [creating, setCreating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const rows = data?.rows ?? []
  const words = parsed ? textWords(parsed) : []

  const columns: Column<BinderRow>[] = [
    { id: 'ref', header: t('binder.ref'), cell: (r, c) => <span className="font-medium whitespace-nowrap text-link num" data-ref>{c.hl(r.binder_ref)}</span> },
    {
      id: 'mga',
      header: t('fields.mga'),
      className: 'max-w-64',
      cell: (r, c) => (
        <span className="block min-w-0">
          <span className="block truncate" title={r.mga_name ?? ''}>{c.hl(r.mga_name)}</span>
          {r.submission_ref && <span className="block text-caption text-muted-foreground num">{c.hl(r.submission_ref)}</span>}
        </span>
      ),
    },
    { id: 'status', header: t('fields.status'), cell: (r) => <BinderStatusBadge status={r.status} /> },
    { id: 'period', header: t('binder.period'), cell: (r) => <span className="whitespace-nowrap">{formatDate(r.period_from)} – {formatDate(r.period_to)}</span> },
    // the codes (shortest of all); the names in the UI language in the tooltip
    { id: 'lobs', header: t('binder.lobs'), cell: (r) => (r.lob_codes ? <span title={r.lob_codes.split(', ').map((c) => names.lobByCode(c, c)).join('\n')}>{r.lob_codes}</span> : '—') },
    { id: 'share', header: t('binder.ourShare'), align: 'right', cell: (r) => formatPct(r.our_share_pct) },
    { id: 'currency', header: t('fields.currencyShort'), cell: (r) => r.currency },
    { id: 'aggregate', header: t('binder.aggregateLimit'), align: 'right', cell: (r) => (r.aggregate_limit === null ? '—' : formatAmount(r.aggregate_limit)) },
    { id: 'capacity', header: t('binder.capacityPct'), cell: (r) => <CapacityBar pct={r.capacity_pct} /> },
    {
      id: 'bordereaux',
      header: t('binder.bordereauxOwed'),
      cell: (r) =>
        (r.missing_count ?? 0) + (r.late_count ?? 0) === 0 ? (
          <span className="text-muted-foreground">{t('binder.allIn')}</span>
        ) : (
          <span className="inline-flex flex-wrap gap-1">
            {(r.missing_count ?? 0) > 0 && <Badge tone="danger">{t('binder.missingN', { count: r.missing_count ?? 0 })}</Badge>}
            {(r.late_count ?? 0) > 0 && <Badge tone="warning">{t('binder.lateN', { count: r.late_count ?? 0 })}</Badge>}
          </span>
        ),
    },
    { id: 'last', header: t('binder.lastReceived'), defaultHidden: true, cell: (r) => formatDate(r.last_received) },
    { id: 'uw', header: t('fields.underwriter'), defaultHidden: true, cell: (r) => r.underwriter_name ?? '—' },
    { id: 'commission', header: t('fields.commissionPct'), defaultHidden: true, align: 'right', cell: (r) => formatPct(r.commission_pct) },
    { id: 'limit', header: t('binder.limitPerRisk'), defaultHidden: true, align: 'right', cell: (r) => (r.limit_per_risk === null ? '—' : formatAmount(r.limit_per_risk)) },
  ]

  return (
    <>
      <PageHeader
        title={t('pages.binders.title')}
        subtitle={t('pages.binders.subtitle')}
        actions={
          <>
            <Button
              variant="outline"
              disabled={!rows.length || exporting}
              onClick={async () => {
                setExporting(true)
                try {
                  await exportBindersXlsx(rows, t)
                  toast.success(t('binder.exported', { count: rows.length }))
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
            {can.editSubmissions(role) && (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                {t('binder.new')}
              </Button>
            )}
          </>
        }
      />

      {parsed && (
        <SearchChips
          query={parsed}
          scope={BINDERS_PAGE.scope}
          onChange={setQ}
          count={
            <span className="inline-flex flex-wrap items-center gap-x-3">
              <span>{isLoading ? t('common.loading') : t('binder.count', { count: data?.count ?? 0 })}</span>
              {isFetching && !isLoading && <Loader2 className="size-3.5 animate-spin" />}
              {(data?.count ?? 0) > MAX_BINDERS && <span className="text-warning-600">{t('sub.tooMany', { max: MAX_BINDERS })}</span>}
            </span>
          }
        />
      )}

      <Card className="gap-0 py-0">
        <DataTable
          id="binders"
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id!}
          loading={isLoading}
          hl={(text) => highlight(text, words)}
          onRowClick={(r) => navigate(`/binders/${r.id}`)}
          empty={
            <EmptyState pictogram={q ? 'search' : 'inbox'} title={q ? t('search.noMatch') : t('binder.none')}>
              {q ? t('ui.emptyFiltered') : can.editSubmissions(role) ? t('binder.noneHint') : undefined}
            </EmptyState>
          }
        />
      </Card>

      <BinderDialog open={creating} onClose={() => setCreating(false)} onSaved={(id) => navigate(`/binders/${id}`)} />
    </>
  )
}

/** Excel export of exactly the binders shown. */
async function exportBindersXlsx(rows: BinderRow[], t: TFunction) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const head = [
    t('binder.ref'), t('fields.mga'), t('fields.broker'), t('fields.status'), t('binder.periodFrom'), t('binder.periodTo'), t('binder.lobs'), t('binder.territories'),
    t('fields.currency'), t('binder.ourShare'), t('fields.commissionPct'), t('fields.brokeragePct'), t('binder.limitPerRisk'), t('binder.aggregateLimit'),
    t('binder.capacityUsed'), t('binder.capacityPct'), t('binder.missing'), t('binder.late'), t('binder.lastReceived'), t('fields.underwriter'), t('binder.submission'),
  ].map((value) => ({ value, fontWeight: 'bold' as const, backgroundColor: '#E8EDF5' }))
  const money = (v: number | null) => (v === null ? null : { type: Number, value: v, format: '#,##0.00' })
  const pct = (v: number | null) => (v === null ? null : { type: Number, value: v, format: '0.######' })
  const date = (v: string | null) => ({ type: Date, value: v ? new Date(`${v}T00:00:00Z`) : null, format: 'dd.mm.yyyy' })
  const body = rows.map((r) => [
    { type: String, value: r.binder_ref ?? '' },
    { type: String, value: r.mga_name ?? '' },
    { type: String, value: r.broker_name ?? '' },
    { type: String, value: r.status ? t(`binder.status.${r.status}`) : '' },
    date(r.period_from),
    date(r.period_to),
    { type: String, value: r.lob_codes ?? '' },
    { type: String, value: (r.territories ?? []).join(', ') },
    { type: String, value: r.currency ?? '' },
    pct(r.our_share_pct),
    pct(r.commission_pct),
    pct(r.brokerage_pct),
    money(r.limit_per_risk),
    money(r.aggregate_limit),
    money(r.capacity_used_100),
    pct(r.capacity_pct),
    { type: Number, value: r.missing_count ?? 0 },
    { type: Number, value: r.late_count ?? 0 },
    date(r.last_received),
    { type: String, value: r.underwriter_name ?? '' },
    { type: String, value: r.submission_ref ?? '' },
  ])
  await writeXlsxFile([head, ...body] as never, {
    sheet: t('pages.binders.title').slice(0, 31),
    columns: [
      { width: fitWidth(rows.map((r) => r.binder_ref)) }, { width: fitWidth(rows.map((r) => r.mga_name), 20) }, { width: fitWidth(rows.map((r) => r.broker_name), 16) },
      { width: 12 }, { width: 12 }, { width: 12 }, { width: fitWidth(rows.map((r) => r.lob_codes), 8) }, { width: 12 }, { width: 8 }, { width: 10 }, { width: 10 }, { width: 10 },
      { width: 16 }, { width: 16 }, { width: 16 }, { width: 10 }, { width: 8 }, { width: 8 }, { width: 12 }, { width: 20 }, { width: fitWidth(rows.map((r) => r.submission_ref)) },
    ],
    stickyRowsCount: 1,
  }).toFile(`binders-${isoDate()}.xlsx`)
}
