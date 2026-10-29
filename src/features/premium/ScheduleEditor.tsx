import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Field } from '@/components/Field'
import { SegmentedControl } from '@/components/SegmentedControl'
import { formatAmount, formatDate, formatPct } from '@/lib/format'
import { cleanDecimal, isDecimal } from '@/lib/decimal'
import { errorMessage } from '@/lib/errors'
import type { SubmissionRow } from '@/features/submissions/api'
import { generateSchedule, useInvalidatePremium } from './api'
import { defaultDueDate, equalSchedule, isZeroMoney, rowDeductions, subMoney, sumMoney, type ScheduleRow } from './schedule'

type Mode = 'single' | 'equal' | 'custom'
const EVERY = ['1', '3', '6'] as const

/**
 * Create or replace a submission's premium schedule (the 'original'
 * installments). The preview uses the same maths as the database, so what you
 * see is what gets saved; a total that differs from the expected premium is
 * allowed but shown plainly.
 */
export function ScheduleEditor({
  submission: s,
  open,
  replacing,
  onClose,
}: {
  submission: SubmissionRow
  open: boolean
  /** A schedule exists: saving replaces its original installments. */
  replacing: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const invalidate = useInvalidatePremium()
  const expected = s.our_gross_premium === null ? '0.00' : sumMoney([s.our_gross_premium])
  const firstDefault = defaultDueDate({ ppw_date: s.ppw_date, period_from: s.period_from, bound_at: s.bound_at, payment_terms_days: s.payment_terms_days })

  const [mode, setMode] = useState<Mode>('single')
  const [count, setCount] = useState('4')
  const [every, setEvery] = useState<(typeof EVERY)[number]>('3')
  const [firstDue, setFirstDue] = useState(firstDefault)
  const [single, setSingle] = useState<ScheduleRow>({ due_date: firstDefault, gross_amount: expected })
  const [custom, setCustom] = useState<ScheduleRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setMode('single')
    setCount('4')
    setEvery('3')
    setFirstDue(firstDefault)
    setSingle({ due_date: firstDefault, gross_amount: expected })
    setCustom(equalSchedule(expected, 2, firstDefault, 3))
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const n = Math.min(Math.max(Number.parseInt(count, 10) || 0, 0), 24)
  const rows: ScheduleRow[] =
    mode === 'single' ? [single] : mode === 'equal' ? (n >= 2 && firstDue ? equalSchedule(expected, n, firstDue, Number(every)) : []) : custom

  const invalid = rows.length === 0 || rows.some((r) => !r.due_date || !isDecimal(r.gross_amount, 2) || Number(cleanDecimal(r.gross_amount)) <= 0)
  const preview = useMemo(
    () => (invalid ? [] : rowDeductions(rows.map((r) => cleanDecimal(r.gross_amount)), s.commission_pct, s.brokerage_pct)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(rows), invalid, s.commission_pct, s.brokerage_pct],
  )
  const totalGross = invalid ? null : sumMoney(rows.map((r) => cleanDecimal(r.gross_amount)))
  const totalNet = invalid ? null : sumMoney(preview.map((p) => p.net))
  const diff = totalGross === null ? null : subMoney(expected, totalGross)

  const setCustomRow = (i: number, patch: Partial<ScheduleRow>) => setCustom((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await generateSchedule(s.id!, rows.map((r) => ({ due_date: r.due_date, gross_amount: cleanDecimal(r.gross_amount) })))
      await invalidate()
      toast.success(t('prem.scheduleSaved', { count: rows.length }))
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{replacing ? t('prem.replaceSchedule') : t('prem.createSchedule')}</DialogTitle>
          <DialogDescription>{s.ref_no} · {s.insured_name}</DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-4 sm:grid-cols-4">
          <div><dt className="text-caption text-muted-foreground">{t('prem.expectedGross')}</dt><dd className="font-semibold num">{formatAmount(expected)} {s.currency}</dd></div>
          <div><dt className="text-caption text-muted-foreground">{t('fields.signedSharePct')}</dt><dd className="font-semibold num">{formatPct(s.signed_share_pct)}</dd></div>
          <div><dt className="text-caption text-muted-foreground">{t('fields.commissionPct')}</dt><dd className="font-semibold num">{formatPct(s.commission_pct)}</dd></div>
          <div><dt className="text-caption text-muted-foreground">{t('fields.brokeragePct')}</dt><dd className="font-semibold num">{formatPct(s.brokerage_pct)}</dd></div>
        </dl>

        {replacing && (
          <p className="flex items-start gap-2 rounded-md bg-warning-100 p-3 text-body text-warning-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {t('prem.replaceHint')}
          </p>
        )}

        <Field label={t('prem.howToPay')}>
          <SegmentedControl
            ariaLabel={t('prem.howToPay')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'single' as const, label: t('prem.mode.single') },
              { value: 'equal' as const, label: t('prem.mode.equal') },
              { value: 'custom' as const, label: t('prem.mode.custom') },
            ]}
          />
        </Field>

        {mode === 'single' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('prem.dueDate')} required>
              <Input type="date" value={single.due_date} onChange={(e) => setSingle({ ...single, due_date: e.target.value })} />
            </Field>
            <Field label={t('prem.grossAmount', { ccy: s.currency })} required>
              <Input inputMode="decimal" className="text-right num" value={single.gross_amount} onChange={(e) => setSingle({ ...single, gross_amount: e.target.value })} />
            </Field>
          </div>
        )}

        {mode === 'equal' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('prem.count')} required hint={n < 2 ? t('prem.countHint') : undefined}>
              <Input type="number" min={2} max={24} className="num" value={count} onChange={(e) => setCount(e.target.value)} />
            </Field>
            <Field label={t('prem.firstDue')} required>
              <Input type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
            </Field>
            <Field label={t('prem.every')} className="sm:col-span-2">
              <SegmentedControl
                size="sm"
                ariaLabel={t('prem.every')}
                value={every}
                onChange={setEvery}
                options={EVERY.map((m) => ({ value: m, label: t(`prem.everyMonths.${m}`) }))}
              />
            </Field>
          </div>
        )}

        {mode === 'custom' && (
          <div className="grid gap-2">
            {custom.map((r, i) => (
              <div key={i} className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2.25rem] items-center gap-2">
                <span className="text-caption text-muted-foreground num">#{i + 1}</span>
                <Input type="date" aria-label={t('prem.dueDate')} value={r.due_date} onChange={(e) => setCustomRow(i, { due_date: e.target.value })} />
                <Input inputMode="decimal" aria-label={t('prem.grossAmount', { ccy: s.currency })} className="text-right num" value={r.gross_amount} onChange={(e) => setCustomRow(i, { gross_amount: e.target.value })} />
                <Button variant="ghost" size="icon" aria-label={t('common.remove')} disabled={custom.length <= 1} onClick={() => setCustom(custom.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="w-fit" onClick={() => setCustom([...custom, { due_date: custom.at(-1)?.due_date ?? firstDefault, gross_amount: '' }])}>
              <Plus />
              {t('prem.addRow')}
            </Button>
          </div>
        )}

        {/* Live preview — the same rounding the database applies */}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-table">
            <thead>
              <tr className="border-b text-small text-muted-foreground">
                <th className="h-10 px-3 text-left font-medium">#</th>
                <th className="h-10 px-3 text-left font-medium">{t('prem.dueDate')}</th>
                <th className="h-10 px-3 text-right font-medium">{t('prem.gross')}</th>
                <th className="h-10 px-3 text-right font-medium">{t('fields.commission')}</th>
                <th className="h-10 px-3 text-right font-medium">{t('fields.brokerage')}</th>
                <th className="h-10 px-3 text-right font-medium">{t('prem.net')}</th>
              </tr>
            </thead>
            <tbody>
              {invalid ? (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">{t('prem.previewInvalid')}</td></tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={i} className="border-b transition-colors last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-3 num">{i + 1}</td>
                    <td className="px-3 py-3">{formatDate(r.due_date)}</td>
                    <td className="px-3 py-3 text-right num">{formatAmount(cleanDecimal(r.gross_amount))}</td>
                    <td className="px-3 py-3 text-right num">{formatAmount(preview[i]?.commission)}</td>
                    <td className="px-3 py-3 text-right num">{formatAmount(preview[i]?.brokerage)}</td>
                    <td className="px-3 py-3 text-right font-medium num">{formatAmount(preview[i]?.net)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {!invalid && (
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="px-3 py-3" colSpan={2}>{t('prem.total')}</td>
                  <td className="px-3 py-3 text-right num">{formatAmount(totalGross)}</td>
                  <td className="px-3 py-3 text-right num">{formatAmount(sumMoney(preview.map((p) => p.commission)))}</td>
                  <td className="px-3 py-3 text-right num">{formatAmount(sumMoney(preview.map((p) => p.brokerage)))}</td>
                  <td className="px-3 py-3 text-right num">{formatAmount(totalNet)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {diff !== null && !isZeroMoney(diff) && (
          <p className="flex items-center gap-2 text-body text-warning-700">
            <Badge tone="warning">{t('prem.differs')}</Badge>
            {t('prem.diffExplain', { diff: formatAmount(diff), ccy: s.currency })}
          </p>
        )}

        {error && <p role="alert" className="rounded-md bg-danger-100 p-3 text-body text-danger-700">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button onClick={() => void save()} disabled={busy || invalid}>
            {busy && <Loader2 className="animate-spin" />}
            {replacing ? t('prem.replaceSchedule') : t('prem.createSchedule')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
