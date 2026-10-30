import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { isoDate } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import { buildSubmissionsQuery, type RegisterQuery, type SubmissionRow } from './api'

const AMOUNT = '#,##0.00'
const PCT = '0.######'

/** Writes the given rows to an .xlsx (the register's export and its bulk «Export selected»). */
export async function exportSubmissionsXlsx(rows: SubmissionRow[], t: TFunction) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')

  type Col = { header: string; value: (r: SubmissionRow) => string | number | Date | null; format?: string; width?: number }
  const d = (v: string | null) => (v ? new Date(v.length === 10 ? `${v}T00:00:00Z` : v) : null)
  const s = (v: string | null) => (v ? t(`status.${v}`) : null)
  const cols: Col[] = [
    { header: t('fields.refNo'), value: (r) => r.ref_no, width: 15 },
    { header: t('fields.receivedAt'), value: (r) => d(r.received_at), format: 'dd.mm.yyyy', width: 12 },
    { header: t('fields.status'), value: (r) => s(r.status), width: 14 },
    { header: t('fields.insuredName'), value: (r) => r.insured_name, width: 36 },
    { header: t('fields.insuredCountry'), value: (r) => r.insured_country, width: 8 },
    { header: t('fields.mga'), value: (r) => r.mga_name, width: 28 },
    { header: t('fields.broker'), value: (r) => r.broker_name, width: 24 },
    { header: t('fields.sourceParty'), value: (r) => r.source_party_name, width: 24 },
    { header: t('fields.businessType'), value: (r) => (r.business_type ? t(`businessType.${r.business_type}`) : null), width: 12 },
    { header: t('fields.lob'), value: (r) => r.lob_name, width: 24 },
    { header: t('fields.periodFrom'), value: (r) => d(r.period_from), format: 'dd.mm.yyyy', width: 12 },
    { header: t('fields.periodTo'), value: (r) => d(r.period_to), format: 'dd.mm.yyyy', width: 12 },
    { header: t('fields.currency'), value: (r) => r.currency, width: 8 },
    { header: t('fields.sumInsured100'), value: (r) => r.sum_insured_100, format: AMOUNT, width: 18 },
    { header: t('fields.limit100'), value: (r) => r.limit_100, format: AMOUNT, width: 18 },
    { header: t('fields.deductible'), value: (r) => r.deductible, format: AMOUNT, width: 14 },
    { header: t('fields.grossPremium100'), value: (r) => r.gross_premium_100, format: AMOUNT, width: 16 },
    { header: t('fields.commissionPct'), value: (r) => r.commission_pct, format: PCT, width: 10 },
    { header: t('fields.brokeragePct'), value: (r) => r.brokerage_pct, format: PCT, width: 10 },
    { header: t('fields.writtenSharePct'), value: (r) => r.written_share_pct, format: PCT, width: 10 },
    { header: t('fields.signedSharePct'), value: (r) => r.signed_share_pct, format: PCT, width: 10 },
    { header: t('fields.ourGrossPremium'), value: (r) => r.our_gross_premium, format: AMOUNT, width: 16 },
    { header: t('fields.commission'), value: (r) => r.commission_amount, format: AMOUNT, width: 14 },
    { header: t('fields.brokerage'), value: (r) => r.brokerage_amount, format: AMOUNT, width: 14 },
    { header: t('fields.ourNetPremium'), value: (r) => r.our_net_premium, format: AMOUNT, width: 16 },
    { header: t('fields.fxRate'), value: (r) => r.fx_rate_to_usd, format: '0.0000000000', width: 14 },
    { header: t('fields.ourGrossUsd'), value: (r) => r.our_gross_premium_usd, format: AMOUNT, width: 16 },
    { header: t('fields.ourNetUsd'), value: (r) => r.our_net_premium_usd, format: AMOUNT, width: 16 },
    { header: t('fields.offerValidUntil'), value: (r) => d(r.offer_valid_until), format: 'dd.mm.yyyy', width: 12 },
    { header: t('fields.boundAt'), value: (r) => d(r.bound_at), format: 'dd.mm.yyyy', width: 12 },
    { header: t('fields.underwriter'), value: (r) => r.underwriter_name, width: 22 },
    { header: t('fields.nextFollowUp'), value: (r) => d(r.next_follow_up_at), format: 'dd.mm.yyyy', width: 12 },
    { header: t('fields.decisionReason'), value: (r) => r.decision_reason, width: 40 },
  ]

  const header = cols.map((c) => ({ value: c.header, fontWeight: 'bold' as const, backgroundColor: '#E8EDF5' }))
  const body = rows.map((r) =>
    cols.map((c) => {
      const v = c.value(r)
      if (v === null || v === undefined) return null
      if (v instanceof Date) return { value: v, type: Date, format: c.format }
      if (typeof v === 'number') return { value: v, type: Number, format: c.format }
      return { value: v, type: String }
    }),
  )

  await writeXlsxFile([header, ...body], {
    sheet: t('pages.submissions.title').slice(0, 31),
    columns: cols.map((c) => ({ width: c.width ?? 14 })),
    stickyRowsCount: 1,
  }).toFile(`submissions-${isoDate()}.xlsx`)
}

/** Excel export of exactly the rows the register currently shows (the same query: search and sort). */
export function ExportButton({ query, disabled }: { query: RegisterQuery; disabled?: boolean }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  async function exportXlsx() {
    setBusy(true)
    try {
      const { data, error } = await buildSubmissionsQuery(query)
      if (error) throw error
      const rows = (data ?? []) as unknown as SubmissionRow[]
      await exportSubmissionsXlsx(rows, t)
      toast.success(t('sub.exported', { count: rows.length }))
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" onClick={exportXlsx} disabled={disabled || busy}>
      {busy ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
      {t('sub.exportExcel')}
    </Button>
  )
}
