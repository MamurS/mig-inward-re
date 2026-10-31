import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { CalendarCheck, FileSpreadsheet, Loader2, Undo2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/data/DataTable'
import { highlight } from '@/components/data/highlight'
import { NameCell } from '@/components/data/NameCell'
import { EmptyState } from '@/components/EmptyState'
import { Amount } from '@/components/Amount'
import { AgingBadge, type AgingBucket } from '@/components/AgingBadge'
import { AgeingBreakdown } from '@/components/AgeingBar'
import { KpiCard } from '@/components/KpiCard'
import { errorMessage } from '@/lib/errors'
import { fitWidth, formatAmount, formatDate, isoDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { textWords, type ParsedQuery } from '@/features/search/query'
import { hasFlag } from '@/features/search/client'
import { pageLink, RECEIVABLES_PAGE } from '@/features/search/pages'
import { AGING_BUCKETS } from '@/features/search/scopes'
import { useListSearch } from '@/features/search/useSearch'
import { SearchChips } from '@/features/search/SearchChips'
import { MAX_RECEIVABLES, usePayableTotal, useReceivables, type InstallmentRow } from './api'
import { ageing } from './summary'

/** Which rows a query looks at: payable asks for return premium; a status for any receivable; else what is still owed. */
export function receivablesBase(q: ParsedQuery | null): 'open' | 'receivable' | null {
  if (hasFlag(q, 'payable')) return null
  const asksStatus = Boolean(q?.groups.some((g) => g.terms.some((t) => t.kind === 'field' && t.field === 'status' && !t.neg)))
  return asksStatus ? 'receivable' : 'open'
}

/**
 * Receivables: every premium installment MGAs still owe, oldest due first,
 * with the ageing summary in USD over exactly the rows the search shows.
 * Return premium (what we owe back) stays apart: `payable` shows it.
 */
export function ReceivablesPage() {
  const { t } = useTranslation()
  const { q, parsed, filter, setQ } = useListSearch(RECEIVABLES_PAGE)
  const base = receivablesBase(parsed)
  const { data, isLoading, isFetching } = useReceivables(filter, base, parsed !== null)
  const payable = usePayableTotal()
  const [exporting, setExporting] = useState(false)
  const rows = data?.rows ?? []
  const words = parsed ? textWords(parsed) : []
  const payableView = base === null
  const summary = ageing(rows)
  const tile = (bucket: string) => pageLink(RECEIVABLES_PAGE, `bucket:${bucket}`)
  // the bucket the search narrows to (bucket:61-90), highlighted in the ageing card
  const bucketTerm = parsed?.groups.length === 1 ? parsed.groups[0].terms.find((x) => x.kind === 'field' && x.field === 'bucket' && !x.neg) : undefined
  const activeBucket = bucketTerm?.kind === 'field' && bucketTerm.values.length === 1 ? (bucketTerm.values[0] as AgingBucket) : null

  const columns: Column<InstallmentRow>[] = [
    {
      id: 'ref_no',
      header: t('fields.refNo'),
      cell: (r, c) => (
        // the installment number on its own grey line: demo refs (DEMO-SUB-…) are long
        <span className="block">
          <Link to={`/submissions/${r.submission_id}`} className="block font-medium text-link num hover:underline" onClick={(e) => e.stopPropagation()}>
            {c.hl(r.ref_no)}
          </Link>
          <span className="block text-caption text-muted-foreground num">{t('rcv.installmentNo', { no: r.installment_no })}</span>
        </span>
      ),
    },
    {
      id: 'insured',
      header: t('fields.insuredName'),
      className: 'max-w-48',
      cell: (r, c) => <NameCell name={c.hl(r.insured_name)} sub={r.mga_name && c.hl(r.mga_name)} title={[r.insured_name, r.mga_name].filter(Boolean).join('\n')} />,
    },
    { id: 'mga', header: t('fields.mga'), className: 'max-w-48 truncate', defaultHidden: true, cell: (r, c) => c.hl(r.mga_name) },
    { id: 'broker', header: t('fields.broker'), className: 'max-w-48 truncate', defaultHidden: true, cell: (r, c) => c.hl(r.broker_name) || '—' },
    { id: 'due_date', header: t('prem.dueDate'), cell: (r) => formatDate(r.due_date) },
    {
      id: 'overdue',
      header: t('rcv.daysOverdue'),
      // the header says «days overdue»: the badge carries the number only (the column stays narrow)
      cell: (r) => ((r.days_overdue ?? 0) > 0 ? <AgingBadge days={r.days_overdue!} label={t('ui.daysCount', { count: r.days_overdue! })} /> : <span className="text-muted-foreground">—</span>),
    },
    // the currency rides on the net amount (in «Columns» as its own column too), so the default set fits 1440 px with demo refs
    { id: 'currency', header: t('fields.currencyShort'), defaultHidden: true, cell: (r) => r.currency },
    {
      id: 'net',
      header: t('prem.net'),
      align: 'right',
      cell: (r) => (
        <span className="whitespace-nowrap">
          {formatAmount(r.net_amount)} <span className="text-caption text-muted-foreground">{r.currency}</span>
        </span>
      ),
    },
    // net − outstanding: in «Columns», so the default set fits a 1440 px screen
    { id: 'paid', header: t('prem.paid'), align: 'right', defaultHidden: true, cell: (r) => formatAmount(r.paid_amount) },
    payableView
      ? { id: 'payable', header: t('prem.payableToMga'), align: 'right', cell: (r) => <Badge tone="info" className="num">{formatAmount(r.payable_amount)}</Badge> }
      : { id: 'outstanding', header: t('rcv.outstanding'), align: 'right', cell: (r) => <span className="font-medium">{formatAmount(r.outstanding_amount)}</span> },
    {
      id: 'usd',
      header: t('rcv.usd'),
      align: 'right',
      cell: (r) => {
        const v = payableView ? r.payable_usd : r.outstanding_usd
        return v === null ? <span className="text-caption text-warning-700" title={t('rcv.noRate')}>{t('rcv.noRateShort')}</span> : formatAmount(v)
      },
    },
    { id: 'status', header: t('fields.status'), cell: (r) => <Badge tone={r.status === 'paid' ? 'success' : r.status === 'written_off' ? 'neutral' : r.status === 'partially_paid' ? 'warning' : 'info'}>{t(`prem.status.${r.status}`)}</Badge> },
    { id: 'uw', header: t('fields.underwriter'), defaultHidden: true, cell: (r) => r.underwriter_name ?? '—' },
  ]

  return (
    <>
      <PageHeader
        title={t('pages.receivables.title')}
        subtitle={t('pages.receivables.subtitle')}
        actions={
          <Button
            variant="outline"
            disabled={!rows.length || exporting}
            onClick={async () => {
              setExporting(true)
              try {
                await exportReceivablesXlsx(rows, t)
                toast.success(t('rcv.exported', { count: rows.length }))
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
        }
      />

      {/* Ageing over the rows shown (receivable only): three figures, then one card with the buckets; payable in its own tile */}
      <section aria-label={t('rcv.ageing')} className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5" data-ageing>
        <KpiCard icon={Wallet} label={t('rcv.totalOutstanding')} value={<Amount value={summary.total} human />} sub="USD" className="col-span-2 md:col-span-1" />
        <KpiCard icon={CalendarCheck} label={t('rcv.notDue')} value={<Amount value={summary.buckets.current} human />} sub="USD" />
        <KpiCard
          icon={Undo2}
          label={t('rcv.payableTile')}
          value={<Amount value={payable.data?.usd ?? 0} human />}
          sub={t('rcv.payableSub', { count: payable.data?.count ?? 0 })}
          to={pageLink(RECEIVABLES_PAGE, 'payable')}
          className={cn(payableView && 'ring-2 ring-ring/40')}
        />
        <Card className="col-span-2 gap-3 py-4 md:col-span-3 xl:col-span-2" data-ageing-card>
          <CardHeader className="px-5"><CardTitle className="text-small font-medium text-muted-foreground">{t('rcv.ageing')}</CardTitle></CardHeader>
          <CardContent className="px-3">
            <AgeingBreakdown
              active={activeBucket}
              items={AGING_BUCKETS.map((b) => ({
                bucket: b,
                label: t('rcv.bucketDays', { bucket: b }),
                weight: summary.buckets[b],
                value: <Amount value={summary.buckets[b]} currency="USD" human className={b === '90+' && summary.buckets[b] > 0 ? 'text-danger-700' : undefined} />,
                to: tile(b),
              }))}
            />
          </CardContent>
        </Card>
      </section>

      {parsed && (
        <SearchChips
          query={parsed}
          scope={RECEIVABLES_PAGE.scope}
          onChange={setQ}
          count={
            <span className="inline-flex flex-wrap items-center gap-x-3">
              <span>{isLoading ? t('common.loading') : t(payableView ? 'rcv.countPayable' : 'rcv.count', { count: data?.count ?? 0 })}</span>
              {summary.missingRate > 0 && <span className="text-warning-700">{t('rcv.missingRate', { count: summary.missingRate })}</span>}
              {isFetching && !isLoading && <Loader2 className="size-3.5 animate-spin" />}
              {(data?.count ?? 0) > MAX_RECEIVABLES && <span className="text-warning-600">{t('sub.tooMany', { max: MAX_RECEIVABLES })}</span>}
            </span>
          }
        />
      )}

      <Card className="gap-0 py-0">
        <DataTable
          id={payableView ? 'payables.v3' : 'receivables.v4'}
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id!}
          loading={isLoading}
          hl={(text) => highlight(text, words)}
          empty={
            <EmptyState pictogram={q ? 'search' : 'inbox'} title={q ? t('search.noMatch') : t('rcv.none')}>
              {q ? t('ui.emptyFiltered') : t('rcv.noneHint')}
            </EmptyState>
          }
        />
      </Card>
    </>
  )
}

/** Excel export of exactly the installments shown. */
async function exportReceivablesXlsx(rows: InstallmentRow[], t: TFunction) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const head = [
    t('fields.refNo'), '#', t('prem.type'), t('fields.insuredName'), t('fields.mga'), t('fields.broker'), t('prem.dueDate'), t('rcv.daysOverdue'),
    t('rcv.bucket'), t('fields.currency'), t('prem.net'), t('prem.paid'), t('rcv.outstanding'), t('rcv.usd'), t('prem.payableToMga'), t('fields.status'),
  ].map((value) => ({ value, fontWeight: 'bold' as const, backgroundColor: '#E8EDF5' }))
  const money = (v: number | null) => ({ type: Number, value: v ?? 0, format: '#,##0.00' })
  const body = rows.map((r) => [
    { type: String, value: r.ref_no ?? '' },
    { type: Number, value: r.installment_no ?? 0 },
    { type: String, value: t(`prem.types.${r.type}`) },
    { type: String, value: r.insured_name ?? '' },
    { type: String, value: r.mga_name ?? '' },
    { type: String, value: r.broker_name ?? '' },
    { type: Date, value: r.due_date ? new Date(`${r.due_date}T00:00:00Z`) : null, format: 'dd.mm.yyyy' },
    { type: Number, value: r.days_overdue ?? 0 },
    { type: String, value: r.aging_bucket ?? '' },
    { type: String, value: r.currency ?? '' },
    money(r.net_amount),
    money(r.paid_amount),
    money(r.outstanding_amount),
    money(r.outstanding_usd),
    money(r.payable_amount),
    { type: String, value: t(`prem.status.${r.status}`) },
  ])
  await writeXlsxFile([head, ...body] as never, {
    sheet: t('pages.receivables.title').slice(0, 31),
    columns: [{ width: fitWidth(rows.map((r) => r.ref_no)) }, { width: 5 }, { width: 12 }, { width: fitWidth(rows.map((r) => r.insured_name), 20) }, { width: fitWidth(rows.map((r) => r.mga_name), 20) }, { width: fitWidth(rows.map((r) => r.broker_name), 16) }, { width: 12 }, { width: 10 }, { width: 8 }, { width: 8 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 14 }],
    stickyRowsCount: 1,
  }).toFile(`receivables-${isoDate()}.xlsx`)
}
