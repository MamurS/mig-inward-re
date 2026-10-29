import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Ban, CalendarPlus, CheckCircle2, MoreHorizontal, RefreshCw, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AgingBadge } from '@/components/AgingBadge'
import { Amount } from '@/components/Amount'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { useAuth } from '@/auth/AuthProvider'
import { can } from '@/lib/roles'
import { formatAmount, formatDate, formatDateTime, formatPct } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { SubmissionRow } from '@/features/submissions/api'
import { useCanEditSchedule, useInstallmentAllocations, useInvalidatePremium, usePremiumInstallments, useScheduleCheck, type InstallmentRow } from './api'
import { isZeroMoney, sumMoney } from './schedule'
import { ScheduleEditor } from './ScheduleEditor'
import { AdjustmentDialog, SettleReturnDialog, undoWriteOff, WriteOffDialog } from './InstallmentDialogs'

const STATUS_TONE: Record<string, BadgeTone> = { open: 'info', partially_paid: 'warning', paid: 'success', written_off: 'neutral' }

/** The installment's status in words: return premium reads «to pay / settled». */
function statusKey(i: InstallmentRow) {
  if (i.type === 'return') return i.status === 'paid' ? 'settled' : i.status === 'written_off' ? 'written_off' : 'to_pay'
  return i.status ?? 'open'
}

/**
 * Premium on the submission page: what is expected, how it is scheduled,
 * what has been paid, what is outstanding (receivable) and — separately —
 * what we owe the MGA (return premium, payable). Never netted together.
 */
export function PremiumTab({ submission: s, startEditor = false, onEditorStarted }: { submission: SubmissionRow; startEditor?: boolean; onEditorStarted?: () => void }) {
  const { t } = useTranslation()
  const { role } = useAuth()
  const canEdit = useCanEditSchedule()(s.underwriter_id)
  const finance = can.manageFinance(role)
  const invalidate = useInvalidatePremium()
  const installments = usePremiumInstallments(s.id ?? undefined)
  const check = useScheduleCheck(s.id ?? undefined, s.status === 'bound')
  const rows = installments.data ?? []
  const allocations = useInstallmentAllocations(rows.map((r) => r.id!).filter(Boolean))

  const [editor, setEditor] = useState(false)
  const [adjust, setAdjust] = useState<'additional' | 'return' | null>(null)
  const [writeOff, setWriteOff] = useState<InstallmentRow | null>(null)
  const [settle, setSettle] = useState<InstallmentRow | null>(null)

  // Right after binding the page asks for the schedule step
  useEffect(() => {
    if (startEditor && installments.data && canEdit) {
      if (!installments.data.some((r) => r.type === 'original')) setEditor(true)
      onEditorStarted?.()
    }
  }, [startEditor, installments.data, canEdit, onEditorStarted])

  if (installments.isLoading) return <div className="grid gap-3 pt-2"><Skeleton className="h-20 rounded-lg" /><Skeleton className="h-40 rounded-lg" /></div>
  if (installments.error) return <p className="py-4 text-body text-destructive">{errorMessage(installments.error)}</p>

  const originals = rows.filter((r) => r.type === 'original')
  const hasSchedule = originals.length > 0
  const allocated = originals.some((r) => Number(r.paid_amount) > 0 || r.status === 'written_off')
  const c = check.data
  const receivable = sumMoney(rows.map((r) => r.outstanding_amount))
  const payable = sumMoney(rows.map((r) => r.payable_amount))
  const paid = sumMoney(rows.map((r) => r.paid_amount))
  const maxOverdue = Math.max(0, ...rows.map((r) => r.days_overdue ?? 0))
  const ccy = s.currency

  async function undo(i: InstallmentRow) {
    try {
      await undoWriteOff(i.id!)
      await invalidate()
      toast.success(t('prem.writeOffUndone', { no: i.installment_no }))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div className="grid gap-4 pt-2">
      {/* Summary: expected vs scheduled, receivable and payable side by side — never netted */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg bg-muted p-4 md:grid-cols-3">
        <div>
          <dt className="text-caption text-muted-foreground">{t('prem.expectedNet')}</dt>
          <dd className="font-semibold num"><Amount value={c?.expected_net} currency={ccy} /></dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">{t('prem.scheduledNet')}</dt>
          <dd className="font-semibold num"><Amount value={c?.scheduled_net} currency={ccy} /></dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">{t('prem.difference')}</dt>
          <dd className={cn('font-semibold num', c && !isZeroMoney(c.difference) && hasSchedule && 'text-warning-700')}>
            {hasSchedule ? <Amount value={c?.difference} currency={ccy} /> : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">{t('prem.paid')}</dt>
          <dd className="font-semibold num"><Amount value={paid} currency={ccy} /></dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">{t('prem.receivable')}</dt>
          <dd className={cn('font-semibold num', maxOverdue > 0 && 'text-danger-700')}>
            <Amount value={receivable} currency={ccy} />
            {maxOverdue > 0 && <AgingBadge days={maxOverdue} className="ml-2 align-middle" />}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">{t('prem.payableToMga')}</dt>
          <dd className="font-semibold num"><Amount value={payable} currency={ccy} /></dd>
        </div>
      </dl>

      {c?.basis_mismatch && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-warning-200 bg-warning-100 p-3 text-body text-warning-700">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">
            {t('prem.mismatch', { was: formatPct(originals[0]?.basis_signed_share_pct), now: formatPct(s.signed_share_pct) })}
            {allocated && ` ${t('prem.mismatchAllocated')}`}
          </span>
          {canEdit && !allocated && (
            <Button size="sm" variant="outline" onClick={() => setEditor(true)}>
              <RefreshCw />
              {t('prem.regenerate')}
            </Button>
          )}
        </div>
      )}

      {!hasSchedule && rows.length === 0 ? (
        <EmptyState
          pictogram="documents"
          title={t('prem.noSchedule')}
          action={canEdit && s.status === 'bound' ? <Button onClick={() => setEditor(true)}><CalendarPlus />{t('prem.createSchedule')}</Button> : undefined}
        >
          {s.status === 'bound' ? t('prem.noScheduleHint') : t('prem.onlyBound')}
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canEdit && s.status === 'bound' && (
              <>
                {!hasSchedule && <Button size="sm" onClick={() => setEditor(true)}><CalendarPlus />{t('prem.createSchedule')}</Button>}
                {hasSchedule && !allocated && (
                  <Button size="sm" variant="outline" onClick={() => setEditor(true)}><RefreshCw />{t('prem.regenerate')}</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setAdjust('additional')}>{t('prem.addAdditional')}</Button>
                <Button size="sm" variant="outline" onClick={() => setAdjust('return')}>{t('prem.addReturn')}</Button>
              </>
            )}
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b bg-muted text-caption text-muted-foreground">
                  <th className="px-2 py-2 text-left font-medium">#</th>
                  <th className="px-2 py-2 text-left font-medium">{t('prem.type')}</th>
                  <th className="px-2 py-2 text-left font-medium">{t('prem.dueDate')}</th>
                  <th className="px-2 py-2 text-right font-medium">{t('prem.net')}</th>
                  <th className="px-2 py-2 text-right font-medium">{t('prem.paid')}</th>
                  <th className="px-2 py-2 text-right font-medium">{t('prem.leftToSettle')}</th>
                  <th className="px-2 py-2 text-left font-medium">{t('fields.status')}</th>
                  <th className="w-px px-2 py-2"><span className="sr-only">{t('ui.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => {
                  const isReturn = i.type === 'return'
                  const left = isReturn ? i.payable_amount : i.outstanding_amount
                  const actions = finance && (
                    (!isReturn && i.status !== 'written_off' && i.status !== 'paid') ||
                    (isReturn && i.status === 'open') ||
                    i.status === 'written_off'
                  )
                  return (
                    <tr key={i.id} className={cn('border-b align-top last:border-0', i.status === 'written_off' && 'text-muted-foreground')}>
                      <td className="px-2 py-2 num">{i.installment_no}</td>
                      <td className="px-2 py-2">
                        <Badge tone={isReturn ? 'brand' : i.type === 'additional' ? 'info' : 'neutral'}>{t(`prem.types.${i.type}`)}</Badge>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">{formatDate(i.due_date)}</td>
                      <td className="px-2 py-2 text-right num">
                        <div className="font-medium">{formatAmount(i.net_amount)}</div>
                        <div className="text-caption whitespace-nowrap text-muted-foreground" title={`${t('prem.gross')} − ${t('prem.deductions')}`}>
                          {/* gross − deductions = net (for return premium both are negative: −2,000 + 600 = −1,400) */}
                          {formatAmount(i.gross_amount)} {isReturn ? '+' : '−'} {formatAmount(sumMoney([i.commission_amount, i.brokerage_amount]).replace('-', ''))}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right num">{isReturn ? '—' : formatAmount(i.paid_amount)}</td>
                      <td className={cn('px-2 py-2 text-right font-medium num', !isReturn && (i.days_overdue ?? 0) > 0 && 'text-danger-700')}>
                        {formatAmount(left)}
                        {isReturn && Number(left) > 0 && <div className="text-caption font-normal text-muted-foreground">{t('prem.weOwe')}</div>}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge tone={STATUS_TONE[i.status ?? 'open'] ?? 'neutral'}>{t(`prem.status.${statusKey(i)}`)}</Badge>
                          {(i.days_overdue ?? 0) > 0 && <AgingBadge days={i.days_overdue!} />}
                        </div>
                        {i.status === 'written_off' && (
                          <p className="mt-1 max-w-64 text-caption text-muted-foreground">
                            {t('prem.writtenOffBy', { who: i.written_off_by_name ?? '—', when: formatDateTime(i.written_off_at) })}: {i.written_off_reason}
                          </p>
                        )}
                        {isReturn && i.settled_at && (
                          <p className="mt-1 text-caption text-muted-foreground">{t('prem.settledOn', { date: formatDate(i.settled_at) })}</p>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {actions && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8" aria-label={t('ui.actions')}><MoreHorizontal /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!isReturn && i.status !== 'written_off' && i.status !== 'paid' && (
                                <DropdownMenuItem onSelect={() => setWriteOff(i)}><Ban />{t('prem.writeOff')}</DropdownMenuItem>
                              )}
                              {isReturn && i.status === 'open' && (
                                <DropdownMenuItem onSelect={() => setSettle(i)}><CheckCircle2 />{t('prem.markSettled')}</DropdownMenuItem>
                              )}
                              {i.status === 'written_off' && (
                                <DropdownMenuItem onSelect={() => void undo(i)}><Undo2 />{t('prem.undoWriteOff')}</DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Receipts allocated to this submission */}
          <div className="grid gap-2">
            <h3 className="text-body font-semibold">{t('prem.receipts')}</h3>
            {(allocations.data ?? []).length === 0 ? (
              <p className="text-body text-muted-foreground">{t('prem.noReceipts')}</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {allocations.data!.map((a) => {
                  const inst = rows.find((r) => r.id === a.installment_id)
                  const fx = a.premium_receipts && a.premium_receipts.currency !== inst?.currency
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-body">
                      <span className="font-medium num">{a.premium_receipts?.ref_no}</span>
                      <span className="text-muted-foreground">{formatDate(a.premium_receipts?.received_date)}</span>
                      <span className="text-muted-foreground">→ #{inst?.installment_no}</span>
                      <span className="ml-auto num">
                        {fx && <span className="text-muted-foreground">{formatAmount(a.amount)} {a.premium_receipts?.currency} → </span>}
                        <span className="font-medium">{formatAmount(a.installment_amount)} {inst?.currency}</span>
                      </span>
                      {a.premium_receipts?.bank_reference && <span className="w-full text-caption text-muted-foreground">{a.premium_receipts.bank_reference}</span>}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}

      <ScheduleEditor submission={s} open={editor} replacing={hasSchedule} onClose={() => setEditor(false)} />
      <AdjustmentDialog submission={s} kind={adjust} onClose={() => setAdjust(null)} />
      <WriteOffDialog installment={writeOff} onClose={() => setWriteOff(null)} />
      <SettleReturnDialog installment={settle} onClose={() => setSettle(null)} />
    </div>
  )
}

