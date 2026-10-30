import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/Field'
import { supabase } from '@/lib/supabase'
import { cleanDecimal, isDecimal } from '@/lib/decimal'
import { formatAmount, formatPct, isoDate } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import type { SubmissionRow } from '@/features/submissions/api'
import { useInvalidatePremium, type InstallmentRow } from './api'
import { rowDeductions } from './schedule'

/**
 * Additional premium (owed to us) or return premium (owed to the MGA).
 * The user enters a positive gross; return premium is stored negative.
 * Commission and brokerage follow the submission's percentages.
 */
export function AdjustmentDialog({
  submission: s,
  kind,
  onClose,
}: {
  submission: SubmissionRow
  kind: 'additional' | 'return' | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const invalidate = useInvalidatePremium()
  const [due, setDue] = useState(isoDate())
  const [gross, setGross] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!kind) return
    setDue(isoDate())
    setGross('')
    setNotes('')
    setError(null)
  }, [kind])

  const valid = isDecimal(gross, 2) && Number(cleanDecimal(gross)) > 0 && Boolean(due)
  const [d] = valid ? rowDeductions([cleanDecimal(gross)], s.commission_pct, s.brokerage_pct) : [null]
  const sign = kind === 'return' ? -1 : 1
  const neg = (v: string) => (sign < 0 ? `-${v}` : v)

  async function save() {
    if (!kind || !d) return
    setBusy(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('premium_installments').insert({
        submission_id: s.id!,
        type: kind,
        due_date: due,
        currency: s.currency!,
        // exact decimal strings (types say number); installment_no is assigned by the trigger
        gross_amount: neg(cleanDecimal(gross)),
        commission_amount: neg(d.commission),
        brokerage_amount: neg(d.brokerage),
        notes: notes.trim() || null,
      } as never)
      if (err) throw err
      await invalidate()
      toast.success(kind === 'return' ? t('prem.returnAdded') : t('prem.additionalAdded'))
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={Boolean(kind)} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === 'return' ? t('prem.addReturn') : t('prem.addAdditional')}</DialogTitle>
          <DialogDescription>{kind === 'return' ? t('prem.returnExplain') : t('prem.additionalExplain')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={kind === 'return' ? t('prem.payBy') : t('prem.dueDate')} required>
            <DateInput value={due} onChange={setDue} />
          </Field>
          <Field label={t('prem.grossAmount', { ccy: s.currency })} required hint={t('prem.positiveHint')}>
            <Input inputMode="decimal" className="text-right num" value={gross} onChange={(e) => setGross(e.target.value)} />
          </Field>
          <Field label={t('fields.notes')} className="sm:col-span-2">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        {d && (
          <dl className="grid grid-cols-3 gap-3 rounded-lg bg-muted p-4 text-body">
            <div><dt className="text-caption text-muted-foreground">{t('fields.commission')} · {formatPct(s.commission_pct)}</dt><dd className="num">{formatAmount(neg(d.commission))}</dd></div>
            <div><dt className="text-caption text-muted-foreground">{t('fields.brokerage')} · {formatPct(s.brokerage_pct)}</dt><dd className="num">{formatAmount(neg(d.brokerage))}</dd></div>
            <div>
              <dt className="text-caption text-muted-foreground">{kind === 'return' ? t('prem.payableToMga') : t('prem.net')}</dt>
              <dd className="font-semibold num">{formatAmount(d.net)} {s.currency}</dd>
            </div>
          </dl>
        )}
        {error && <p role="alert" className="rounded-md bg-danger-100 p-3 text-body text-danger-700">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button onClick={() => void save()} disabled={busy || !valid}>
            {busy && <Loader2 className="animate-spin" />}
            {kind === 'return' ? t('prem.addReturn') : t('prem.addAdditional')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Write off what is left of an installment — a reason is required and recorded with who and when. */
export function WriteOffDialog({ installment: i, onClose }: { installment: InstallmentRow | null; onClose: () => void }) {
  const { t } = useTranslation()
  const invalidate = useInvalidatePremium()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    setReason('')
    setError(null)
    setTouched(false)
  }, [i])

  async function save() {
    if (!i || !reason.trim()) return
    setBusy(true)
    setError(null)
    try {
      const { error: err } = await supabase
        .from('premium_installments')
        .update({ written_off_at: new Date().toISOString(), written_off_reason: reason.trim() })
        .eq('id', i.id!)
      if (err) throw err
      await invalidate()
      toast.success(t('prem.writtenOffToast', { no: i.installment_no }))
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={Boolean(i)} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        {i && (
          <>
            <DialogHeader>
              <DialogTitle>{t('prem.writeOffTitle', { no: i.installment_no })}</DialogTitle>
              <DialogDescription>{t('prem.writeOffExplain', { amount: formatAmount(i.outstanding_amount), ccy: i.currency })}</DialogDescription>
            </DialogHeader>
            <Field label={t('prem.writeOffReason')} required error={touched && !reason.trim() ? t('prem.reasonRequired') : undefined}>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} onBlur={() => setTouched(true)} />
            </Field>
            {error && <p role="alert" className="rounded-md bg-danger-100 p-3 text-body text-danger-700">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
              <Button variant="destructive" onClick={() => void save()} disabled={busy || !reason.trim()}>
                {busy && <Loader2 className="animate-spin" />}
                {t('prem.writeOff')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Return premium: record the date it was paid to the MGA. */
export function SettleReturnDialog({ installment: i, onClose }: { installment: InstallmentRow | null; onClose: () => void }) {
  const { t } = useTranslation()
  const invalidate = useInvalidatePremium()
  const [date, setDate] = useState(isoDate())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDate(isoDate())
    setError(null)
  }, [i])

  async function save() {
    if (!i) return
    setBusy(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('premium_installments').update({ settled_at: date }).eq('id', i.id!)
      if (err) throw err
      await invalidate()
      toast.success(t('prem.settledToast', { no: i.installment_no }))
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={Boolean(i)} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        {i && (
          <>
            <DialogHeader>
              <DialogTitle>{t('prem.settleTitle', { no: i.installment_no })}</DialogTitle>
              <DialogDescription>{t('prem.settleExplain', { amount: formatAmount(i.payable_amount), ccy: i.currency })}</DialogDescription>
            </DialogHeader>
            <Field label={t('prem.paidToMgaOn')} required>
              <DateInput value={date} onChange={setDate} />
            </Field>
            {error && <p role="alert" className="rounded-md bg-danger-100 p-3 text-body text-danger-700">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
              <Button onClick={() => void save()} disabled={busy || !date}>
                {busy && <Loader2 className="animate-spin" />}
                {t('prem.markSettled')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Reverse a write-off (finance) — the installment is collectable again. */
export async function undoWriteOff(id: string) {
  const { error } = await supabase.from('premium_installments').update({ written_off_at: null, written_off_reason: null }).eq('id', id)
  if (error) throw error
}
