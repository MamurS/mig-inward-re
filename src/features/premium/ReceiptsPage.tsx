import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { CheckCircle2, FileSpreadsheet, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/Field'
import { DataTable, type Column } from '@/components/data/DataTable'
import { highlight } from '@/components/data/highlight'
import { NameCell } from '@/components/data/NameCell'
import { EmptyState } from '@/components/EmptyState'
import { Amount } from '@/components/Amount'
import { useAuth } from '@/auth/AuthProvider'
import { can } from '@/lib/roles'
import { errorMessage } from '@/lib/errors'
import { systemText } from '@/lib/systemText'
import { fitWidth, formatAmount, formatDate, isoDate } from '@/lib/format'
import { cleanDecimal, isDecimal } from '@/lib/decimal'
import { useCounterparties, useCurrencies } from '@/hooks/useReference'
import { textWords } from '@/features/search/query'
import { RECEIPTS_PAGE } from '@/features/search/pages'
import { useListSearch } from '@/features/search/useSearch'
import { SearchChips } from '@/features/search/SearchChips'
import {
  addAllocations, createReceipt, MAX_RECEIPTS, removeAllocation, useInvalidatePremium, useOpenInstallments, useReceiptAllocations, useReceipts, useUsdRates,
  type ReceiptRow,
} from './api'
import { AllocationEditor, allocatedTotal, draftsToAllocations, type AllocDraft } from './AllocationEditor'
import { trimRate } from './receipts'

/**
 * Premium received: the receipts register (the search bar filters it in the
 * database), recording a receipt with its allocations, and a receipt's panel
 * (what it paid, allocating the rest). Finance and admin record; management
 * reads.
 */
export function ReceiptsPage() {
  const { t } = useTranslation()
  const { role } = useAuth()
  const { q, parsed, filter, setQ } = useListSearch(RECEIPTS_PAGE)
  const { data, isLoading, isFetching } = useReceipts(filter, parsed !== null)
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState<ReceiptRow | null>(null)
  const [exporting, setExporting] = useState(false)
  const rows = data?.rows ?? []
  const words = parsed ? textWords(parsed) : []
  const totalUsd = rows.reduce((s, r) => s + (r.amount_usd ?? 0), 0)
  const finance = can.manageFinance(role)

  const columns: Column<ReceiptRow>[] = [
    { id: 'ref_no', header: t('fields.refNo'), cell: (r, c) => <span className="font-medium text-link num">{c.hl(r.ref_no)}</span> },
    { id: 'received_date', header: t('rcp.receivedDate'), cell: (r) => formatDate(r.received_date) },
    {
      id: 'payer',
      header: t('rcp.payer'),
      className: 'max-w-64',
      // the payer's type (MGA / broker) is the grey line under the name
      cell: (r, c) => <NameCell name={c.hl(r.payer_name)} sub={r.payer_type && t(`counterpartyType.${r.payer_type}`)} title={r.payer_name ?? ''} />,
    },
    { id: 'currency', header: t('fields.currencyShort'), cell: (r) => r.currency },
    { id: 'amount', header: t('rcp.amount'), align: 'right', cell: (r) => formatAmount(r.amount) },
    { id: 'allocated', header: t('rcp.allocated'), align: 'right', cell: (r) => formatAmount(r.allocated_amount) },
    {
      id: 'unallocated',
      header: t('rcp.unallocated'),
      align: 'right',
      cell: (r) =>
        (r.unallocated_amount ?? 0) > 0 ? (
          <Badge tone="warning" className="num">{formatAmount(r.unallocated_amount)}</Badge>
        ) : (
          <span className="inline-flex items-center gap-1 text-success-700"><CheckCircle2 className="size-4" />{t('rcp.fully')}</span>
        ),
    },
    { id: 'amount_usd', header: t('rcp.amountUsd'), align: 'right', cell: (r) => formatAmount(r.amount_usd) },
    { id: 'bank_reference', header: t('rcp.bankReference'), className: 'max-w-48 truncate text-muted-foreground', cell: (r, c) => c.hl(r.bank_reference) || '—' },
  ]

  return (
    <>
      <PageHeader
        title={t('pages.receipts.title')}
        subtitle={t('pages.receipts.subtitle')}
        actions={
          <>
            <Button
              variant="outline"
              disabled={!rows.length || exporting}
              onClick={async () => {
                setExporting(true)
                try {
                  await exportReceiptsXlsx(rows, t)
                  toast.success(t('rcp.exported', { count: rows.length }))
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
            {finance && (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                {t('rcp.new')}
              </Button>
            )}
          </>
        }
      />

      {parsed && (
        <SearchChips
          query={parsed}
          scope={RECEIPTS_PAGE.scope}
          onChange={setQ}
          count={
            <span className="inline-flex flex-wrap items-center gap-x-3">
              <span>{isLoading ? t('common.loading') : t('rcp.count', { count: data?.count ?? 0 })}</span>
              {rows.length > 0 && (
                <span>
                  {t('rcp.totalUsd')}: <Amount value={totalUsd} human className="font-semibold text-foreground" />
                </span>
              )}
              {isFetching && !isLoading && <Loader2 className="size-3.5 animate-spin" />}
              {(data?.count ?? 0) > MAX_RECEIPTS && <span className="text-warning-600">{t('sub.tooMany', { max: MAX_RECEIPTS })}</span>}
            </span>
          }
        />
      )}

      <Card className="gap-0 py-0">
        <DataTable
          id="receipts"
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id!}
          loading={isLoading}
          hl={(text) => highlight(text, words)}
          onRowClick={(r) => setOpen(r)}
          empty={
            <EmptyState pictogram={q ? 'search' : 'inbox'} title={q ? t('search.noMatch') : t('rcp.none')}>
              {q ? t('ui.emptyFiltered') : finance ? t('rcp.noneHint') : undefined}
            </EmptyState>
          }
        />
      </Card>

      <NewReceiptDialog open={creating} onClose={() => setCreating(false)} />
      <ReceiptPanel receipt={open} onClose={() => setOpen(null)} />
    </>
  )
}

// ---------------------------------------------------------------------------
// New receipt
// ---------------------------------------------------------------------------

function NewReceiptDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const invalidate = useInvalidatePremium()
  const counterparties = useCounterparties()
  const currencies = useCurrencies()
  const installments = useOpenInstallments(open)
  const [form, setForm] = useState({ received_date: isoDate(), payer_id: '', currency: 'USD', amount: '', bank_reference: '', notes: '' })
  const [drafts, setDrafts] = useState<AllocDraft[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rates = useUsdRates([form.currency, ...(installments.data ?? []).map((i) => i.currency ?? '')], form.received_date)

  useEffect(() => {
    if (!open) return
    setForm({ received_date: isoDate(), payer_id: '', currency: 'USD', amount: '', bank_reference: '', notes: '' })
    setDrafts([])
    setError(null)
  }, [open])
  // a different payer or currency starts the allocation over
  useEffect(() => setDrafts([]), [form.payer_id, form.currency])

  const amountOk = isDecimal(form.amount, 2) && Number(cleanDecimal(form.amount)) > 0
  const headerOk = Boolean(form.received_date && form.payer_id && form.currency && amountOk)
  const allocations = draftsToAllocations(drafts, installments.data ?? [], form.currency)
  const over = amountOk && Number(allocatedTotal(drafts)) > Number(cleanDecimal(form.amount))
  const parties = (counterparties.data ?? []).filter((c) => c.active)

  async function save() {
    if (!headerOk || !allocations || over) return
    setBusy(true)
    setError(null)
    try {
      const r = await createReceipt({ ...form, amount: cleanDecimal(form.amount) }, allocations)
      await invalidate()
      toast.success(t('rcp.recorded', { ref: r.ref_no }))
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('rcp.new')}</DialogTitle>
          <DialogDescription>{t('rcp.newHint')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('rcp.receivedDate')} required>
            <Input type="date" value={form.received_date} onChange={(e) => setForm({ ...form, received_date: e.target.value })} />
          </Field>
          <Field label={t('rcp.payer')} required>
            <NativeSelect value={form.payer_id} onChange={(e) => setForm({ ...form, payer_id: e.target.value })}>
              <option value="">—</option>
              {(['mga', 'broker', 'cedent'] as const).map((type) => (
                <optgroup key={type} label={t(`counterpartyType.${type}`)}>
                  {parties.filter((c) => c.type === type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('fields.currency')} required>
            <NativeSelect value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {currencies.data?.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </NativeSelect>
          </Field>
          <Field label={t('rcp.amountIn', { ccy: form.currency })} required>
            <Input inputMode="decimal" className="text-right num" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label={t('rcp.bankReference')}>
            <Input value={form.bank_reference} onChange={(e) => setForm({ ...form, bank_reference: e.target.value })} placeholder="SWIFT MT103 …" />
          </Field>
          <Field label={t('fields.notes')}>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-10" />
          </Field>
        </div>

        {headerOk ? (
          <AllocationEditor
            currency={form.currency}
            amount={cleanDecimal(form.amount)}
            payerId={form.payer_id}
            rates={rates.data}
            installments={installments.data ?? []}
            value={drafts}
            onChange={setDrafts}
          />
        ) : (
          <p className="rounded-lg bg-muted px-4 py-3 text-small text-muted-foreground">{t('rcp.fillFirst')}</p>
        )}

        {error && <p role="alert" className="rounded-md bg-danger-100 p-3 text-body text-danger-700">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button onClick={() => void save()} disabled={busy || !headerOk || !allocations || over}>
            {busy && <Loader2 className="animate-spin" />}
            {drafts.length ? t('rcp.saveWithAllocations', { count: drafts.length }) : t('rcp.saveUnallocated')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// A receipt: what it paid; allocate the rest
// ---------------------------------------------------------------------------

function ReceiptPanel({ receipt, onClose }: { receipt: ReceiptRow | null; onClose: () => void }) {
  const { t } = useTranslation()
  const { role } = useAuth()
  const finance = can.manageFinance(role)
  const invalidate = useInvalidatePremium()
  const allocations = useReceiptAllocations(receipt?.id ?? null)
  const [allocating, setAllocating] = useState(false)
  const installments = useOpenInstallments(Boolean(receipt) && allocating)
  const rates = useUsdRates([receipt?.currency ?? '', ...(installments.data ?? []).map((i) => i.currency ?? '')], receipt?.received_date ?? '')
  const [drafts, setDrafts] = useState<AllocDraft[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setAllocating(false)
    setDrafts([])
    setError(null)
  }, [receipt])

  const allocated = useMemo(() => (allocations.data ?? []).reduce((s, a) => s + Number(a.amount), 0), [allocations.data])
  // the allocations (fresh after every change) say what is left; the receipt row is the one clicked
  const r = receipt
  const left = r ? Number(r.amount) - allocated : 0
  const payload = r ? draftsToAllocations(drafts, installments.data ?? [], r.currency!) : null
  const over = Number(allocatedTotal(drafts)) > left + 0.0001

  async function saveMore() {
    if (!r || !payload || over || !drafts.length) return
    setBusy(true)
    setError(null)
    try {
      await addAllocations(r.id!, payload)
      await invalidate()
      toast.success(t('rcp.allocatedMore', { ref: r.ref_no }))
      setAllocating(false)
      setDrafts([])
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t('rcp.confirmRemove'))) return
    try {
      await removeAllocation(id)
      await invalidate()
      toast.success(t('rcp.removed'))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <Dialog open={Boolean(receipt)} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-3xl">
        {r && (
          <>
            <DialogHeader>
              <DialogTitle className="num">{r.ref_no}</DialogTitle>
              <DialogDescription>
                {r.payer_name} · {formatDate(r.received_date)}
                {r.bank_reference && <> · {r.bank_reference}</>}
              </DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-4 sm:grid-cols-4">
              <div><dt className="text-caption text-muted-foreground">{t('rcp.amount')}</dt><dd className="font-semibold num">{formatAmount(r.amount)} {r.currency}</dd></div>
              <div><dt className="text-caption text-muted-foreground">{t('rcp.allocated')}</dt><dd className="font-semibold num">{formatAmount(allocated)} {r.currency}</dd></div>
              <div><dt className="text-caption text-muted-foreground">{t('rcp.unallocated')}</dt><dd className={left > 0 ? 'font-semibold text-warning-700 num' : 'font-semibold num'}>{formatAmount(left)} {r.currency}</dd></div>
              <div><dt className="text-caption text-muted-foreground">{t('rcp.amountUsd')}</dt><dd className="font-semibold num">{formatAmount(r.amount_usd)}</dd></div>
            </dl>
            {r.notes && <p className="text-body whitespace-pre-line text-muted-foreground">{systemText(r.notes, t)}</p>}

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-table">
                <thead>
                  <tr className="border-b text-small text-muted-foreground">
                    <th className="h-10 px-3 text-left font-medium">{t('rcp.paysFor')}</th>
                    <th className="h-10 px-3 text-right font-medium">{t('rcp.allocAmount', { ccy: r.currency })}</th>
                    <th className="h-10 px-3 text-right font-medium">{t('rcp.onInstallment')}</th>
                    {finance && <th className="w-px px-2"><span className="sr-only">{t('ui.actions')}</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {(allocations.data ?? []).length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">{allocations.isLoading ? t('common.loading') : t('rcp.nothingAllocated')}</td></tr>
                  )}
                  {(allocations.data ?? []).map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-3 py-3">
                        {a.installment ? (
                          <Link to={`/submissions/${a.installment.submission_id}`} className="text-link hover:underline">
                            <span className="num">{a.installment.ref_no}</span> · {a.installment.insured_name} · #{a.installment.installment_no}
                          </Link>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-3 text-right num">{formatAmount(a.amount)}</td>
                      <td className="px-3 py-3 text-right num">
                        {formatAmount(a.installment_amount)} {a.installment?.currency}
                        {Number(a.fx_rate) !== 1 && <div className="text-caption text-muted-foreground">@ {trimRate(String(a.fx_rate))}</div>}
                      </td>
                      {finance && (
                        <td className="px-2 py-2">
                          <Button variant="ghost" size="icon" className="size-8" aria-label={t('rcp.removeAllocation')} title={t('rcp.removeAllocation')} onClick={() => void remove(a.id)}>
                            <Trash2 />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {finance && left > 0 && !allocating && (
              <Button variant="outline" className="w-fit" onClick={() => setAllocating(true)}>
                <Plus />
                {t('rcp.allocateRest', { amount: `${formatAmount(left)} ${r.currency}` })}
              </Button>
            )}
            {allocating && (
              <AllocationEditor
                currency={r.currency!}
                amount={left.toFixed(2)}
                payerId={r.payer_id!}
                rates={rates.data}
                installments={(installments.data ?? []).filter((i) => !(allocations.data ?? []).some((a) => a.installment_id === i.id))}
                value={drafts}
                onChange={setDrafts}
              />
            )}
            {error && <p role="alert" className="rounded-md bg-danger-100 p-3 text-body text-danger-700">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.close')}</Button>
              {allocating && (
                <Button onClick={() => void saveMore()} disabled={busy || !payload || over || !drafts.length}>
                  {busy && <Loader2 className="animate-spin" />}
                  {t('rcp.saveAllocations', { count: drafts.length })}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Excel export of exactly the receipts the search shows. */
async function exportReceiptsXlsx(rows: ReceiptRow[], t: TFunction) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const head = [t('fields.refNo'), t('rcp.receivedDate'), t('rcp.payer'), t('fields.currency'), t('rcp.amount'), t('rcp.allocated'), t('rcp.unallocated'), t('rcp.amountUsd'), t('rcp.bankReference'), t('fields.notes')]
    .map((value) => ({ value, fontWeight: 'bold' as const, backgroundColor: '#E8EDF5' }))
  const money = (v: number | null) => ({ type: Number, value: v ?? 0, format: '#,##0.00' })
  const body = rows.map((r) => [
    { type: String, value: r.ref_no ?? '' },
    { type: Date, value: r.received_date ? new Date(`${r.received_date}T00:00:00Z`) : null, format: 'dd.mm.yyyy' },
    { type: String, value: r.payer_name ?? '' },
    { type: String, value: r.currency ?? '' },
    money(r.amount),
    money(r.allocated_amount),
    money(r.unallocated_amount),
    money(r.amount_usd),
    { type: String, value: r.bank_reference ?? '' },
    { type: String, value: systemText(r.notes, t) },
  ])
  await writeXlsxFile([head, ...body] as never, {
    sheet: t('pages.receipts.title').slice(0, 31),
    columns: [{ width: fitWidth(rows.map((r) => r.ref_no)) }, { width: 12 }, { width: fitWidth(rows.map((r) => r.payer_name), 20) }, { width: 8 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 28 }, { width: 40 }],
    stickyRowsCount: 1,
  }).toFile(`receipts-${isoDate()}.xlsx`)
}
