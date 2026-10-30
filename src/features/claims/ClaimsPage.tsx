import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { FileSpreadsheet, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable, type Column } from '@/components/data/DataTable'
import { highlight } from '@/components/data/highlight'
import { NameCell } from '@/components/data/NameCell'
import { EmptyState } from '@/components/EmptyState'
import { Amount } from '@/components/Amount'
import { useAuth } from '@/auth/AuthProvider'
import { can } from '@/lib/roles'
import { errorMessage } from '@/lib/errors'
import { fitWidth, formatAmount, formatDate, isoDate } from '@/lib/format'
import { textWords } from '@/features/search/query'
import { CLAIMS_PAGE } from '@/features/search/pages'
import { useListSearch } from '@/features/search/useSearch'
import { SearchChips } from '@/features/search/SearchChips'
import { MAX_CLAIMS, useClaims, type ClaimRow } from './api'
import { ClaimStatusBadge, LargeLossBadge } from './ClaimStatusBadge'
import { NewClaimDialog } from './NewClaimDialog'

/**
 * Claims register: every claim the user may see, filtered in the database by
 * the search bar. Money is our share, in the claim currency, with USD
 * alongside (no rate yet → «no rate», left out of the USD total).
 */
export function ClaimsPage() {
  const { t } = useTranslation()
  const { role } = useAuth()
  const navigate = useNavigate()
  const { q, parsed, filter, setQ } = useListSearch(CLAIMS_PAGE)
  const { data, isLoading, isFetching } = useClaims(filter, parsed !== null)
  const [creating, setCreating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const rows = data?.rows ?? []
  const words = parsed ? textWords(parsed) : []
  const outstandingUsd = rows.reduce((s, r) => s + (r.outstanding_usd ?? 0), 0)
  const noRate = rows.filter((r) => r.fx_rate_to_usd === null).length

  const usd = (v: number | null) => (v === null ? <span className="text-caption text-warning-700" title={t('rcv.noRate')}>{t('rcv.noRateShort')}</span> : formatAmount(v))
  const columns: Column<ClaimRow>[] = [
    {
      id: 'claim_no',
      header: t('claim.claimNo'),
      cell: (r, c) => (
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <span className="font-medium text-link num" data-ref>{c.hl(r.claim_no)}</span>
          {r.large_loss && <LargeLossBadge />}
        </span>
      ),
    },
    {
      id: 'insured',
      header: t('fields.insuredName'),
      className: 'max-w-64',
      // second line: the submission's ref (a link), then the MGA
      cell: (r, c) => (
        <NameCell
          name={c.hl(r.insured_name)}
          title={[r.insured_name, r.ref_no, r.mga_name].filter(Boolean).join('\n')}
          sub={
            <>
              <Link to={`/submissions/${r.submission_id}`} className="num hover:underline" onClick={(e) => e.stopPropagation()}>{c.hl(r.ref_no)}</Link>
              {r.mga_name && <> · {c.hl(r.mga_name)}</>}
            </>
          }
        />
      ),
    },
    { id: 'mga', header: t('fields.mga'), className: 'max-w-48 truncate', defaultHidden: true, cell: (r, c) => c.hl(r.mga_name) },
    { id: 'lob', header: t('fields.lob'), defaultHidden: true, cell: (r) => r.lob_code ?? '—' },
    { id: 'dol', header: t('claim.dateOfLoss'), cell: (r) => formatDate(r.date_of_loss) },
    { id: 'status', header: t('fields.status'), cell: (r) => <ClaimStatusBadge status={r.status} /> },
    { id: 'currency', header: t('fields.currencyShort'), cell: (r) => r.currency },
    { id: 'outstanding', header: t('claim.outstanding'), align: 'right', cell: (r) => <span className="font-medium">{formatAmount(r.outstanding)}</span> },
    { id: 'paid', header: t('claim.paid'), align: 'right', cell: (r) => formatAmount(r.paid_total) },
    { id: 'incurred', header: t('claim.incurred'), align: 'right', cell: (r) => formatAmount(r.incurred) },
    { id: 'outstanding_usd', header: t('claim.outstandingUsd'), align: 'right', cell: (r) => usd(r.outstanding_usd) },
    { id: 'handler', header: t('claim.handler'), cell: (r) => r.handler_name ?? '—' },
    { id: 'cash_call', header: t('claim.cashCallDue'), defaultHidden: true, cell: (r) => (r.cash_call_due_at ? formatDate(r.cash_call_due_at) : '—') },
    { id: 'cedent_ref', header: t('claim.cedentRef'), defaultHidden: true, cell: (r, c) => c.hl(r.cedent_claim_ref) || '—' },
  ]

  return (
    <>
      <PageHeader
        title={t('pages.claims.title')}
        subtitle={t('pages.claims.subtitle')}
        actions={
          <>
            <Button
              variant="outline"
              disabled={!rows.length || exporting}
              onClick={async () => {
                setExporting(true)
                try {
                  await exportClaimsXlsx(rows, t)
                  toast.success(t('claim.exported', { count: rows.length }))
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
            {can.manageClaims(role) && (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                {t('claim.new')}
              </Button>
            )}
          </>
        }
      />

      {parsed && (
        <SearchChips
          query={parsed}
          scope={CLAIMS_PAGE.scope}
          onChange={setQ}
          count={
            <span className="inline-flex flex-wrap items-center gap-x-3">
              <span>{isLoading ? t('common.loading') : t('claim.count', { count: data?.count ?? 0 })}</span>
              {rows.length > 0 && (
                <span>
                  {t('claim.outstandingUsd')}: <Amount value={outstandingUsd} human className="font-semibold text-foreground" />
                </span>
              )}
              {noRate > 0 && <span className="text-warning-700">{t('rcv.missingRate', { count: noRate })}</span>}
              {isFetching && !isLoading && <Loader2 className="size-3.5 animate-spin" />}
              {(data?.count ?? 0) > MAX_CLAIMS && <span className="text-warning-600">{t('sub.tooMany', { max: MAX_CLAIMS })}</span>}
            </span>
          }
        />
      )}

      <Card className="gap-0 py-0">
        <DataTable
          id="claims.v2"
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id!}
          loading={isLoading}
          hl={(text) => highlight(text, words)}
          onRowClick={(r) => navigate(`/claims/${r.id}`)}
          empty={
            <EmptyState pictogram={q ? 'search' : 'inbox'} title={q ? t('search.noMatch') : t('claim.none')}>
              {q ? t('ui.emptyFiltered') : can.manageClaims(role) ? t('claim.noneHint') : undefined}
            </EmptyState>
          }
        />
      </Card>

      <NewClaimDialog open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

/** Excel export of exactly the claims shown. */
async function exportClaimsXlsx(rows: ClaimRow[], t: TFunction) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const head = [
    t('claim.claimNo'), t('fields.refNo'), t('fields.insuredName'), t('fields.mga'), t('fields.lob'), t('claim.dateOfLoss'), t('claim.notifiedDate'),
    t('fields.status'), t('claim.largeLoss'), t('fields.currency'), t('claim.ourSharePct'), t('claim.estimateOurShare'), t('claim.reserves'), t('claim.paid'),
    t('claim.recoveries'), t('claim.outstanding'), t('claim.incurred'), t('claim.outstandingUsd'), t('claim.incurredUsd'), t('claim.handler'), t('claim.cedentRef'), t('claim.cause'),
  ].map((value) => ({ value, fontWeight: 'bold' as const, backgroundColor: '#E8EDF5' }))
  const money = (v: number | null) => ({ type: Number, value: v ?? 0, format: '#,##0.00' })
  const date = (v: string | null) => ({ type: Date, value: v ? new Date(`${v}T00:00:00Z`) : null, format: 'dd.mm.yyyy' })
  const body = rows.map((r) => [
    { type: String, value: r.claim_no ?? '' },
    { type: String, value: r.ref_no ?? '' },
    { type: String, value: r.insured_name ?? '' },
    { type: String, value: r.mga_name ?? '' },
    { type: String, value: r.lob_code ?? '' },
    date(r.date_of_loss),
    date(r.notified_date),
    { type: String, value: r.status ? t(`claim.status.${r.status}`) : '' },
    { type: String, value: r.large_loss ? t('claim.largeLoss') : '' },
    { type: String, value: r.currency ?? '' },
    { type: Number, value: r.signed_share_pct ?? 0, format: '0.######' },
    money(r.estimate_our_share),
    money(r.reserves_total),
    money(r.paid_total),
    money(r.recoveries_total),
    money(r.outstanding),
    money(r.incurred),
    money(r.outstanding_usd),
    money(r.incurred_usd),
    { type: String, value: r.handler_name ?? '' },
    { type: String, value: r.cedent_claim_ref ?? '' },
    { type: String, value: r.cause ?? '' },
  ])
  await writeXlsxFile([head, ...body] as never, {
    sheet: t('pages.claims.title').slice(0, 31),
    columns: [
      { width: fitWidth(rows.map((r) => r.claim_no)) }, { width: fitWidth(rows.map((r) => r.ref_no)) }, { width: fitWidth(rows.map((r) => r.insured_name), 20) },
      { width: fitWidth(rows.map((r) => r.mga_name), 20) }, { width: 8 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 8 }, { width: 10 },
      { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 20 }, { width: fitWidth(rows.map((r) => r.cedent_claim_ref)) }, { width: 24 },
    ],
    stickyRowsCount: 1,
  }).toFile(`claims-${isoDate()}.xlsx`)
}
