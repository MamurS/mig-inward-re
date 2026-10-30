import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowRightLeft, Plus, Trash2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Badge } from '@/components/ui/badge'
import { AgingBadge } from '@/components/AgingBadge'
import { formatAmount, formatDate } from '@/lib/format'
import { cleanDecimal, isDecimal } from '@/lib/decimal'
import { cn } from '@/lib/utils'
import type { InstallmentRow, NewAllocation } from './api'
import { autoAllocate, checkRate, convert, inverseRate, maxFor, referenceRate, total, trimRate } from './receipts'

export type AllocDraft = { installmentId: string; amount: string; rate: string }

/** Validation for one draft row: the problem (i18n key) or null. */
function rowProblem(d: AllocDraft, inst: InstallmentRow | undefined, receiptCcy: string): string | null {
  if (!inst) return 'rcp.err.gone'
  if (!d.amount.trim()) return 'rcp.err.amount'
  if (!isDecimal(d.amount, 2) || Number(cleanDecimal(d.amount)) <= 0) return 'rcp.err.amount'
  const cross = inst.currency !== receiptCcy
  const rate = cross ? d.rate : '1'
  if (cross && (!isDecimal(d.rate, 10) || Number(cleanDecimal(d.rate)) <= 0)) return 'rcp.err.rate'
  const converted = convert(cleanDecimal(d.amount), cleanDecimal(rate))
  if (converted === null || Number(converted) > Number(inst.outstanding_amount ?? 0)) return 'rcp.err.overInstallment'
  return null
}

/** Draft rows → what the database takes (null when anything is invalid). */
export function draftsToAllocations(drafts: AllocDraft[], installments: InstallmentRow[], receiptCcy: string): NewAllocation[] | null {
  const byId = new Map(installments.map((i) => [i.id!, i]))
  const out: NewAllocation[] = []
  for (const d of drafts) {
    const inst = byId.get(d.installmentId)
    if (rowProblem(d, inst, receiptCcy)) return null
    out.push({ installment_id: d.installmentId, amount: cleanDecimal(d.amount), fx_rate: inst!.currency === receiptCcy ? null : cleanDecimal(d.rate) })
  }
  return out
}

export function allocatedTotal(drafts: AllocDraft[]) {
  return total(drafts.map((d) => (isDecimal(d.amount, 2) ? cleanDecimal(d.amount) : '0')))
}

/**
 * Which installments a receipt pays. For each one: the amount in the receipt's
 * currency and — across currencies — the rate, with the converted amount and
 * the rate both ways shown live, so an inverted rate is obvious before saving.
 * The payer's open installments come first (oldest due first); any other open
 * installment can be added.
 */
export function AllocationEditor({
  currency,
  amount,
  payerId,
  rates,
  installments,
  value,
  onChange,
}: {
  currency: string
  /** what this receipt still has to allocate (receipt currency) */
  amount: string
  payerId: string
  /** USD rates on the received date (reference cross rates) */
  rates: Record<string, number | null> | undefined
  installments: InstallmentRow[]
  value: AllocDraft[]
  onChange: (v: AllocDraft[]) => void
}) {
  const { t } = useTranslation()
  const byId = useMemo(() => new Map(installments.map((i) => [i.id!, i])), [installments])
  const reference = (ccy: string) => referenceRate(currency, ccy, (c) => rates?.[c] ?? null)
  const fromPayer = installments.filter((i) => i.mga_id === payerId || i.broker_id === payerId)
  const chosen = new Set(value.map((d) => d.installmentId))
  const others = installments.filter((i) => !chosen.has(i.id!) && !fromPayer.includes(i))
  const suggestions = fromPayer.filter((i) => !chosen.has(i.id!))

  const add = (inst: InstallmentRow) => onChange([...value, { installmentId: inst.id!, amount: '', rate: inst.currency === currency ? '1' : (reference(inst.currency!) ?? '') }])
  const set = (i: number, patch: Partial<AllocDraft>) => onChange(value.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i))

  const used = allocatedTotal(value)
  const left = (Number(cleanDecimal(amount || '0')) - Number(used)).toFixed(2)
  const over = Number(left) < 0
  /** what this row could take: what is left plus what it already has */
  const room = (d: AllocDraft) => Math.max(0, Number(left) + (isDecimal(d.amount, 2) ? Number(cleanDecimal(d.amount)) : 0))

  function autoFill() {
    // the payer's installments (oldest due first), then those already added
    const order = [...value.map((d) => byId.get(d.installmentId)!).filter(Boolean), ...suggestions]
    const rows = order.map((inst) => {
      const draft = value.find((d) => d.installmentId === inst.id)
      const rate = inst.currency === currency ? '1' : (draft?.rate || reference(inst.currency!))
      return { id: inst.id!, outstanding: String(inst.outstanding_amount ?? 0), rate: rate && isDecimal(rate, 10) ? cleanDecimal(rate) : null }
    })
    const amounts = autoAllocate(cleanDecimal(amount || '0'), rows)
    onChange(
      order
        .filter((inst) => amounts[inst.id!] || value.some((d) => d.installmentId === inst.id))
        .map((inst) => {
          const draft = value.find((d) => d.installmentId === inst.id)
          const rate = inst.currency === currency ? '1' : (draft?.rate || reference(inst.currency!) || '')
          return { installmentId: inst.id!, amount: amounts[inst.id!] ?? draft?.amount ?? '', rate }
        }),
    )
  }

  return (
    <section className="grid gap-3" aria-label={t('rcp.allocate')}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-body font-semibold">{t('rcp.allocate')}</h3>
          <p className="text-small text-muted-foreground">{t('rcp.allocateHint')}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={autoFill} disabled={!(Number(cleanDecimal(amount || '0')) > 0) || (!suggestions.length && !value.length)}>
          <Wand2 />
          {t('rcp.autoAllocate')}
        </Button>
      </div>

      {value.length === 0 && (
        <p className="rounded-lg border border-dashed px-4 py-3 text-small text-muted-foreground">{suggestions.length ? t('rcp.noneYet') : t('rcp.noOpenForPayer')}</p>
      )}

      {value.map((d, i) => {
        const inst = byId.get(d.installmentId)
        if (!inst) return null
        const cross = inst.currency !== currency
        const rate = cross ? d.rate : '1'
        const okRate = cross && isDecimal(rate, 10) && Number(cleanDecimal(rate)) > 0
        const converted = isDecimal(d.amount, 2) && (!cross || okRate) ? convert(cleanDecimal(d.amount), cleanDecimal(rate)) : null
        const ref = cross ? reference(inst.currency!) : null
        const check = okRate ? checkRate(cleanDecimal(rate), ref) : null
        const problem = d.amount ? rowProblem(d, inst, currency) : null
        const max = !cross || okRate ? maxFor(String(inst.outstanding_amount ?? 0), cleanDecimal(rate)) : null
        return (
          <div key={d.installmentId} className="grid gap-3 rounded-xl border p-4" data-allocation-row>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-medium">
                  <span className="num">{inst.ref_no}</span> · {inst.insured_name} · #{inst.installment_no}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-small text-muted-foreground">
                  <span>{t('prem.dueDate')}: {formatDate(inst.due_date)}</span>
                  {(inst.days_overdue ?? 0) > 0 && <AgingBadge days={inst.days_overdue!} />}
                  <span className="num">{t('rcp.outstanding')}: {formatAmount(inst.outstanding_amount)} {inst.currency}</span>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={t('rcp.removeRow')} title={t('rcp.removeRow')} onClick={() => remove(i)}>
                <Trash2 />
              </Button>
            </div>

            <div className={cn('grid gap-3', cross && 'sm:grid-cols-2')}>
              <label className="grid gap-1">
                <span className="text-small font-medium">{t('rcp.allocAmount', { ccy: currency })}</span>
                <div className="flex gap-2">
                  <Input inputMode="decimal" className="text-right num" value={d.amount} onChange={(e) => set(i, { amount: e.target.value })} aria-invalid={Boolean(problem) || undefined} />
                  {max && (
                    <Button type="button" variant="outline" onClick={() => set(i, { amount: Math.min(Number(max), room(d)).toFixed(2) })}>
                      {t('rcp.max')}
                    </Button>
                  )}
                </div>
              </label>
              {cross && (
                <label className="grid gap-1">
                  <span className="text-small font-medium">{t('rcp.rate', { to: inst.currency, from: currency })}</span>
                  <div className="flex gap-2">
                    <Input inputMode="decimal" className="text-right num" value={d.rate} onChange={(e) => set(i, { rate: e.target.value })} aria-invalid={check === 'inverted' || check === 'far' || undefined} />
                    {ref && cleanDecimal(d.rate) !== ref && (
                      <Button type="button" variant="outline" onClick={() => set(i, { rate: ref })} title={t('rcp.useReference')}>
                        {t('rcp.useReferenceShort')}
                      </Button>
                    )}
                  </div>
                </label>
              )}
            </div>

            {/* the live preview: what lands on the installment, and the rate both ways */}
            {cross && (
              <div className="grid gap-1 rounded-lg bg-muted px-3 py-2 text-small" data-fx-preview>
                <div className="flex flex-wrap items-center gap-x-2 font-medium num">
                  <span>{formatAmount(isDecimal(d.amount, 2) ? cleanDecimal(d.amount) : null)} {currency}</span>
                  <ArrowRightLeft className="size-3.5 text-muted-foreground" aria-hidden />
                  <span>{converted ? `${formatAmount(converted)} ${inst.currency}` : '—'}</span>
                </div>
                {okRate && (
                  <div className="text-muted-foreground num">
                    1 {currency} = {trimRate(cleanDecimal(rate))} {inst.currency} · 1 {inst.currency} = {inverseRate(cleanDecimal(rate))} {currency}
                  </div>
                )}
                {ref && <div className="text-muted-foreground num">{t('rcp.reference', { rate: `1 ${currency} = ${ref} ${inst.currency}` })}</div>}
                {check === 'inverted' && (
                  <p role="alert" className="flex items-start gap-1 font-medium text-danger-700">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    {t('rcp.inverted', { to: inst.currency, from: currency })}
                  </p>
                )}
                {check === 'far' && (
                  <p role="alert" className="flex items-start gap-1 font-medium text-warning-700">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    {t('rcp.far')}
                  </p>
                )}
              </div>
            )}
            {problem && <p className="text-small text-danger-700">{t(problem, { ccy: inst.currency, max: formatAmount(inst.outstanding_amount) })}</p>}
          </div>
        )
      })}

      {(suggestions.length > 0 || others.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {suggestions.slice(0, 6).map((inst) => (
            <Button key={inst.id} type="button" variant="outline" size="sm" onClick={() => add(inst)} className="max-w-full">
              <Plus />
              <span className="truncate num" title={`${inst.ref_no} #${inst.installment_no}`}>{inst.ref_no} #{inst.installment_no}</span>
              <span className="text-muted-foreground num">{formatAmount(inst.outstanding_amount)} {inst.currency}</span>
            </Button>
          ))}
          {others.length > 0 && (
            <div className="w-full sm:w-80">
              <NativeSelect
                aria-label={t('rcp.addOther')}
                value=""
                onChange={(e) => {
                  const inst = byId.get(e.target.value)
                  if (inst) add(inst)
                }}
              >
                <option value="">{t('rcp.addOther')}</option>
                {others.map((inst) => (
                  <option key={inst.id} value={inst.id!}>
                    {inst.ref_no} #{inst.installment_no} · {inst.insured_name} · {formatAmount(inst.outstanding_amount)} {inst.currency}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
        </div>
      )}

      <div className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-2 text-small num', over && 'border-danger-200 bg-danger-50')} data-allocation-total>
        <span>
          {t('rcp.allocated')}: <strong>{formatAmount(used)} {currency}</strong>
        </span>
        <span className={over ? 'font-medium text-danger-700' : Number(left) > 0 ? 'text-warning-700' : 'text-success-700'}>
          {over ? t('rcp.overReceipt', { amount: `${formatAmount(Math.abs(Number(left)))} ${currency}` }) : Number(left) > 0 ? t('rcp.leftUnallocated', { amount: `${formatAmount(left)} ${currency}` }) : t('rcp.fullyAllocated')}
        </span>
      </div>
      {value.some((d) => byId.get(d.installmentId)?.currency !== currency) && !rates && <Badge tone="warning">{t('rcp.noReference')}</Badge>}
    </section>
  )
}
