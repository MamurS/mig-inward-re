import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, Banknote, Pencil, Plus, RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/Skeleton'
import { Amount } from '@/components/Amount'
import { EmptyState } from '@/components/EmptyState'
import { useAuth } from '@/auth/AuthProvider'
import { can } from '@/lib/roles'
import { CLAIM_DOC_TYPES, CLAIM_NEXT } from '@/lib/status'
import { formatAmount, formatDate, formatDateTime, formatHuman, formatPct } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import { useUsers, userName } from '@/hooks/useReference'
import { useAuditLog, useEntityDocuments, useEntityFollowUps } from '@/features/submissions/api'
import { DocumentsPanel } from '@/features/documents/DocumentsPanel'
import { AddFollowUpButton, CloseFollowUpDialog, FollowUpItem, RescheduleFollowUpDialog, type FollowUp } from '@/features/followups/FollowUps'
import { useClaim, useClaimMovements, type ClaimStatus } from './api'
import { ClaimStatusBadge, LargeLossBadge } from './ClaimStatusBadge'
import { ClaimStatusDialog, EditClaimDialog, PaymentDialog, RecoveryDialog, ReserveDialog } from './ClaimDialogs'

/** One claim: who / what / where, our money (reserves, payments, recoveries), follow-ups, documents, timeline. */
export function ClaimDetailPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const { role } = useAuth()
  const users = useUsers()
  const claim = useClaim(id)
  const moves = useClaimMovements(id)
  const followUps = useEntityFollowUps('claim', id)
  const docs = useEntityDocuments('claim', id)
  const audit = useAuditLog('claims', id)
  const [statusTo, setStatusTo] = useState<ClaimStatus | null>(null)
  const [dialog, setDialog] = useState<'reserve' | 'payment' | 'recovery' | 'edit' | null>(null)
  const [closing, setClosing] = useState<FollowUp | null>(null)
  const [rescheduling, setRescheduling] = useState<FollowUp | null>(null)
  const usersById = new Map(users.data?.map((u) => [u.id, u]))

  // reserve history: outstanding and paid over time (one point per movement day)
  const chart = useMemo(() => {
    if (!moves.data) return []
    const days = new Map<string, { reserve: number; paid: number }>()
    for (const r of moves.data.reserves) days.set(r.movement_date, { reserve: (days.get(r.movement_date)?.reserve ?? 0) + Number(r.amount), paid: days.get(r.movement_date)?.paid ?? 0 })
    for (const p of moves.data.payments) days.set(p.payment_date!, { reserve: days.get(p.payment_date!)?.reserve ?? 0, paid: (days.get(p.payment_date!)?.paid ?? 0) + Number(p.amount) })
    let reserves = 0
    let paid = 0
    return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => {
      reserves += d.reserve
      paid += d.paid
      return { date: formatDate(date), outstanding: Math.round((reserves - paid) * 100) / 100, paid: Math.round(paid * 100) / 100 }
    })
  }, [moves.data])

  if (claim.isLoading) return <Skeleton className="h-96 rounded-xl" />
  if (claim.error) return <p className="p-6 text-body text-destructive">{errorMessage(claim.error)}</p>
  if (!claim.data) return <p className="p-6 text-body text-muted-foreground">{t('claim.notFound')}</p>
  const c = claim.data
  const manage = can.manageClaims(role)
  const live = c.status !== 'closed' && c.status !== 'declined'
  const ccy = c.currency ?? ''
  // USD under the figure only for a claim in another currency (none without a rate)
  const usd = (v: number | null) => (ccy === 'USD' || v === null ? null : <span className="text-caption text-muted-foreground"><Amount value={v} currency="USD" /></span>)

  const facts: { label: string; value: ReactNode; sub?: ReactNode }[] = [
    { label: t('claim.ourSharePct'), value: formatPct(c.signed_share_pct), sub: t('claim.signedLineAtDol') },
    { label: t('claim.estimateOurShare'), value: <Amount value={c.estimate_our_share} />, sub: c.estimate_100 !== null ? t('claim.of100', { amount: formatAmount(c.estimate_100) }) : undefined },
    { label: t('claim.outstanding'), value: <Amount value={c.outstanding} />, sub: usd(c.outstanding_usd) },
    { label: t('claim.paid'), value: <Amount value={c.paid_total} />, sub: usd(c.paid_usd) },
    { label: t('claim.recoveries'), value: <Amount value={c.recoveries_total} />, sub: usd(c.recoveries_usd) },
    { label: t('claim.incurred'), value: <Amount value={c.incurred} />, sub: usd(c.incurred_usd) },
  ]

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: t('pages.claims.title'), to: '/claims' }, { label: c.claim_no ?? '' }]}
        title={c.insured_name ?? c.claim_no ?? ''}
        subtitle={[c.claim_no, c.mga_name, c.lob_name, ccy].filter(Boolean).join(' · ')}
        actions={
          <>
            {manage && CLAIM_NEXT[c.status!].map((s) => (
              <Button key={s} variant={s === 'declined' ? 'outline' : 'default'} onClick={() => setStatusTo(s)}>
                {s === 'reopened' && <RotateCcw />}
                {t(`claim.to.${s}`)}
              </Button>
            ))}
            {manage && <Button variant="outline" onClick={() => setDialog('edit')}><Pencil />{t('claim.edit')}</Button>}
          </>
        }
      />

      {/* who, what, our money */}
      <Card className="mb-4 gap-0 py-0" data-claim-header>
        <CardContent className="grid gap-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <ClaimStatusBadge status={c.status} />
            {c.large_loss && <LargeLossBadge />}
            {c.cash_call_due_at && <Badge tone="warning"><Banknote />{t('claim.cashCallDueOn', { date: formatDate(c.cash_call_due_at) })}</Badge>}
            {c.fx_rate_to_usd === null && <Badge tone="warning" title={t('rcv.noRate')}>{t('claim.noRateBadge', { ccy })}</Badge>}
          </div>
          <dl className="grid grid-cols-2 gap-y-4 md:grid-cols-3 xl:grid-cols-6 xl:divide-x">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0 xl:px-5 xl:first:pl-0">
                <dt className="text-caption font-medium text-muted-foreground">{f.label}{f.label !== t('claim.ourSharePct') && <span className="ml-1">{ccy}</span>}</dt>
                <dd className="mt-1 font-display-bold text-title num">{f.value}</dd>
                {f.sub && <dd className="text-caption text-muted-foreground">{f.sub}</dd>}
              </div>
            ))}
          </dl>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t pt-4 text-body md:grid-cols-4">
            <Info label={t('claim.dateOfLoss')}>{formatDate(c.date_of_loss)}</Info>
            <Info label={t('claim.notifiedDate')}>{formatDate(c.notified_date)}</Info>
            <Info label={t('claim.risk')}><Link to={`/submissions/${c.submission_id}`} className="text-link num hover:underline">{c.ref_no}</Link><span className="block text-caption text-muted-foreground">{formatDate(c.period_from)} – {formatDate(c.period_to)}</span></Info>
            <Info label={t('claim.handler')}>{c.handler_name ?? '—'}</Info>
            <Info label={t('claim.cause')}>{c.cause ?? '—'}</Info>
            <Info label={t('claim.location')}>{c.location ?? '—'}</Info>
            <Info label={t('claim.cedentRef')}><span className="num">{c.cedent_claim_ref ?? '—'}</span></Info>
            <Info label={t('fields.underwriter')}>{c.underwriter_name ?? '—'}</Info>
            {c.description && <Info label={t('claim.description')} className="col-span-2 md:col-span-4">{c.description}</Info>}
            {c.decline_reason && <Info label={t('claim.declineReason')} className="col-span-2 md:col-span-4">{c.decline_reason}</Info>}
            {c.close_comment && <Info label={t('claim.closeComment')} className="col-span-2 md:col-span-4">{c.close_comment}</Info>}
          </dl>
          {(c.coverage_issues?.length ?? 0) > 0 && (
            <div className="rounded-md border border-warning-300 bg-warning-50 p-3 text-body text-warning-800" data-coverage-note>
              <p className="inline-flex items-center gap-2 font-medium"><AlertTriangle className="size-4" />{t('claim.coverageAccepted')}</p>
              <ul className="mt-1 list-disc pl-6">
                {c.coverage_issues!.map((i) => <li key={i}>{t(`claim.coverage.${i}`, { from: formatDate(c.period_from), to: formatDate(c.period_to), ccy })}</li>)}
              </ul>
              {c.coverage_comment && <p className="mt-1">«{c.coverage_comment}»</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 content-start gap-4">
          {/* reserves: chart + movements */}
          <Card className="gap-0 py-0">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-4">
              <CardTitle>{t('claim.reserves')}</CardTitle>
              {manage && live && <Button size="sm" onClick={() => setDialog('reserve')}><Plus />{t('claim.addReserve')}</Button>}
            </CardHeader>
            {chart.length > 1 && (
              <div className="border-t px-4 pt-4" role="img" aria-label={t('claim.reserveHistory')}>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chart} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-slate-200)" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--color-slate-600)' }} />
                    <YAxis tickFormatter={(v) => formatHuman(v as number)} tickLine={false} axisLine={false} width={80} tick={{ fontSize: 12, fill: 'var(--color-slate-600)' }} />
                    <Tooltip formatter={(v, n) => [`${formatAmount(v as number)} ${ccy}`, n === 'outstanding' ? t('claim.outstanding') : t('claim.paid')]} />
                    <Line type="stepAfter" dataKey="outstanding" stroke="var(--color-brand-600)" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="stepAfter" dataKey="paid" stroke="var(--color-success-600)" strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <MovementTable
              empty={t('claim.noReserves')}
              head={[t('claim.movementDate'), t('claim.reason'), t('claim.amountCcy', { ccy }), t('claim.enteredBy')]}
              rows={(moves.data?.reserves ?? []).map((r) => ({
                key: r.id,
                cells: [formatDate(r.movement_date), r.reason, <span className={Number(r.amount) < 0 ? 'text-danger-700' : ''}>{formatAmount(r.amount)}</span>, r.entered_by ? userName(usersById.get(r.entered_by)) : '—'],
              }))}
            />
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-4">
              <CardTitle>{t('claim.payments')}</CardTitle>
              {can.payClaims(role) && live && <Button size="sm" onClick={() => setDialog('payment')}><Plus />{t('claim.recordPayment')}</Button>}
            </CardHeader>
            <MovementTable
              empty={t('claim.noPayments')}
              head={[t('claim.paymentDate'), t('claim.paymentType'), t('claim.paymentMethod'), t('claim.payee'), t('claim.amountCcy', { ccy })]}
              rows={(moves.data?.payments ?? []).map((p) => ({
                key: p.id!,
                cells: [
                  formatDate(p.payment_date),
                  t(`claim.paymentTypes.${p.type}`),
                  p.method === 'offset_against_premium' ? (
                    <span>
                      {t('claim.method.offset_against_premium')}{' '}
                      {p.offset_receipt_no && <Link to={`/receipts?q=${encodeURIComponent(p.offset_receipt_no)}`} className="text-link num hover:underline">{p.offset_receipt_no}</Link>}
                    </span>
                  ) : (
                    <span>{t('claim.method.cash')}{p.bank_reference && <span className="block text-caption text-muted-foreground">{p.bank_reference}</span>}</span>
                  ),
                  p.payee_name ?? '—',
                  formatAmount(p.amount),
                ],
              }))}
            />
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-4">
              <CardTitle>{t('claim.recoveries')}</CardTitle>
              {manage && <Button size="sm" variant="outline" onClick={() => setDialog('recovery')}><Plus />{t('claim.addRecovery')}</Button>}
            </CardHeader>
            <MovementTable
              empty={t('claim.noRecoveries')}
              head={[t('claim.recoveryDate'), t('claim.recoveryType'), t('fields.notes'), t('claim.amountCcy', { ccy })]}
              rows={(moves.data?.recoveries ?? []).map((r) => ({ key: r.id, cells: [formatDate(r.recovery_date), t(`claim.recovery.${r.type}`), r.notes ?? '—', formatAmount(r.amount)] }))}
            />
          </Card>

          <Card>
            <CardContent>
              <Tabs defaultValue="documents">
                <TabsList>
                  <TabsTrigger value="documents">{t('sub.tabs.documents')} ({docs.data?.length ?? 0})</TabsTrigger>
                  <TabsTrigger value="changes">{t('sub.tabs.changes')}</TabsTrigger>
                </TabsList>
                <TabsContent value="documents">
                  <DocumentsPanel entityType="claim" entityId={c.id!} documents={docs.data ?? []} canWrite={manage} docTypes={CLAIM_DOC_TYPES} />
                </TabsContent>
                <TabsContent value="changes">
                  {audit.data?.length ? (
                    <ul className="grid gap-3 text-body" data-claim-timeline>
                      {audit.data.map((a) => {
                        const n = a.new_data as Record<string, unknown> | null
                        const o = a.old_data as Record<string, unknown> | null
                        return (
                          <li key={a.id} className="border-b pb-2 last:border-0">
                            <div className="text-caption text-muted-foreground">
                              {formatDateTime(a.changed_at)} · {a.changed_by ? userName(usersById.get(a.changed_by)) : t('sub.system')} · {t(`audit.${a.action}`)}
                            </div>
                            {a.action === 'UPDATE' && a.changed_fields?.filter((f) => !['updated_at', 'updated_by', 'status_changed_at'].includes(f)).map((f) => (
                              <div key={f} className="text-caption">
                                <span className="font-medium">{t(`auditField.${f}`, { defaultValue: f })}</span>:{' '}
                                <span className="text-muted-foreground line-through">{String(o?.[f] ?? '—')}</span> → <span>{f === 'status' ? t(`claim.status.${n?.[f]}`) : String(n?.[f] ?? '—')}</span>
                              </div>
                            ))}
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="py-4 text-center text-body text-muted-foreground">{t('sub.noChanges')}</p>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle>{t('fu.title')}</CardTitle>
              {manage && (
                <AddFollowUpButton entityType="claim" entityId={c.id!} defaultAssignee={c.handler_id} types={['awaiting_documents', 'cash_call_due', 'other']} teams={['finance', 'claims']} />
              )}
            </CardHeader>
            <CardContent className="grid gap-2">
              {!followUps.data?.length && <p className="text-body text-muted-foreground">{t('fu.none')}</p>}
              {followUps.data?.map((f) => <FollowUpItem key={f.id} followUp={f} onDone={setClosing} onReschedule={setRescheduling} />)}
            </CardContent>
          </Card>
        </div>
      </div>

      <ClaimStatusDialog claim={c} to={statusTo} onClose={() => setStatusTo(null)} />
      <ReserveDialog claim={c} open={dialog === 'reserve'} onClose={() => setDialog(null)} />
      <PaymentDialog claim={c} open={dialog === 'payment'} onClose={() => setDialog(null)} />
      <RecoveryDialog claim={c} open={dialog === 'recovery'} onClose={() => setDialog(null)} />
      <EditClaimDialog claim={c} open={dialog === 'edit'} onClose={() => setDialog(null)} />
      <CloseFollowUpDialog followUp={closing} onClose={() => setClosing(null)} />
      <RescheduleFollowUpDialog followUp={rescheduling} onClose={() => setRescheduling(null)} />
    </>
  )
}

function Info({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}

/** A small table of movements; the last column is money (right-aligned). */
function MovementTable({ head, rows, empty }: { head: string[]; rows: { key: string; cells: ReactNode[] }[]; empty: string }) {
  if (rows.length === 0) return <EmptyState pictogram="inbox" title={empty} compact />
  return (
    <div className="overflow-x-auto border-t">
      <table className="w-full text-table">
        <thead>
          <tr className="border-b text-small text-muted-foreground">
            {head.map((h, i) => <th key={h} className={`h-11 px-4 text-left font-medium whitespace-nowrap ${i === head.length - 1 ? 'text-right' : ''}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="h-12 border-b last:border-0">
              {r.cells.map((cell, i) => <td key={i} className={`px-4 py-2 align-middle ${i === r.cells.length - 1 ? 'text-right whitespace-nowrap num' : ''}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
