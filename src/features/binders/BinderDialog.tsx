import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/ui/decimal-input'
import { DateInput } from '@/components/ui/date-input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Field } from '@/components/Field'
import { useAuth } from '@/auth/AuthProvider'
import { errorMessage } from '@/lib/errors'
import { cleanDecimal, isDecimal } from '@/lib/decimal'
import { useCounterparties, useCountries, useCurrencies, useLinesOfBusiness, useLocalName, useUsers, userName } from '@/hooks/useReference'
import { BORDEREAU_KINDS, saveBinder, useInvalidateBinders, type BinderLob, type BinderRow, type BordereauKind } from './api'

type Form = {
  binder_ref: string
  mga_id: string
  broker_id: string
  underwriter_id: string
  period_from: string
  period_to: string
  currency: string
  our_share_pct: string
  commission_pct: string
  brokerage_pct: string
  limit_per_risk: string
  aggregate_limit: string
  territories: string[]
  bordereau_frequency: 'monthly' | 'quarterly'
  bordereau_due_days: string
  bordereau_kinds: BordereauKind[]
  status: 'draft' | 'active' | 'expired' | 'cancelled'
  notes: string
  lobs: Record<string, string> // lob id → limit at 100 % ('' = no own limit)
}

const pct = (v: string, allowZero = true) => {
  const n = Number(cleanDecimal(v, 'pct'))
  return isDecimal(v, 6) && n <= 100 && (allowZero ? n >= 0 : n > 0)
}
const amountOk = (v: string) => v.trim() === '' || (isDecimal(v, 2) && Number(cleanDecimal(v)) > 0)

/**
 * A binder's terms: the MGA, period, lines and their limits, territories, our
 * share, deductions, limits per risk and in the aggregate, and the bordereaux
 * owed (which kinds, how often, how many days after the period).
 */
export function BinderDialog({ open, onClose, binder, lobs, onSaved }: { open: boolean; onClose: () => void; binder?: BinderRow; lobs?: BinderLob[]; onSaved?: (id: string) => void }) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const parties = useCounterparties()
  const currencies = useCurrencies()
  const countries = useCountries()
  const lines = useLinesOfBusiness()
  const users = useUsers()
  const localName = useLocalName()
  const invalidate = useInvalidateBinders()
  const blank = (): Form => ({
    binder_ref: '', mga_id: '', broker_id: '', underwriter_id: profile?.role === 'underwriter' ? profile.id : '', period_from: '', period_to: '', currency: 'USD',
    our_share_pct: '', commission_pct: '0', brokerage_pct: '0', limit_per_risk: '', aggregate_limit: '', territories: [], bordereau_frequency: 'monthly',
    bordereau_due_days: '30', bordereau_kinds: [...BORDEREAU_KINDS], status: 'active', notes: '', lobs: {},
  })
  const [form, setForm] = useState<Form>(blank)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setTouched(false)
    if (!binder) return setForm(blank())
    setForm({
      binder_ref: binder.binder_ref ?? '', mga_id: binder.mga_id ?? '', broker_id: binder.broker_id ?? '', underwriter_id: binder.underwriter_id ?? '',
      period_from: binder.period_from ?? '', period_to: binder.period_to ?? '', currency: binder.currency ?? 'USD',
      our_share_pct: String(binder.our_share_pct ?? ''), commission_pct: String(binder.commission_pct ?? 0), brokerage_pct: String(binder.brokerage_pct ?? 0),
      limit_per_risk: binder.limit_per_risk === null ? '' : String(binder.limit_per_risk), aggregate_limit: binder.aggregate_limit === null ? '' : String(binder.aggregate_limit),
      territories: binder.territories ?? [], bordereau_frequency: binder.bordereau_frequency ?? 'monthly', bordereau_due_days: String(binder.bordereau_due_days ?? 30),
      bordereau_kinds: binder.bordereau_kinds ?? [...BORDEREAU_KINDS], status: binder.status ?? 'active', notes: binder.notes ?? '',
      lobs: Object.fromEntries((lobs ?? []).map((l) => [l.lob_id, l.limit_100 === null ? '' : String(l.limit_100)])),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, binder?.id])

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const errors: Partial<Record<keyof Form, string>> = {}
  if (!form.binder_ref.trim()) errors.binder_ref = t('v.required')
  if (!form.mga_id) errors.mga_id = t('v.required')
  if (!form.period_from) errors.period_from = t('v.required')
  if (!form.period_to) errors.period_to = t('v.required')
  else if (form.period_from && form.period_to < form.period_from) errors.period_to = t('binder.v.periodOrder')
  if (!pct(form.our_share_pct, false)) errors.our_share_pct = t('v.pct')
  if (!pct(form.commission_pct)) errors.commission_pct = t('v.pct')
  if (!pct(form.brokerage_pct)) errors.brokerage_pct = t('v.pct')
  if (!amountOk(form.limit_per_risk)) errors.limit_per_risk = t('v.amount')
  if (!amountOk(form.aggregate_limit)) errors.aggregate_limit = t('v.amount')
  if (!/^\d{1,3}$/.test(cleanDecimal(form.bordereau_due_days, 'int')) || Number(cleanDecimal(form.bordereau_due_days, 'int')) > 365) errors.bordereau_due_days = t('binder.v.days')
  if (Object.keys(form.lobs).length === 0) errors.lobs = t('binder.v.lobs')
  if (Object.values(form.lobs).some((v) => !amountOk(v))) errors.lobs = t('v.amount')
  const err = (k: keyof Form) => (touched ? errors[k] : undefined)
  const valid = Object.keys(errors).length === 0

  async function save() {
    setTouched(true)
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      const n = (v: string) => (v.trim() === '' ? null : cleanDecimal(v))
      const id = await saveBinder(
        binder?.id ?? null,
        {
          binder_ref: form.binder_ref.trim(), mga_id: form.mga_id, broker_id: form.broker_id || null, underwriter_id: form.underwriter_id || null,
          period_from: form.period_from, period_to: form.period_to, currency: form.currency, our_share_pct: cleanDecimal(form.our_share_pct, 'pct'),
          commission_pct: cleanDecimal(form.commission_pct, 'pct'), brokerage_pct: cleanDecimal(form.brokerage_pct, 'pct'), limit_per_risk: n(form.limit_per_risk),
          aggregate_limit: n(form.aggregate_limit), territories: form.territories, bordereau_frequency: form.bordereau_frequency,
          bordereau_due_days: Number(cleanDecimal(form.bordereau_due_days, 'int')), bordereau_kinds: form.bordereau_kinds, status: form.status, notes: form.notes.trim() || null,
        },
        Object.entries(form.lobs).map(([lob_id, v]) => ({ lob_id, limit_100: n(v) })),
      )
      await invalidate()
      toast.success(binder ? t('binder.saved') : t('binder.created'))
      onClose()
      onSaved?.(id)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const mgas = (parties.data ?? []).filter((c) => c.type === 'mga' && (c.active || c.id === form.mga_id))
  const brokers = (parties.data ?? []).filter((c) => c.type === 'broker' && (c.active || c.id === form.broker_id))
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-2xl" data-binder-dialog>
        <DialogHeader>
          <DialogTitle>{binder ? t('binder.edit') : t('binder.new')}</DialogTitle>
          <DialogDescription>{t('binder.formHint')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('binder.ref')} required error={err('binder_ref')}>
            <Input value={form.binder_ref} onChange={set('binder_ref')} placeholder="ALM-CARGO-2026" />
          </Field>
          <Field label={t('fields.status')}>
            <NativeSelect value={form.status} onChange={set('status')}>
              {(['draft', 'active', 'expired', 'cancelled'] as const).map((s) => <option key={s} value={s}>{t(`binder.status.${s}`)}</option>)}
            </NativeSelect>
          </Field>
          <Field label={t('fields.mga')} required error={err('mga_id')}>
            <NativeSelect value={form.mga_id} onChange={set('mga_id')} disabled={Boolean(binder)}>
              <option value="">—</option>
              {mgas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label={t('fields.broker')}>
            <NativeSelect value={form.broker_id} onChange={set('broker_id')}>
              <option value="">{t('sub.directNoBroker')}</option>
              {brokers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label={t('binder.periodFrom')} required error={err('period_from')}>
            <DateInput value={form.period_from} onChange={(v) => setForm((f) => ({ ...f, period_from: v }))} />
          </Field>
          <Field label={t('binder.periodTo')} required error={err('period_to')}>
            <DateInput value={form.period_to} onChange={(v) => setForm((f) => ({ ...f, period_to: v }))} />
          </Field>
          <Field label={t('fields.currency')} required>
            <NativeSelect value={form.currency} onChange={set('currency')}>
              {(currencies.data ?? []).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </NativeSelect>
          </Field>
          <Field label={t('fields.underwriter')}>
            <NativeSelect value={form.underwriter_id} onChange={set('underwriter_id')}>
              <option value="">—</option>
              {users.data?.filter((u) => u.active && (u.role === 'underwriter' || u.role === 'admin')).map((u) => <option key={u.id} value={u.id}>{userName(u)}</option>)}
            </NativeSelect>
          </Field>
          <Field label={t('binder.ourShare')} required error={err('our_share_pct')}>
            <DecimalInput kind="pct" className="text-right tabular-nums" value={form.our_share_pct} onChange={set('our_share_pct')} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('fields.commissionPct')} error={err('commission_pct')}>
              <DecimalInput kind="pct" className="text-right tabular-nums" value={form.commission_pct} onChange={set('commission_pct')} />
            </Field>
            <Field label={t('fields.brokeragePct')} error={err('brokerage_pct')}>
              <DecimalInput kind="pct" className="text-right tabular-nums" value={form.brokerage_pct} onChange={set('brokerage_pct')} />
            </Field>
          </div>
          <Field label={t('binder.limitPerRiskCcy', { ccy: form.currency })} hint={t('binder.at100')} error={err('limit_per_risk')}>
            <DecimalInput className="text-right tabular-nums" value={form.limit_per_risk} onChange={set('limit_per_risk')} />
          </Field>
          <Field label={t('binder.aggregateLimitCcy', { ccy: form.currency })} hint={t('binder.aggregateHint')} error={err('aggregate_limit')}>
            <DecimalInput className="text-right tabular-nums" value={form.aggregate_limit} onChange={set('aggregate_limit')} />
          </Field>
        </div>

        <fieldset className="grid gap-2" data-binder-lobs>
          <legend className="text-small font-medium">{t('binder.lobs')}<span className="text-destructive" aria-hidden>*</span></legend>
          <p className="text-caption text-muted-foreground">{t('binder.lobsHint', { ccy: form.currency })}</p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {(lines.data ?? []).filter((l) => l.active || l.id in form.lobs).map((l) => {
              const on = l.id in form.lobs
              return (
                <li key={l.id} className="flex min-h-11 items-center gap-2 rounded-md border px-3 py-1">
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-body">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setForm((f) => {
                        const next = { ...f.lobs }
                        if (on) delete next[l.id]
                        else next[l.id] = ''
                        return { ...f, lobs: next }
                      })}
                    />
                    <span className="truncate" title={localName(l)}><span className="num">{l.code}</span> · {localName(l)}</span>
                  </label>
                  {on && (
                    <DecimalInput
                      aria-label={t('binder.lobLimit', { lob: l.code })}
                      placeholder={t('binder.noOwnLimit')}
                      className="h-9 w-32 text-right tabular-nums"
                      value={form.lobs[l.id]}
                      onChange={(e) => setForm((f) => ({ ...f, lobs: { ...f.lobs, [l.id]: e.target.value } }))}
                    />
                  )}
                </li>
              )
            })}
          </ul>
          {touched && errors.lobs && <p className="text-caption text-destructive">{errors.lobs}</p>}
        </fieldset>

        <Field label={t('binder.territories')} hint={t('binder.territoriesHint')}>
          <div className="flex flex-wrap gap-2" data-territories>
            {(countries.data ?? []).map((c) => {
              const on = form.territories.includes(c.code)
              return (
                <button
                  key={c.code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setForm((f) => ({ ...f, territories: toggle(f.territories, c.code) }))}
                  className={`h-8 rounded-full border px-3 text-small transition-colors ${on ? 'border-brand-600 bg-brand-50 text-brand-700' : 'hover:bg-slate-50'}`}
                  title={localName(c)}
                >
                  {c.code}
                </button>
              )
            })}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('binder.frequency')}>
            <NativeSelect value={form.bordereau_frequency} onChange={set('bordereau_frequency')}>
              <option value="monthly">{t('binder.freq.monthly')}</option>
              <option value="quarterly">{t('binder.freq.quarterly')}</option>
            </NativeSelect>
          </Field>
          <Field label={t('binder.dueDays')} hint={t('binder.dueDaysHint')} error={err('bordereau_due_days')}>
            <DecimalInput kind="int" className="text-right tabular-nums" value={form.bordereau_due_days} onChange={set('bordereau_due_days')} />
          </Field>
          <fieldset className="grid content-start gap-2">
            <legend className="text-small font-medium">{t('binder.kindsOwed')}</legend>
            {BORDEREAU_KINDS.map((k) => (
              <label key={k} className="flex items-center gap-2 text-body">
                <input type="checkbox" checked={form.bordereau_kinds.includes(k)} onChange={() => setForm((f) => ({ ...f, bordereau_kinds: toggle(f.bordereau_kinds, k) }))} />
                {t(`binder.kind.${k}`)}
              </label>
            ))}
          </fieldset>
        </div>

        <Field label={t('fields.notes')}>
          <Textarea rows={2} value={form.notes} onChange={set('notes')} />
        </Field>

        {error && <p role="alert" className="rounded-md bg-danger-100 p-3 text-body text-danger-700">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {binder ? t('common.save') : t('binder.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
