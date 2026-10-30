import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Field } from '@/components/Field'
import { SegmentedControl } from '@/components/SegmentedControl'
import { errorMessage } from '@/lib/errors'
import { formatAmount, isoDate } from '@/lib/format'
import { cleanDecimal, isDecimal } from '@/lib/decimal'
import type { Enums } from '@/lib/database.types'
import { useCounterparties, useUsers, userName } from '@/hooks/useReference'
import { AllocationEditor, allocatedTotal, draftsToAllocations, type AllocDraft } from '@/features/premium/AllocationEditor'
import { useOpenInstallments, useUsdRates } from '@/features/premium/api'
import { addRecovery, addReserve, changeClaimStatus, createClaimPayment, updateClaim, useInvalidateClaims, type ClaimRow, type ClaimStatus } from './api'

function useSave(onDone: () => void) {
  const invalidate = useInvalidateClaims()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await invalidate()
      toast.success(ok)
      onDone()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, run }
}

const Problem = ({ error }: { error: string | null }) =>
  error ? <p role="alert" className="rounded-md bg-danger-100 p-3 text-body text-danger-700">{error}</p> : null

// ---------------------------------------------------------------------------
// Status: open / close / decline / reopen
// ---------------------------------------------------------------------------
export function ClaimStatusDialog({ claim, to, onClose }: { claim: ClaimRow; to: ClaimStatus | null; onClose: () => void }) {
  const { t } = useTranslation()
  const { busy, error, setError, run } = useSave(onClose)
  const [text, setText] = useState('')
  useEffect(() => {
    setText('')
    setError(null)
  }, [to, setError])
  if (!to) return null
  const outstanding = Number(claim.outstanding ?? 0)
  const needsText = to === 'declined' || (to === 'closed' && outstanding !== 0)
  return (
    <Dialog open={Boolean(to)} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`claim.to.${to}`)}</DialogTitle>
          <DialogDescription>{claim.claim_no} · {claim.insured_name}</DialogDescription>
        </DialogHeader>
        {to === 'closed' && outstanding !== 0 && (
          <p role="alert" className="rounded-md border border-warning-300 bg-warning-50 p-3 text-body text-warning-800">
            {t('claim.closeWithOutstanding', { amount: formatAmount(outstanding), ccy: claim.currency })}
          </p>
        )}
        {needsText && (
          <Field label={to === 'declined' ? t('claim.declineReason') : t('claim.closeComment')} required htmlFor="claim-status-text">
            <Textarea id="claim-status-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
        )}
        <Problem error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button
            variant={to === 'declined' ? 'destructive' : 'default'}
            disabled={busy || (needsText && !text.trim())}
            onClick={() =>
              void run(
                () => changeClaimStatus(claim.id!, { status: to, ...(to === 'declined' ? { decline_reason: text.trim() } : {}), ...(to === 'closed' ? { close_comment: text.trim() || null } : {}) }),
                t('claim.statusChanged', { status: t(`claim.status.${to}`) }),
              )
            }
          >
            {busy && <Loader2 className="animate-spin" />}
            {t(`claim.to.${to}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Reserve movement (append-only; a correction is a negative movement)
// ---------------------------------------------------------------------------
export function ReserveDialog({ claim, open, onClose }: { claim: ClaimRow; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { busy, error, setError, run } = useSave(onClose)
  const [date, setDate] = useState(isoDate())
  const [dir, setDir] = useState<'up' | 'down'>('up')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (!open) return
    setDate(isoDate())
    setDir('up')
    setAmount('')
    setReason('')
    setError(null)
  }, [open, setError])
  const ok = isDecimal(amount, 2) && Number(cleanDecimal(amount)) > 0
  const signed = ok ? (dir === 'down' ? '-' : '') + cleanDecimal(amount) : null
  const after = signed ? Number(claim.outstanding ?? 0) + Number(signed) : null
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('claim.addReserve')}</DialogTitle>
          <DialogDescription>{t('claim.reserveHint')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('claim.movement')} className="sm:col-span-2">
            <SegmentedControl ariaLabel={t('claim.movement')} value={dir} onChange={setDir} options={[{ value: 'up', label: t('claim.increase') }, { value: 'down', label: t('claim.decrease') }]} />
          </Field>
          <Field label={t('claim.amountCcy', { ccy: claim.currency })} required htmlFor="reserve-amount" error={amount && !ok ? t('v.amount') : undefined}
            hint={after !== null ? t('claim.outstandingAfter', { amount: formatAmount(after), ccy: claim.currency }) : undefined}>
            <Input id="reserve-amount" inputMode="decimal" className="text-right tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label={t('claim.movementDate')} required htmlFor="reserve-date">
            <Input id="reserve-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t('claim.reason')} required className="sm:col-span-2" htmlFor="reserve-reason">
            <Input id="reserve-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
        <Problem error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button disabled={busy || !ok || !reason.trim() || !date} onClick={() => void run(() => addReserve(claim.id!, date, signed!, reason.trim()), t('claim.reserveSaved'))}>
            {busy && <Loader2 className="animate-spin" />}
            {t('claim.saveMovement')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Recovery (salvage / subrogation / other)
// ---------------------------------------------------------------------------
const RECOVERY_TYPES: Enums<'claim_recovery_type'>[] = ['salvage', 'subrogation', 'other']
export function RecoveryDialog({ claim, open, onClose }: { claim: ClaimRow; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { busy, error, setError, run } = useSave(onClose)
  const [form, setForm] = useState({ recovery_date: isoDate(), type: 'salvage' as Enums<'claim_recovery_type'>, amount: '', notes: '' })
  useEffect(() => {
    if (!open) return
    setForm({ recovery_date: isoDate(), type: 'salvage', amount: '', notes: '' })
    setError(null)
  }, [open, setError])
  const ok = isDecimal(form.amount, 2) && Number(cleanDecimal(form.amount)) > 0
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('claim.addRecovery')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('claim.recoveryType')} className="sm:col-span-2">
            <SegmentedControl ariaLabel={t('claim.recoveryType')} value={form.type} onChange={(type) => setForm({ ...form, type })} options={RECOVERY_TYPES.map((x) => ({ value: x, label: t(`claim.recovery.${x}`) }))} />
          </Field>
          <Field label={t('claim.amountCcy', { ccy: claim.currency })} required htmlFor="recovery-amount" error={form.amount && !ok ? t('v.amount') : undefined}>
            <Input id="recovery-amount" inputMode="decimal" className="text-right tabular-nums" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label={t('claim.recoveryDate')} required htmlFor="recovery-date">
            <Input id="recovery-date" type="date" value={form.recovery_date} onChange={(e) => setForm({ ...form, recovery_date: e.target.value })} />
          </Field>
          <Field label={t('fields.notes')} className="sm:col-span-2" htmlFor="recovery-notes">
            <Input id="recovery-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <Problem error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button disabled={busy || !ok} onClick={() => void run(() => addRecovery(claim.id!, { ...form, amount: cleanDecimal(form.amount), notes: form.notes.trim() || null }), t('claim.recoverySaved'))}>
            {busy && <Loader2 className="animate-spin" />}
            {t('claim.saveRecovery')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Payment (finance): cash, or offset against the MGA's open premium
// ---------------------------------------------------------------------------
const PAYMENT_TYPES: Enums<'claim_payment_type'>[] = ['indemnity', 'expense', 'cash_call']
export function PaymentDialog({ claim, open, onClose }: { claim: ClaimRow; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { busy, error, setError, run } = useSave(onClose)
  const counterparties = useCounterparties()
  const [form, setForm] = useState({ payment_date: isoDate(), amount: '', type: 'indemnity' as Enums<'claim_payment_type'>, method: 'cash' as Enums<'claim_payment_method'>, payee_id: '', bank_reference: '', notes: '' })
  const [drafts, setDrafts] = useState<AllocDraft[]>([])
  const installments = useOpenInstallments(open && form.method === 'offset_against_premium')
  const mgaInstallments = (installments.data ?? []).filter((i) => i.mga_id === claim.mga_id)
  const rates = useUsdRates([claim.currency ?? '', ...mgaInstallments.map((i) => i.currency ?? '')], form.payment_date)
  useEffect(() => {
    if (!open) return
    setForm({ payment_date: isoDate(), amount: '', type: 'indemnity', method: 'cash', payee_id: claim.mga_id ?? '', bank_reference: '', notes: '' })
    setDrafts([])
    setError(null)
  }, [open, claim.mga_id, setError])
  useEffect(() => setDrafts([]), [form.method])

  const amountOk = isDecimal(form.amount, 2) && Number(cleanDecimal(form.amount)) > 0
  const offset = form.method === 'offset_against_premium'
  const allocations = offset ? draftsToAllocations(drafts, mgaInstallments, claim.currency!) : []
  const fullyAllocated = !offset || (amountOk && Number(allocatedTotal(drafts)) === Number(cleanDecimal(form.amount)) && drafts.length > 0)
  const ready = amountOk && form.payment_date && (!offset || (allocations && fullyAllocated))
  const parties = (counterparties.data ?? []).filter((c) => c.active)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('claim.recordPayment')}</DialogTitle>
          <DialogDescription>{t('claim.paymentHint', { ccy: claim.currency, outstanding: formatAmount(claim.outstanding) })}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('claim.paymentMethod')} className="sm:col-span-2">
            <SegmentedControl
              ariaLabel={t('claim.paymentMethod')}
              value={form.method}
              onChange={(method) => setForm({ ...form, method })}
              options={[{ value: 'cash', label: t('claim.method.cash') }, { value: 'offset_against_premium', label: t('claim.method.offset_against_premium') }]}
            />
          </Field>
          <Field label={t('claim.paymentType')} className="sm:col-span-2">
            <SegmentedControl ariaLabel={t('claim.paymentType')} value={form.type} onChange={(type) => setForm({ ...form, type })} options={PAYMENT_TYPES.map((x) => ({ value: x, label: t(`claim.paymentTypes.${x}`) }))} />
          </Field>
          <Field label={t('claim.amountCcy', { ccy: claim.currency })} required htmlFor="payment-amount" error={form.amount && !amountOk ? t('v.amount') : undefined}>
            <Input id="payment-amount" inputMode="decimal" className="text-right tabular-nums" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label={t('claim.paymentDate')} required htmlFor="payment-date">
            <Input id="payment-date" type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
          </Field>
          {!offset && (
            <>
              <Field label={t('claim.payee')} htmlFor="payment-payee">
                <NativeSelect id="payment-payee" value={form.payee_id} onChange={(e) => setForm({ ...form, payee_id: e.target.value })}>
                  {parties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </NativeSelect>
              </Field>
              <Field label={t('rcp.bankReference')} htmlFor="payment-bank">
                <Input id="payment-bank" value={form.bank_reference} onChange={(e) => setForm({ ...form, bank_reference: e.target.value })} />
              </Field>
            </>
          )}
          <Field label={t('fields.notes')} className="sm:col-span-2" htmlFor="payment-notes">
            <Input id="payment-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        {offset && (
          <div className="grid gap-2" data-offset>
            <p className="text-body text-muted-foreground">{t('claim.offsetHint', { mga: claim.mga_name })}</p>
            {amountOk ? (
              <AllocationEditor
                currency={claim.currency!}
                amount={cleanDecimal(form.amount)}
                payerId={claim.mga_id!}
                rates={rates.data}
                installments={mgaInstallments}
                value={drafts}
                onChange={setDrafts}
              />
            ) : (
              <p className="text-body text-muted-foreground">{t('claim.offsetAmountFirst')}</p>
            )}
            {amountOk && drafts.length > 0 && !fullyAllocated && <p className="text-small text-warning-700">{t('claim.offsetInFull')}</p>}
          </div>
        )}
        <Problem error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button
            disabled={busy || !ready}
            onClick={() =>
              void run(
                () =>
                  createClaimPayment(
                    {
                      claim_id: claim.id!, payment_date: form.payment_date, amount: cleanDecimal(form.amount), type: form.type,
                      payee_id: offset ? claim.mga_id : form.payee_id || null, method: form.method,
                      bank_reference: form.bank_reference.trim() || null, notes: form.notes.trim() || null,
                    },
                    offset ? allocations ?? [] : [],
                  ),
                t('claim.paymentSaved'),
              )
            }
          >
            {busy && <Loader2 className="animate-spin" />}
            {t('claim.savePayment')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Edit the claim's details (not its money: that moves through reserves / payments)
// ---------------------------------------------------------------------------
export function EditClaimDialog({ claim, open, onClose }: { claim: ClaimRow; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const users = useUsers()
  const { busy, error, setError, run } = useSave(onClose)
  const init = () => ({
    estimate_100: claim.estimate_100 === null ? '' : String(claim.estimate_100), cause: claim.cause ?? '', location: claim.location ?? '',
    description: claim.description ?? '', cedent_claim_ref: claim.cedent_claim_ref ?? '', handler_id: claim.handler_id ?? '', notes: claim.notes ?? '',
  })
  const [form, setForm] = useState(init)
  useEffect(() => {
    if (open) {
      setForm(init())
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const estimateOk = form.estimate_100.trim() === '' || isDecimal(form.estimate_100, 2)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })
  const nul = (v: string) => (v.trim() === '' ? null : v.trim())
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{t('claim.edit')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('claim.estimate100', { ccy: claim.currency })} htmlFor="edit-estimate" error={estimateOk ? undefined : t('v.amount')}>
            <Input id="edit-estimate" inputMode="decimal" className="text-right tabular-nums" value={form.estimate_100} onChange={set('estimate_100')} />
          </Field>
          <Field label={t('claim.handler')} htmlFor="edit-handler">
            <NativeSelect id="edit-handler" value={form.handler_id} onChange={set('handler_id')}>
              <option value="">—</option>
              {users.data?.filter((u) => u.active && (u.role === 'claims' || u.role === 'admin')).map((u) => <option key={u.id} value={u.id}>{userName(u)}</option>)}
            </NativeSelect>
          </Field>
          <Field label={t('claim.cause')} htmlFor="edit-cause"><Input id="edit-cause" value={form.cause} onChange={set('cause')} /></Field>
          <Field label={t('claim.location')} htmlFor="edit-location"><Input id="edit-location" value={form.location} onChange={set('location')} /></Field>
          <Field label={t('claim.cedentRef')} htmlFor="edit-cedent"><Input id="edit-cedent" value={form.cedent_claim_ref} onChange={set('cedent_claim_ref')} /></Field>
          <Field label={t('claim.description')} className="sm:col-span-2" htmlFor="edit-description"><Textarea id="edit-description" rows={2} value={form.description} onChange={set('description')} /></Field>
          <Field label={t('fields.notes')} className="sm:col-span-2" htmlFor="edit-notes"><Textarea id="edit-notes" rows={2} value={form.notes} onChange={set('notes')} /></Field>
        </div>
        <Problem error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button
            disabled={busy || !estimateOk}
            onClick={() =>
              void run(
                () => updateClaim(claim.id!, {
                  estimate_100: form.estimate_100.trim() ? cleanDecimal(form.estimate_100) : null, cause: nul(form.cause), location: nul(form.location),
                  description: nul(form.description), cedent_claim_ref: nul(form.cedent_claim_ref), handler_id: form.handler_id || null, notes: nul(form.notes),
                }),
                t('claim.saved'),
              )
            }
          >
            {busy && <Loader2 className="animate-spin" />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
