import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, FileText, Pencil, Upload } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/Skeleton'
import { Amount } from '@/components/Amount'
import { EmptyState } from '@/components/EmptyState'
import { useAuth } from '@/auth/AuthProvider'
import { can } from '@/lib/roles'
import { formatAmount, formatDate, formatDateTime, formatPct } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import { useLocalName, useUsers, userName } from '@/hooks/useReference'
import { useAuditLog, useEntityDocuments, useEntityFollowUps } from '@/features/submissions/api'
import { DocumentsPanel } from '@/features/documents/DocumentsPanel'
import { AddFollowUpButton, CloseFollowUpDialog, FollowUpItem, RescheduleFollowUpDialog, type FollowUp } from '@/features/followups/FollowUps'
import { usePremiumInstallments } from '@/features/premium/api'
import { STATUS_TONE, statusKey } from '@/features/premium/PremiumTab'
import { useAllClaims } from '@/features/claims/api'
import { ClaimStatusBadge, LargeLossBadge } from '@/features/claims/ClaimStatusBadge'
import { BORDEREAU_KINDS, useBinder, useBinderPeriods, useBordereaux, useBordereauLines, type BordereauKind, type BordereauRow, type PeriodRow } from './api'
import { BinderStatusBadge, CapacityBar, PeriodStateBadge } from './BinderBadges'
import { BinderDialog } from './BinderDialog'
import { BordereauWizard } from './BordereauWizard'

/** One binder: its terms, capacity, the bordereaux owed per period, and what they brought in (premium, claims, loss ratio). */
export function BinderDetailPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const { role } = useAuth()
  const users = useUsers()
  const localName = useLocalName()
  const q = useBinder(id)
  const periods = useBinderPeriods(id)
  const bordereaux = useBordereaux(id)
  const followUps = useEntityFollowUps('binder', id)
  const docs = useEntityDocuments('binder', id)
  const audit = useAuditLog('binders', id)
  const subId = q.data?.binder.submission_status === 'bound' ? (q.data.binder.submission_id ?? undefined) : undefined
  const installments = usePremiumInstallments(subId)
  const claims = useAllClaims(subId ? { column: 'submission_id', value: subId } : undefined, Boolean(subId))
  const [editing, setEditing] = useState(false)
  const [upload, setUpload] = useState<{ kind?: BordereauKind } | null>(null)
  const [openBdx, setOpenBdx] = useState<BordereauRow | null>(null)
  const [closing, setClosing] = useState<FollowUp | null>(null)
  const [rescheduling, setRescheduling] = useState<FollowUp | null>(null)
  const usersById = new Map(users.data?.map((u) => [u.id, u]))

  // the periods grid: one row per period, one column per kind owed
  const grid = useMemo(() => {
    const byStart = new Map<string, { start: string; end: string; cells: Partial<Record<BordereauKind, PeriodRow>> }>()
    for (const p of periods.data ?? []) {
      const row = byStart.get(p.period_start) ?? { start: p.period_start, end: p.period_end, cells: {} }
      row.cells[p.kind] = p
      byStart.set(p.period_start, row)
    }
    return [...byStart.values()].sort((a, b) => b.start.localeCompare(a.start))
  }, [periods.data])

  if (q.isLoading) return <Skeleton className="h-96 rounded-xl" />
  if (q.error) return <p className="p-6 text-body text-destructive">{errorMessage(q.error)}</p>
  if (!q.data) return <p className="p-6 text-body text-muted-foreground">{t('binder.notFound')}</p>
  const { binder: b, lobs } = q.data
  const ccy = b.currency ?? ''
  const kinds = BORDEREAU_KINDS.filter((k) => b.bordereau_kinds?.includes(k))
  const canUpload = role === 'admin' || role === 'underwriter' || role === 'finance' || role === 'claims'
  const canEdit = can.editSubmissions(role)

  // the binder submission's premium (schedule + premium bordereaux; our share, gross, binder currency) and claims incurred → loss ratio
  const bdxInstallments = (installments.data ?? []).filter((i) => i.currency === ccy)
  const premiumGross = bdxInstallments.reduce((s, i) => s + Number(i.gross_amount ?? 0), 0)
  const premiumNet = bdxInstallments.reduce((s, i) => s + Number(i.net_amount ?? 0), 0)
  const premiumPaid = bdxInstallments.reduce((s, i) => s + Number(i.paid_amount ?? 0), 0)
  const claimRows = claims.data ?? []
  const incurred = claimRows.filter((c) => c.currency === ccy).reduce((s, c) => s + Number(c.incurred ?? 0), 0)
  const lossRatio = premiumGross > 0 ? (incurred / premiumGross) * 100 : null

  const facts: { label: string; value: ReactNode; sub?: ReactNode }[] = [
    { label: t('binder.ourShare'), value: formatPct(b.our_share_pct), sub: t('binder.deductions', { commission: formatPct(b.commission_pct), brokerage: formatPct(b.brokerage_pct) }) },
    { label: t('binder.limitPerRiskCcy', { ccy }), value: b.limit_per_risk === null ? '—' : <Amount value={b.limit_per_risk} />, sub: t('binder.at100') },
    { label: t('binder.aggregateLimitCcy', { ccy }), value: b.aggregate_limit === null ? '—' : <Amount value={b.aggregate_limit} />, sub: t('binder.at100') },
    { label: t('binder.capacityUsedCcy', { ccy }), value: <Amount value={b.capacity_used_100} />, sub: <CapacityBar pct={b.capacity_pct} /> },
    { label: t('binder.premiumCcy', { ccy }), value: <Amount value={premiumGross} />, sub: t('binder.premiumSub', { net: formatAmount(premiumNet), paid: formatAmount(premiumPaid) }) },
    { label: t('binder.lossRatio'), value: lossRatio === null ? '—' : `${lossRatio.toLocaleString(undefined, { maximumFractionDigits: 1 })} %`, sub: t('binder.lossRatioSub', { incurred: formatAmount(incurred), ccy }) },
  ]

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: t('pages.binders.title'), to: '/binders' }, { label: b.binder_ref ?? '' }]}
        title={b.binder_ref ?? ''}
        subtitle={[b.mga_name, `${formatDate(b.period_from)} – ${formatDate(b.period_to)}`, ccy].filter(Boolean).join(' · ')}
        actions={
          <>
            {canUpload && <Button onClick={() => setUpload({})} data-upload-bordereau><Upload />{t('bdx.upload')}</Button>}
            {canEdit && <Button variant="outline" onClick={() => setEditing(true)}><Pencil />{t('common.edit')}</Button>}
          </>
        }
      />

      <Card className="mb-4 gap-0 py-0" data-binder-header>
        <CardContent className="grid gap-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <BinderStatusBadge status={b.status} />
            {(b.capacity_pct ?? 0) >= 100 && <Badge tone="danger" solid><AlertTriangle />{t('binder.capacityFull')}</Badge>}
            {(b.capacity_pct ?? 0) >= 80 && (b.capacity_pct ?? 0) < 100 && <Badge tone="warning"><AlertTriangle />{t('binder.capacityNear')}</Badge>}
            {(b.missing_count ?? 0) > 0 && <Badge tone="danger">{t('binder.missingN', { count: b.missing_count ?? 0 })}</Badge>}
            {(b.late_count ?? 0) > 0 && <Badge tone="warning">{t('binder.lateN', { count: b.late_count ?? 0 })}</Badge>}
            {(b.capacity_missing_rate ?? 0) > 0 && <Badge tone="warning" title={t('rcv.noRate')}>{t('binder.capacityNoRate', { count: b.capacity_missing_rate ?? 0 })}</Badge>}
          </div>
          <dl className="grid grid-cols-2 gap-y-4 md:grid-cols-3 xl:grid-cols-6 xl:divide-x">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0 xl:px-5 xl:first:pl-0">
                <dt className="text-caption font-medium text-muted-foreground">{f.label}</dt>
                <dd className="mt-1 font-display-bold text-title num">{f.value}</dd>
                {f.sub && <dd className="text-caption text-muted-foreground">{f.sub}</dd>}
              </div>
            ))}
          </dl>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t pt-4 text-body md:grid-cols-4">
            <Info label={t('binder.submission')}>
              {b.submission_id ? <Link to={`/submissions/${b.submission_id}`} className="text-link num hover:underline">{b.submission_ref}</Link> : <span className="text-muted-foreground">{t('binder.noSubmission')}</span>}
              {b.submission_status && b.submission_status !== 'bound' && <span className="block text-caption text-warning-700">{t('binder.notBound')}</span>}
            </Info>
            <Info label={t('fields.broker')}>{b.broker_name ?? t('sub.directNoBroker')}</Info>
            <Info label={t('fields.underwriter')}>{b.underwriter_name ?? '—'}</Info>
            <Info label={t('binder.bordereaux')}>{t(`binder.freq.${b.bordereau_frequency}`)} · {t('binder.dueAfter', { count: b.bordereau_due_days ?? 0 })}</Info>
            <Info label={t('binder.lobs')} className="col-span-2">
              <ul className="grid gap-0.5" data-binder-lob-list>
                {lobs.map((l) => (
                  <li key={l.lob_id}><span className="num">{l.code}</span> · {localName(l)}{l.limit_100 !== null && <span className="text-muted-foreground"> · {t('binder.lobLimitShort', { amount: formatAmount(l.limit_100), ccy })}</span>}</li>
                ))}
              </ul>
            </Info>
            <Info label={t('binder.territories')} className="col-span-2">{b.territories?.length ? b.territories.join(', ') : t('binder.anyTerritory')}</Info>
            {b.notes && <Info label={t('fields.notes')} className="col-span-2 md:col-span-4">{b.notes}</Info>}
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 content-start gap-4">
          <Card className="gap-0 py-0">
            <CardHeader className="py-4"><CardTitle>{t('binder.byPeriod')}</CardTitle></CardHeader>
            {grid.length === 0 ? (
              <EmptyState pictogram="inbox" title={t('binder.noPeriods')} compact />
            ) : (
              <div className="overflow-x-auto border-t">
                <table className="w-full text-table" data-periods-grid>
                  <thead>
                    <tr className="border-b text-small text-muted-foreground">
                      <th className="h-11 px-4 text-left font-medium">{t('bdx.period')}</th>
                      {kinds.map((k) => <th key={k} className="h-11 px-4 text-left font-medium">{t(`binder.kind.${k}`)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.map((r) => (
                      <tr key={r.start} className="h-12 border-b last:border-0">
                        <td className="px-4 py-2 align-top"><span className="block whitespace-nowrap">{formatDate(r.start)} –</span><span className="block whitespace-nowrap">{formatDate(r.end)}</span></td>
                        {kinds.map((k) => {
                          const p = r.cells[k]
                          if (!p) return <td key={k} className="px-4 py-2 text-muted-foreground">—</td>
                          const bdx = bordereaux.data?.find((x) => x.id === p.bordereau_id)
                          return (
                            <td key={k} className="px-4 py-2 align-top" data-period={`${r.start}:${k}`} data-state={p.state}>
                              <PeriodStateBadge state={p.state} />
                              <span className="mt-1 block text-caption whitespace-nowrap text-muted-foreground">
                                {bdx ? (
                                  <button type="button" className="text-link num hover:underline" onClick={() => setOpenBdx(bdx)}>{p.ref_no}</button>
                                ) : p.state === 'missing' && canUpload ? (
                                  <button type="button" className="text-link hover:underline" onClick={() => setUpload({ kind: k })}>{t('bdx.uploadNow')}</button>
                                ) : (
                                  t('binder.dueOn', { date: formatDate(p.due_date) })
                                )}
                              </span>
                              {p.received_date && <span className="block text-caption whitespace-nowrap text-muted-foreground">{t('binder.receivedOn', { date: formatDate(p.received_date) })}</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardContent>
              <Tabs defaultValue="bordereaux">
                <TabsList>
                  <TabsTrigger value="bordereaux">{t('binder.bordereaux')} ({bordereaux.data?.length ?? 0})</TabsTrigger>
                  <TabsTrigger value="premium">{t('binder.premium')} ({bdxInstallments.length})</TabsTrigger>
                  <TabsTrigger value="claims">{t('nav.claims')} ({claimRows.length})</TabsTrigger>
                  <TabsTrigger value="documents">{t('sub.tabs.documents')} ({docs.data?.length ?? 0})</TabsTrigger>
                  <TabsTrigger value="changes">{t('sub.tabs.changes')}</TabsTrigger>
                </TabsList>
                <TabsContent value="bordereaux">
                  <SmallTable
                    empty={t('binder.noBordereaux')}
                    head={[t('binder.ref'), t('bdx.kind'), t('bdx.period'), t('bdx.receivedDate'), t('bdx.lines'), t('bdx.computedTotalShort', { ccy })]}
                    rows={(bordereaux.data ?? []).map((x) => ({
                      key: x.id,
                      onClick: () => setOpenBdx(x),
                      cells: [
                        <span className="font-medium whitespace-nowrap text-link num">{x.ref_no}</span>,
                        t(`binder.kind.${x.kind}`),
                        <span className="whitespace-nowrap">{formatDate(x.period_start)} – {formatDate(x.period_end)}</span>,
                        formatDate(x.received_date),
                        <span className="whitespace-nowrap">{x.line_count}{x.warning_count > 0 && <Badge tone="warning" className="ml-2">{t('bdx.warningN', { count: x.warning_count })}</Badge>}{x.rejected_count > 0 && <Badge tone="danger" className="ml-2">{t('bdx.rejectedN', { count: x.rejected_count })}</Badge>}</span>,
                        formatAmount(x.computed_total),
                      ],
                    }))}
                  />
                </TabsContent>
                <TabsContent value="premium">
                  {!subId ? (
                    <p className="py-4 text-body text-muted-foreground">{t('binder.premiumNeedsBound')}</p>
                  ) : (
                    <SmallTable
                      empty={t('binder.noPremium')}
                      head={[t('binder.instNo'), t('prem.dueDate'), t('fields.notes'), t('fields.status'), t('prem.gross'), t('binder.netCcy', { ccy })]}
                      rows={bdxInstallments.map((i) => ({
                        key: i.id!,
                        cells: [
                          <span className="num">#{i.installment_no}</span>,
                          formatDate(i.due_date),
                          <span className="block max-w-64 truncate" title={i.notes ?? ''}>{i.notes ?? '—'}</span>,
                          <Badge tone={STATUS_TONE[i.status ?? 'open'] ?? 'neutral'}>{t(`prem.status.${statusKey(i)}`)}</Badge>,
                          formatAmount(i.gross_amount),
                          formatAmount(i.net_amount),
                        ],
                      }))}
                    />
                  )}
                </TabsContent>
                <TabsContent value="claims">
                  <SmallTable
                    empty={t('claim.none')}
                    head={[t('claim.claimNo'), t('claim.cedentRef'), t('claim.dateOfLoss'), t('fields.status'), t('claim.incurredCcy', { ccy })]}
                    rows={claimRows.map((c) => ({
                      key: c.id!,
                      cells: [
                        <span className="inline-flex items-center gap-2 whitespace-nowrap"><Link to={`/claims/${c.id}`} className="font-medium text-link num hover:underline">{c.claim_no}</Link>{c.large_loss && <LargeLossBadge />}</span>,
                        <span className="num">{c.cedent_claim_ref ?? '—'}</span>,
                        formatDate(c.date_of_loss),
                        <ClaimStatusBadge status={c.status} />,
                        `${formatAmount(c.incurred)}${c.currency !== ccy ? ` ${c.currency}` : ''}`,
                      ],
                    }))}
                  />
                </TabsContent>
                <TabsContent value="documents">
                  <DocumentsPanel entityType="binder" entityId={b.id!} documents={docs.data ?? []} canWrite={canEdit} />
                </TabsContent>
                <TabsContent value="changes">
                  {audit.data?.length ? (
                    <ul className="grid gap-3 text-body">
                      {audit.data.map((a) => {
                        const n = a.new_data as Record<string, unknown> | null
                        const o = a.old_data as Record<string, unknown> | null
                        return (
                          <li key={a.id} className="border-b pb-2 last:border-0">
                            <div className="text-caption text-muted-foreground">
                              {formatDateTime(a.changed_at)} · {a.changed_by ? userName(usersById.get(a.changed_by)) : t('sub.system')} · {t(`audit.${a.action}`)}
                            </div>
                            {a.action === 'UPDATE' && a.changed_fields?.filter((f) => !['updated_at', 'updated_by'].includes(f)).map((f) => (
                              <div key={f} className="text-caption">
                                <span className="font-medium">{t(`auditField.${f}`, { defaultValue: f })}</span>:{' '}
                                <span className="text-muted-foreground line-through">{String(o?.[f] ?? '—')}</span> → <span>{String(n?.[f] ?? '—')}</span>
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
              {canEdit && <AddFollowUpButton entityType="binder" entityId={b.id!} defaultAssignee={b.underwriter_id} types={['bordereau_missing', 'other']} teams={['underwriter', 'finance']} />}
            </CardHeader>
            <CardContent className="grid gap-2">
              {!followUps.data?.length && <p className="text-body text-muted-foreground">{t('fu.none')}</p>}
              {followUps.data?.map((f) => <FollowUpItem key={f.id} followUp={f} onDone={setClosing} onReschedule={setRescheduling} />)}
            </CardContent>
          </Card>
        </div>
      </div>

      <BinderDialog open={editing} onClose={() => setEditing(false)} binder={b} lobs={lobs} />
      {upload && <BordereauWizard open onClose={() => setUpload(null)} binder={b} lobs={lobs} periods={periods.data ?? []} initialKind={upload.kind} />}
      <BordereauPanel bordereau={openBdx} onClose={() => setOpenBdx(null)} ccy={ccy} />
      <CloseFollowUpDialog followUp={closing} onClose={() => setClosing(null)} />
      <RescheduleFollowUpDialog followUp={rescheduling} onClose={() => setRescheduling(null)} />
    </>
  )
}

/** One imported bordereau in a side panel: totals, its lines with their checks and comments, and the original file. */
function BordereauPanel({ bordereau: x, onClose, ccy }: { bordereau: BordereauRow | null; onClose: () => void; ccy: string }) {
  const { t } = useTranslation()
  const lines = useBordereauLines(x?.id ?? null)
  const docs = useEntityDocuments('bordereau', x?.id ?? undefined)
  return (
    <Dialog open={Boolean(x)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl" data-bordereau-panel>
        {x && (
          <>
            <DialogHeader>
              <DialogTitle className="num">{x.ref_no}</DialogTitle>
              <DialogDescription>
                {t(`binder.kind.${x.kind}`)} · {formatDate(x.period_start)} – {formatDate(x.period_end)} · {t('binder.receivedOn', { date: formatDate(x.received_date) })}
              </DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-body md:grid-cols-4">
              <Info label={t('bdx.lines')}>{x.line_count}</Info>
              <Info label={t('bdx.warnings')}>{x.warning_count}</Info>
              <Info label={t('bdx.rejected')}>{x.rejected_count}</Info>
              <Info label={t('bdx.computedTotalShort', { ccy })}><span className="num">{formatAmount(x.computed_total)}</span></Info>
              {x.stated_total !== null && <Info label={t('bdx.statedTotal')}><span className="num">{formatAmount(x.stated_total)}</span></Info>}
              {x.totals_comment && <Info label={t('bdx.totalsComment')} className="col-span-2 md:col-span-3">{x.totals_comment}</Info>}
              {x.notes && <Info label={t('fields.notes')} className="col-span-2 md:col-span-4">{x.notes}</Info>}
            </dl>
            {(docs.data?.length ?? 0) > 0 && (
              <p className="text-body"><FileText className="mr-1 inline size-4" />{t('bdx.originalFile')}: {docs.data!.map((d) => d.file_name).join(', ')}</p>
            )}
            <DocumentsPanel entityType="bordereau" entityId={x.id} documents={docs.data ?? []} canWrite={false} />
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-table" data-bordereau-lines>
                <thead>
                  <tr className="border-b text-small text-muted-foreground">
                    <th className="h-11 px-2 text-left font-medium">{t('bdx.row')}</th>
                    <th className="h-11 px-2 text-left font-medium">{t(x.kind === 'claims' ? 'bdx.field.claim_ref' : 'bdx.field.policy_ref')}</th>
                    <th className="h-11 px-2 text-left font-medium">{t('bdx.field.insured_name')}</th>
                    <th className="h-11 px-2 text-right font-medium">{t(`bdx.amountOf.${x.kind}`)}</th>
                    <th className="h-11 px-2 text-left font-medium">{t('bdx.comment')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(lines.data ?? []).map((l) => (
                    <tr key={l.id} className="h-12 border-b last:border-0">
                      <td className="px-2 num">{l.line_no}</td>
                      <td className="px-2 whitespace-nowrap num">
                        {x.kind === 'claims' && l.claim_id ? <Link to={`/claims/${l.claim_id}`} className="text-link hover:underline">{l.claim_ref}</Link> : (l.claim_ref ?? l.policy_ref)}
                      </td>
                      <td className="max-w-48 truncate px-2" title={l.insured_name ?? ''}>{l.insured_name ?? '—'}</td>
                      <td className="px-2 text-right whitespace-nowrap num">
                        {formatAmount(x.kind === 'premium' ? l.gross_premium_100 : x.kind === 'risk' ? (l.limit_100 ?? l.sum_insured_100) : Number(l.paid_100 ?? 0) + Number(l.outstanding_100 ?? 0))} {l.currency}
                      </td>
                      <td className="px-2">{l.status === 'warning' ? <span className="text-warning-800"><AlertTriangle className="mr-1 inline size-3.5" />{l.comment}</span> : <span className="text-muted-foreground">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
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

/** A small table; the last column is money (right-aligned). */
function SmallTable({ head, rows, empty }: { head: string[]; rows: { key: string; cells: ReactNode[]; onClick?: () => void }[]; empty: string }) {
  if (rows.length === 0) return <EmptyState pictogram="inbox" title={empty} compact />
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-table">
        <thead>
          <tr className="border-b text-small text-muted-foreground">
            {head.map((h, i) => <th key={h} className={`h-11 px-3 text-left font-medium whitespace-nowrap ${i === head.length - 1 ? 'text-right' : ''}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={`h-12 border-b last:border-0 ${r.onClick ? 'cursor-pointer hover:bg-slate-50' : ''}`} onClick={r.onClick}>
              {r.cells.map((cell, i) => <td key={i} className={`px-3 py-2 align-middle ${i === r.cells.length - 1 ? 'text-right whitespace-nowrap num' : ''}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
