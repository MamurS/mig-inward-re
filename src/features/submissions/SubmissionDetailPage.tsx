import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowRight, Clock, FileText, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Amount } from '@/components/Amount'
import { cn } from '@/lib/utils'
import { StatusStepper } from './StatusStepper'
import { InfoItem } from '@/components/Field'
import { Skeleton } from '@/components/Skeleton'
import { useAuth } from '@/auth/AuthProvider'
import { can } from '@/lib/roles'
import { NEXT_STATUSES, type SubmissionStatus } from '@/lib/status'
import { formatDate, formatDateTime, formatMoney, formatPct } from '@/lib/format'
import { openDocument } from '@/lib/documents'
import { errorMessage } from '@/lib/errors'
import { useCounterparties, useCountries, useLinesOfBusiness, useLocalName, useUsers, userName } from '@/hooks/useReference'
import { DocumentsPanel } from '@/features/documents/DocumentsPanel'
import { useAuditLog, useEntityDocuments, useEntityFollowUps, useSubmission, useSubmissionHistory } from './api'
import { StatusChangeDialog } from './StatusChangeDialog'
import { AddFollowUpButton, CloseFollowUpDialog, FollowUpItem, RescheduleFollowUpDialog, type FollowUp } from '@/features/followups/FollowUps'
import { FiguresTable } from './SubmissionFormPage'
import { PremiumTab } from '@/features/premium/PremiumTab'
import { usePremiumInstallments } from '@/features/premium/api'

export function SubmissionDetailPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const { role } = useAuth()
  const sub = useSubmission(id)
  const history = useSubmissionHistory(id)
  const docs = useEntityDocuments('submission', id)
  const followUps = useEntityFollowUps('submission', id)
  const audit = useAuditLog('submissions', id)
  const premiumRows = usePremiumInstallments(id)
  const users = useUsers()
  const countries = useCountries()
  const counterparties = useCounterparties()
  const lobs = useLinesOfBusiness()
  const localName = useLocalName()
  const [target, setTarget] = useState<SubmissionStatus | null>(null)
  const [closing, setClosing] = useState<FollowUp | null>(null)
  const [rescheduling, setRescheduling] = useState<FollowUp | null>(null)
  const [tab, setTab] = useState<string | null>(null)
  const [scheduleStep, setScheduleStep] = useState(false)

  if (sub.isLoading)
    return (
      <div className="grid gap-4" aria-busy>
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-56 rounded-xl" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    )
  if (sub.error) return <p className="p-6 text-body text-destructive">{errorMessage(sub.error)}</p>
  if (!sub.data) return <p className="p-6 text-body text-muted-foreground">{t('sub.notFound')}</p>

  const s = sub.data
  const editable = can.editSubmissions(role)
  const next = s.status ? NEXT_STATUSES[s.status] : []
  const usersById = new Map(users.data?.map((u) => [u.id, u]))
  const country = countries.data?.find((c) => c.code === s.insured_country)
  const docsById = new Map(docs.data?.map((d) => [d.id, d]))
  // Premium lives on bound submissions (and on any that already have installments)
  const showPremium = s.status === 'bound' || (premiumRows.data?.length ?? 0) > 0
  // Bound submissions open on Premium unless the user picked another tab
  const activeTab = tab === null ? (showPremium ? 'premium' : 'timeline') : tab === 'premium' && !showPremium ? 'timeline' : tab
  // The first time each status was reached (history is newest first)
  const reachedAt: Partial<Record<SubmissionStatus, string>> = { received: s.received_at ?? undefined }
  for (const h of [...(history.data ?? [])].reverse()) reachedAt[h.to_status] ??= h.changed_at

  // Human-readable values in the change log (names instead of ids, formatted dates)
  const fmtValue = (field: string, v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—'
    const str = String(v)
    if (['mga_id', 'broker_id', 'source_party_id'].includes(field)) return counterparties.data?.find((c) => c.id === str)?.name ?? str
    if (['underwriter_id', 'created_by', 'updated_by'].includes(field)) return userName(usersById.get(str))
    if (field === 'lob_id') return localName(lobs.data?.find((l) => l.id === str))
    if (field === 'status') return t(`status.${str}`)
    if (field === 'business_type') return t(`businessType.${str}`)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return formatDate(str)
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return formatDateTime(str)
    return str
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: t('pages.submissions.title'), to: '/submissions' }, { label: s.ref_no ?? '' }]}
        title={s.insured_name ?? s.ref_no ?? ''}
        subtitle={[s.ref_no, s.mga_name, s.lob_name, s.currency].filter(Boolean).join(' · ')}
        actions={
          editable && (
            <Button variant="outline" asChild>
              <Link to={`/submissions/${s.id}/edit`}>
                <Pencil />
                {t('common.edit')}
              </Link>
            </Button>
          )
        }
      />

      {/* Summary: where it stands, how it got here, what it is worth, what is next */}
      <Card className="mb-4 gap-0 py-0">
        <CardContent className="grid gap-5 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={s.status} className="px-3 py-1 text-body" />
            <span className="text-caption text-muted-foreground">{t('sub.since', { date: formatDateTime(s.status_changed_at) })}</span>
            {s.offer_expired && (
              <Badge tone="warning">
                <AlertTriangle />
                {t('sub.offerExpiredOn', { date: formatDate(s.offer_valid_until) })}
              </Badge>
            )}
            {s.decision_reason && <span className="text-body text-muted-foreground">“{s.decision_reason}”</span>}
            <div className="flex-1" />
            {editable && next.map((n) => (
              <Button key={n} size="sm" variant={n === 'declined' || n === 'ntu' ? 'outline' : 'default'} onClick={() => setTarget(n)}>
                {t(`statusAction.${n}`)}
              </Button>
            ))}
          </div>
          {s.status && <StatusStepper status={s.status} reachedAt={reachedAt} />}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-4 md:grid-cols-3 xl:grid-cols-5">
            <InfoItem label={`${t('fields.ourGrossPremium')}`}>
              <Amount value={s.our_gross_premium} currency={s.currency} className="text-lead font-semibold" />
            </InfoItem>
            <InfoItem label={t('fields.ourNetPremium')}>
              <Amount value={s.our_net_premium} currency={s.currency} className="text-lead font-semibold" />
            </InfoItem>
            <InfoItem label={t('fields.ourGrossUsd')}>
              <Amount value={s.our_gross_premium_usd} currency="USD" human className="text-lead font-semibold" />
            </InfoItem>
            <InfoItem label={s.status === 'bound' ? t('fields.signedSharePct') : t('fields.writtenSharePct')}>
              <span className="text-lead font-semibold num">{formatPct(s.share_pct)}</span>
            </InfoItem>
            <InfoItem label={t('fields.nextFollowUp')}>
              {s.next_follow_up_at ? (
                <span className={cn('inline-flex items-center gap-1 text-lead font-semibold', s.follow_up_overdue && 'text-destructive')}>
                  {s.follow_up_overdue && <Clock className="size-4" />}
                  {formatDate(s.next_follow_up_at)}
                </span>
              ) : (
                <span className="text-lead text-muted-foreground">—</span>
              )}
            </InfoItem>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-4">
          <Card>
            <CardHeader><CardTitle>{t('sub.section.source')} & {t('sub.section.risk')}</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoItem label={t('fields.receivedAt')}>{formatDate(s.received_at)}</InfoItem>
                <InfoItem label={t('fields.mga')}>{s.mga_id ? <Link className="text-primary hover:underline" to={`/counterparties/${s.mga_id}`}>{s.mga_name}</Link> : '—'}</InfoItem>
                <InfoItem label={t('fields.broker')}>{s.broker_id ? <Link className="text-primary hover:underline" to={`/counterparties/${s.broker_id}`}>{s.broker_name}</Link> : t('sub.directNoBroker')}</InfoItem>
                <InfoItem label={t('fields.sourceParty')}>{s.source_party_name}</InfoItem>
                <InfoItem label={t('fields.businessType')}>{s.business_type ? t(`businessType.${s.business_type}`) : '—'}</InfoItem>
                <InfoItem label={t('fields.underwriter')}>{s.underwriter_name ?? '—'}</InfoItem>
                <InfoItem label={t('fields.insuredName')}>{s.insured_name}</InfoItem>
                <InfoItem label={t('fields.insuredCountry')}>{country ? localName(country) : s.insured_country ?? '—'}</InfoItem>
                <InfoItem label={t('fields.lob')}>{s.lob_name ?? '—'}</InfoItem>
                <InfoItem label={t('fields.period')}>{s.period_from || s.period_to ? `${formatDate(s.period_from)} – ${formatDate(s.period_to)}` : '—'}</InfoItem>
                <InfoItem label={t('fields.riskDescription')} className="sm:col-span-2">{s.risk_description || '—'}</InfoItem>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('sub.section.financials')} & {t('sub.section.terms')}</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                <InfoItem label={t('fields.sumInsured100')}>{formatMoney(s.sum_insured_100, s.currency)}</InfoItem>
                <InfoItem label={t('fields.limit100')}>{formatMoney(s.limit_100, s.currency)}</InfoItem>
                <InfoItem label={t('fields.deductible')}>{formatMoney(s.deductible, s.currency)}</InfoItem>
                <InfoItem label={t('fields.grossPremium100')}>{formatMoney(s.gross_premium_100, s.currency)}</InfoItem>
                <InfoItem label={t('fields.commissionPct')}>{formatPct(s.commission_pct)}</InfoItem>
                <InfoItem label={t('fields.brokeragePct')}>{formatPct(s.brokerage_pct)}</InfoItem>
                <InfoItem label={t('fields.writtenSharePct')}>{formatPct(s.written_share_pct)}</InfoItem>
                <InfoItem label={t('fields.signedSharePct')}>{formatPct(s.signed_share_pct)}</InfoItem>
                <InfoItem label={t('fields.offerValidUntil')}>{formatDate(s.offer_valid_until)}</InfoItem>
                <InfoItem label={t('fields.paymentTermsDays')}>{s.payment_terms_days ?? '—'}</InfoItem>
                <InfoItem label={t('fields.ppwDate')}>{formatDate(s.ppw_date)}</InfoItem>
                <InfoItem label={t('fields.boundAt')}>{formatDate(s.bound_at)}</InfoItem>
                {s.notes && <InfoItem label={t('fields.notes')} className="sm:col-span-2 lg:col-span-4">{s.notes}</InfoItem>}
              </dl>
            </CardContent>
          </Card>

        </div>

        {/* Right column */}
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('sub.ourShare')}</CardTitle>
              <p className="text-caption text-muted-foreground">
                {s.share_pct === null ? t('sub.enterShare') : s.status === 'bound' ? t('sub.basisSigned', { pct: formatPct(s.share_pct) }) : t('sub.basisWritten', { pct: formatPct(s.share_pct) })}
              </p>
            </CardHeader>
            <CardContent>
              <FiguresTable
                figures={{
                  ourGross: s.our_gross_premium, commission: s.commission_amount, brokerage: s.brokerage_amount, ourNet: s.our_net_premium,
                  ourSumInsured: s.our_sum_insured, ourLimit: s.our_limit, ourGrossUsd: s.our_gross_premium_usd, ourNetUsd: s.our_net_premium_usd,
                }}
                currency={s.currency ?? ''}
                fxRate={s.fx_rate_to_usd}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle>{t('fu.title')}</CardTitle>
              {editable && <AddFollowUpButton entityType="submission" entityId={s.id!} defaultAssignee={s.underwriter_id} />}
            </CardHeader>
            <CardContent className="grid gap-2">
              {!followUps.data?.length && <p className="text-body text-muted-foreground">{t('fu.none')}</p>}
              {followUps.data?.map((f) => (
                <FollowUpItem key={f.id} followUp={f} onDone={setClosing} onReschedule={setRescheduling} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Full width: the Premium tab's table needs the whole content width */}
      <Card className="mt-4">
        <CardContent>
          <Tabs value={activeTab} onValueChange={setTab}>
            <TabsList>
              {showPremium && <TabsTrigger value="premium">{t('prem.tab')}</TabsTrigger>}
              <TabsTrigger value="timeline">{t('sub.tabs.timeline')}</TabsTrigger>
              <TabsTrigger value="documents">{t('sub.tabs.documents')} ({docs.data?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="changes">{t('sub.tabs.changes')}</TabsTrigger>
            </TabsList>

            {showPremium && (
              <TabsContent value="premium">
                <PremiumTab submission={s} startEditor={scheduleStep} onEditorStarted={() => setScheduleStep(false)} />
              </TabsContent>
            )}

            <TabsContent value="timeline">
              <ol className="relative ml-2 border-l pl-6">
                {history.data?.map((h) => {
                  const doc = h.document_id ? docsById.get(h.document_id) : undefined
                  return (
                    <li key={h.id} className="relative pb-5 last:pb-0">
                      <span className="absolute top-1 -left-[31px] flex size-3 items-center justify-center rounded-full border-2 border-background bg-primary" />
                      <div className="flex flex-wrap items-center gap-2 text-body">
                        {h.from_status && <><StatusBadge status={h.from_status} /><ArrowRight className="size-3.5 text-muted-foreground" /></>}
                        <StatusBadge status={h.to_status} />
                        <span className="text-caption text-muted-foreground">
                          {formatDateTime(h.changed_at)} · {h.changed_by ? userName(usersById.get(h.changed_by)) : t('sub.system')}
                        </span>
                      </div>
                      {(h.written_share_pct !== null || h.signed_share_pct !== null) && h.to_status !== 'received' && (
                        <p className="mt-1 text-caption text-muted-foreground">
                          {t('fields.writtenSharePct')}: {formatPct(h.written_share_pct)}
                          {h.signed_share_pct !== null && ` · ${t('fields.signedSharePct')}: ${formatPct(h.signed_share_pct)}`}
                        </p>
                      )}
                      {h.comment && <p className="mt-1 text-body">{h.comment}</p>}
                      {doc && (
                        <button type="button" className="mt-1 inline-flex items-center gap-1 text-caption text-primary hover:underline" onClick={() => openDocument(doc).catch((e) => toast.error(errorMessage(e)))}>
                          <FileText className="size-3.5" />
                          {doc.file_name}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ol>
            </TabsContent>

            <TabsContent value="documents">
              <DocumentsPanel
                entityType="submission"
                entityId={s.id!}
                documents={docs.data ?? []}
                canWrite={editable}
                evidenceIds={new Set(history.data?.map((h) => h.document_id).filter((x): x is string => Boolean(x)))}
              />
            </TabsContent>

            <TabsContent value="changes">
              {audit.data?.length ? (
                <ul className="grid gap-3 text-body">
                  {audit.data.map((a) => (
                    <li key={a.id} className="border-b pb-2 last:border-0">
                      <div className="text-caption text-muted-foreground">
                        {formatDateTime(a.changed_at)} · {a.changed_by ? userName(usersById.get(a.changed_by)) : t('sub.system')} · {t(`audit.${a.action}`)}
                      </div>
                      {a.action === 'UPDATE' && a.changed_fields && (
                        <div className="mt-1 grid gap-0.5">
                          {a.changed_fields.map((f) => {
                            const oldV = (a.old_data as Record<string, unknown> | null)?.[f]
                            const newV = (a.new_data as Record<string, unknown> | null)?.[f]
                            return (
                              <div key={f} className="text-caption">
                                <span className="font-medium">{t(`auditField.${f}`, { defaultValue: f })}</span>:{' '}
                                <span className="text-muted-foreground line-through">{fmtValue(f, oldV)}</span> → <span>{fmtValue(f, newV)}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-4 text-center text-body text-muted-foreground">{t('sub.noChanges')}</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <StatusChangeDialog
        submission={s}
        target={target}
        documents={docs.data ?? []}
        onClose={() => setTarget(null)}
        onDone={(to) => {
          if (to === 'bound') {
            setTab('premium')
            setScheduleStep(true)
          }
        }}
      />
      <CloseFollowUpDialog followUp={closing} onClose={() => setClosing(null)} />
      <RescheduleFollowUpDialog followUp={rescheduling} onClose={() => setRescheduling(null)} />
    </>
  )
}
