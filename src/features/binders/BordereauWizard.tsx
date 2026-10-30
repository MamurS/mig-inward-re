import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, Upload, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Badge } from '@/components/ui/badge'
import { Field } from '@/components/Field'
import { errorMessage } from '@/lib/errors'
import { cleanDecimal, isDecimal } from '@/lib/decimal'
import { formatAmount, formatDate, isoDate } from '@/lib/format'
import { uploadDocument } from '@/lib/documents'
import { useCountries, useCurrencies } from '@/hooks/useReference'
import { cn } from '@/lib/utils'
import { fetchExistingKeys, importBordereau, saveTemplate, useInvalidateBinders, useTemplates, type BinderLob, type BinderRow, type BordereauKind, type PeriodRow } from './api'
import { MAX_ROWS, headersOf, readTable, type SheetRows } from './parse'
import { AiError, suggestMapping, useAiAvailable } from '@/features/ai/api'
import { ConfidenceBadge } from '@/features/ai/ConfidenceBadge'
import { FIELDS, applyTemplate, autoMap, checkRows, linesTotal, periodOf, toPayload, type CheckedLine, type Issue, type Mapping } from './validate'

type Step = 'file' | 'map' | 'review' | 'done'

/**
 * Upload a bordereau: the file and its period → map the MGA's columns (saved
 * per MGA as a template) → review every line (errors stay out, warnings need a
 * comment, totals against the MGA's) → import, all or nothing. The original
 * file is kept as a document on the bordereau.
 */
export function BordereauWizard({ open, onClose, binder, lobs, periods, initialKind }: {
  open: boolean
  onClose: () => void
  binder: BinderRow
  lobs: BinderLob[]
  periods: PeriodRow[]
  initialKind?: BordereauKind
}) {
  const { t } = useTranslation()
  const currencies = useCurrencies()
  const countries = useCountries()
  const invalidate = useInvalidateBinders()
  const [step, setStep] = useState<Step>('file')
  const [kind, setKind] = useState<BordereauKind>(initialKind ?? 'risk')
  const [periodStart, setPeriodStart] = useState('')
  const [received, setReceived] = useState(isoDate())
  const [file, setFile] = useState<File | null>(null)
  const [sheets, setSheets] = useState<SheetRows[]>([])
  const [sheet, setSheet] = useState(0)
  const [headerRow, setHeaderRow] = useState(1)
  const [mapping, setMapping] = useState<Mapping>({})
  const [templateId, setTemplateId] = useState<string>('')
  const [saveAs, setSaveAs] = useState(true)
  const [templateName, setTemplateName] = useState('')
  const [lines, setLines] = useState<CheckedLine[]>([])
  const [comments, setComments] = useState<Record<number, string>>({})
  const [stated, setStated] = useState('')
  const [totalsComment, setTotalsComment] = useState('')
  const [notes, setNotes] = useState('')
  const [show, setShow] = useState<'all' | 'problems'>('problems')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ ref: string; lines: number; installments: number; docError: string | null } | null>(null)
  const templates = useTemplates(binder.mga_id, kind)
  const aiAvailable = useAiAvailable()
  const [aiMap, setAiMap] = useState<Record<string, { confidence: number; reason: string | null }>>({})
  const [aiBusy, setAiBusy] = useState(false)

  // AI suggests the mapping from the column titles and three sample rows (the file itself is not sent)
  async function suggestWithAi() {
    setAiBusy(true)
    setError(null)
    try {
      const r = await suggestMapping({
        bordereauKind: kind,
        targets: FIELDS[kind].map((f) => ({ key: f.key, label: t(`bdx.field.${f.key}`), required: Boolean(f.required) })),
        columns: headers,
        samples: rows.slice(headerRow, headerRow + 3).map((row) => headers.map((_, j) => { const c = row[j]; return c instanceof Date ? c.toISOString().slice(0, 10) : c === null || c === undefined ? '' : String(c) })),
        headerRow,
      })
      const took = r.mapping.filter((m) => m.column && m.confidence >= 0.5)
      setMapping((m) => ({ ...m, ...Object.fromEntries(took.map((x) => [x.field, x.column!])) }))
      setAiMap(Object.fromEntries(took.map((x) => [x.field, { confidence: x.confidence, reason: x.reason }])))
      toast.success(t('ai.mappingApplied', { count: took.length }))
    } catch (e) {
      const code = e instanceof AiError ? e.code : 'error'
      setError(code === 'not_configured' ? t('ai.notConfigured') : code === 'disabled' ? t('ai.disabled') : code === 'limit' ? t('ai.limit') : e instanceof Error ? e.message : String(e))
    } finally {
      setAiBusy(false)
    }
  }

  const kinds = (binder.bordereau_kinds?.length ? binder.bordereau_kinds : (['risk', 'premium', 'claims'] as BordereauKind[]))
  // periods to choose: the ones owed for this kind (missing first), then any month of the binder
  const owed = periods.filter((p) => p.kind === kind && p.state !== 'received' && p.state !== 'late')
  const periodEnd = periodStart ? periodOf(periodStart, binder.bordereau_frequency ?? 'monthly')[1] : ''

  useEffect(() => {
    if (!open) return
    setStep('file')
    setKind(initialKind ?? kinds[0] ?? 'risk')
    setFile(null)
    setSheets([])
    setLines([])
    setComments({})
    setStated('')
    setTotalsComment('')
    setNotes('')
    setError(null)
    setResult(null)
    setReceived(isoDate())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    // the oldest period still owed for this kind, else the current one
    const first = periods.find((p) => p.kind === kind && (p.state === 'missing' || p.state === 'upcoming'))
    setPeriodStart(first?.period_start ?? periodOf(isoDate(), binder.bordereau_frequency ?? 'monthly')[0])
    setTemplateId('')
  }, [kind, periods, binder.bordereau_frequency])

  const rows = sheets[sheet]?.rows ?? []
  const headers = useMemo(() => headersOf(rows, headerRow), [rows, headerRow])
  const tooMany = rows.length - headerRow > MAX_ROWS

  async function onFile(f: File | null) {
    setFile(f)
    setError(null)
    if (!f) return
    try {
      const s = await readTable(f)
      setSheets(s)
      setSheet(0)
      const tpl = templates.data?.[0]
      setHeaderRow(tpl?.header_row ?? 1)
      if (tpl?.sheet) {
        const i = s.findIndex((x) => x.name === tpl.sheet)
        if (i >= 0) setSheet(i)
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : ''
      setError(m === 'too-big' ? t('bdx.fileTooBig') : m === 'bad-type' ? t('bdx.fileType') : errorMessage(e))
      setSheets([])
    }
  }

  // entering the mapping: the latest template of this MGA and kind, else a guess from the titles
  function toMapping() {
    const tpl = templates.data?.find((x) => x.id === templateId) ?? templates.data?.[0]
    if (tpl) {
      setTemplateId(tpl.id)
      setTemplateName(tpl.name)
      setMapping({ ...autoMap(headers, kind), ...applyTemplate(tpl.mapping as Mapping, headers) })
    } else {
      setTemplateId('')
      setTemplateName(t('bdx.templateDefault', { mga: binder.mga_name, kind: t(`binder.kind.${kind}`) }))
      setMapping(autoMap(headers, kind))
    }
    setStep('map')
  }

  const missingRequired = FIELDS[kind].filter((f) => f.required && !mapping[f.key])

  async function toReview() {
    setBusy(true)
    setError(null)
    try {
      const existing = await fetchExistingKeys(binder.id!, kind)
      const names = new Map<string, string>()
      for (const c of countries.data ?? []) for (const n of [c.name, c.name_ru, c.name_uz]) if (n) names.set(n.toLowerCase(), c.code)
      const checked = checkRows(rows, headers, headerRow, mapping, {
        kind,
        binder: {
          period_from: binder.period_from!, period_to: binder.period_to!, currency: binder.currency!, limit_per_risk: binder.limit_per_risk,
          territories: binder.territories ?? [], lobs: lobs.map((l) => ({ id: l.lob_id, code: l.code, name: l.name, limit_100: l.limit_100 })),
        },
        periodStart,
        periodEnd,
        existing,
        currencies: new Set((currencies.data ?? []).map((c) => c.code)),
        countries: names,
      })
      setLines(checked)
      setComments({})
      setShow(checked.some((l) => l.status !== 'ok') ? 'problems' : 'all')
      setStep('review')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const good = lines.filter((l) => l.status !== 'error')
  const errorsN = lines.length - good.length
  const warnings = lines.filter((l) => l.status === 'warning')
  const uncommented = warnings.filter((l) => !(comments[l.line_no] ?? '').trim()).length
  const computed = linesTotal(kind, good)
  const statedOk = stated.trim() === '' || isDecimal(stated, 2)
  const totalsDiffer = stated.trim() !== '' && statedOk && cleanDecimal(stated) !== computed && Number(cleanDecimal(stated)) !== Number(computed)
  const canImport = good.length > 0 && uncommented === 0 && statedOk && (!totalsDiffer || totalsComment.trim() !== '')

  async function doImport() {
    if (!file || !canImport) return
    setBusy(true)
    setError(null)
    try {
      let tplId: string | null = templateId || null
      if (saveAs && templateName.trim()) {
        tplId = await saveTemplate({ id: templates.data?.some((x) => x.id === templateId && x.name === templateName.trim()) ? templateId : undefined, mga_id: binder.mga_id!, kind, name: templateName.trim(), mapping, header_row: headerRow, sheet: sheets[sheet]?.name ?? null })
      }
      const bdx = await importBordereau(
        {
          binder_id: binder.id!, kind, period_start: periodStart, period_end: periodEnd, received_date: received, template_id: tplId, file_name: file.name,
          stated_total: stated.trim() ? cleanDecimal(stated) : null, computed_total: computed, totals_comment: totalsDiffer ? totalsComment.trim() : null, notes: notes.trim() || null,
        },
        good.map((l) => toPayload(l, comments[l.line_no] ?? null)),
        errorsN,
      )
      // the original file, kept with the bordereau (the import stands even if this fails)
      let docError: string | null = null
      try {
        await uploadDocument('bordereau', bdx.id, file, 'bordereau')
      } catch (e) {
        docError = errorMessage(e)
      }
      await invalidate()
      setResult({ ref: bdx.ref_no, lines: bdx.line_count, installments: bdx.installment_ids?.length ?? 0, docError })
      setStep('done')
      toast.success(t('bdx.imported', { ref: bdx.ref_no }))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const issueText = (i: Issue) => {
    const field = i.field ? t(`bdx.field.${i.field}`) : ''
    const p = { ...i.params, field, date: i.params?.date ? formatDate(String(i.params.date)) : '', limit: i.params?.limit !== undefined ? formatAmount(Number(i.params.limit)) : '' }
    return t(`bdx.issue.${i.code}`, p)
  }
  const shown = show === 'problems' ? lines.filter((l) => l.status !== 'ok') : lines
  const steps: Step[] = ['file', 'map', 'review']

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-5xl" data-bordereau-wizard>
        <DialogHeader>
          <DialogTitle>{t('bdx.upload')}</DialogTitle>
          <DialogDescription>{binder.binder_ref} · {binder.mga_name}</DialogDescription>
        </DialogHeader>

        {step !== 'done' && (
          <ol className="flex flex-wrap gap-2 text-small" aria-label={t('bdx.steps')}>
            {steps.map((s, i) => (
              <li key={s} aria-current={s === step ? 'step' : undefined} className={cn('rounded-full border px-3 py-1', s === step ? 'border-brand-600 bg-brand-50 font-medium text-brand-700' : 'text-muted-foreground')}>
                {i + 1}. {t(`bdx.step.${s}`)}
              </li>
            ))}
          </ol>
        )}

        {step === 'file' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('bdx.kind')} required>
              <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as BordereauKind)}>
                {kinds.map((k) => <option key={k} value={k}>{t(`binder.kind.${k}`)}</option>)}
              </NativeSelect>
            </Field>
            <Field label={t('bdx.period')} required hint={periodStart ? `${formatDate(periodStart)} – ${formatDate(periodEnd)}` : undefined}>
              <NativeSelect value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} data-period-select>
                {owed.length > 0 && (
                  <optgroup label={t('bdx.owed')}>
                    {owed.map((p) => <option key={p.period_start} value={p.period_start}>{formatDate(p.period_start)} – {formatDate(p.period_end)} · {t(`binder.state.${p.state}`)}</option>)}
                  </optgroup>
                )}
                <optgroup label={t('bdx.allPeriods')}>
                  {periods.filter((p) => p.kind === kind).map((p) => <option key={`all-${p.period_start}`} value={p.period_start}>{formatDate(p.period_start)} – {formatDate(p.period_end)}</option>)}
                  {!periods.some((p) => p.kind === kind && p.period_start === periodStart) && periodStart && <option value={periodStart}>{formatDate(periodStart)} – {formatDate(periodEnd)}</option>}
                </optgroup>
              </NativeSelect>
            </Field>
            <Field label={t('bdx.receivedDate')} required>
              <DateInput value={received} max={isoDate()} onChange={setReceived} />
            </Field>
            <Field label={t('bdx.file')} required hint={t('bdx.fileHint')}>
              <Input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} data-bdx-file />
            </Field>
            {sheets.length > 0 && (
              <p className="text-body text-muted-foreground sm:col-span-2" data-file-summary>
                <CheckCircle2 className="mr-1 inline size-4 text-success-600" />
                {t('bdx.fileRead', { sheets: sheets.length, rows: Math.max(0, rows.length - 1) })}
              </p>
            )}
            {tooMany && <p role="alert" className="text-body text-danger-700 sm:col-span-2">{t('bdx.tooManyRows', { max: MAX_ROWS })}</p>}
          </div>
        )}

        {step === 'map' && (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {sheets.length > 1 && (
                <Field label={t('bdx.sheet')}>
                  <NativeSelect value={String(sheet)} onChange={(e) => setSheet(Number(e.target.value))}>
                    {sheets.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}
                  </NativeSelect>
                </Field>
              )}
              <Field label={t('bdx.headerRow')} hint={t('bdx.headerRowHint')}>
                <Input inputMode="numeric" className="text-right tabular-nums" value={String(headerRow)} onChange={(e) => setHeaderRow(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
              </Field>
              {aiAvailable.data && (
                <div className="flex items-end">
                  <Button type="button" variant="outline" onClick={() => void suggestWithAi()} disabled={aiBusy} data-ai-mapping>
                    {aiBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
                    {t('ai.suggestMapping')}
                  </Button>
                </div>
              )}
              {(templates.data?.length ?? 0) > 0 && (
                <Field label={t('bdx.template')}>
                  <NativeSelect
                    value={templateId}
                    onChange={(e) => {
                      const tpl = templates.data?.find((x) => x.id === e.target.value)
                      setTemplateId(e.target.value)
                      if (tpl) {
                        setTemplateName(tpl.name)
                        setHeaderRow(tpl.header_row)
                        setMapping({ ...autoMap(headers, kind), ...applyTemplate(tpl.mapping as Mapping, headers) })
                      }
                    }}
                  >
                    <option value="">—</option>
                    {templates.data?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </NativeSelect>
                </Field>
              )}
            </div>
            <table className="w-full text-table" data-mapping>
              <thead>
                <tr className="border-b text-small text-muted-foreground">
                  <th className="h-11 px-2 text-left font-medium">{t('bdx.systemField')}</th>
                  <th className="h-11 px-2 text-left font-medium">{t('bdx.fileColumn')}</th>
                  <th className="h-11 px-2 text-left font-medium">{t('bdx.sample')}</th>
                </tr>
              </thead>
              <tbody>
                {FIELDS[kind].map((f) => {
                  const j = mapping[f.key] ? headers.indexOf(mapping[f.key]) : -1
                  const sample = j >= 0 ? rows.slice(headerRow, headerRow + 3).map((r) => r[j]).filter((v) => v !== null && v !== undefined).map((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v))).join(' · ') : ''
                  return (
                    <tr key={f.key} className="h-12 border-b last:border-0">
                      <td className="px-2">{t(`bdx.field.${f.key}`)}{f.required && <span className="text-destructive" aria-hidden>*</span>}</td>
                      <td className="px-2">
                        <span className="flex items-center gap-2">
                          <NativeSelect
                            aria-label={t(`bdx.field.${f.key}`)}
                            value={mapping[f.key] ?? ''}
                            onChange={(e) => {
                              setMapping((m) => ({ ...m, [f.key]: e.target.value }))
                              setAiMap((a) => Object.fromEntries(Object.entries(a).filter(([k]) => k !== f.key)))
                            }}
                            className={cn(f.required && !mapping[f.key] && 'border-danger-500')}
                          >
                            <option value="">{t('bdx.notInFile')}</option>
                            {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                          </NativeSelect>
                          {aiMap[f.key] && <ConfidenceBadge value={aiMap[f.key].confidence} title={aiMap[f.key].reason ?? undefined} className="shrink-0" />}
                        </span>
                      </td>
                      <td className="max-w-64 truncate px-2 text-caption text-muted-foreground" title={sample}>{sample || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
              <label className="flex items-center gap-2 text-body"><input type="checkbox" checked={saveAs} onChange={(e) => setSaveAs(e.target.checked)} />{t('bdx.saveTemplate')}</label>
              {saveAs && <Input aria-label={t('bdx.templateName')} value={templateName} onChange={(e) => setTemplateName(e.target.value)} />}
            </div>
            {missingRequired.length > 0 && <p role="alert" className="text-body text-danger-700">{t('bdx.mapRequired', { fields: missingRequired.map((f) => t(`bdx.field.${f.key}`)).join(', ') })}</p>}
          </div>
        )}

        {step === 'review' && (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2" data-review-summary>
              <Badge tone="success"><CheckCircle2 />{t('bdx.okN', { count: lines.length - warnings.length - errorsN })}</Badge>
              <Badge tone="warning"><AlertTriangle />{t('bdx.warningN', { count: warnings.length })}</Badge>
              <Badge tone="danger"><XCircle />{t('bdx.errorN', { count: errorsN })}</Badge>
              <span className="text-small text-muted-foreground">{formatDate(periodStart)} – {formatDate(periodEnd)} · {t(`binder.kind.${kind}`)}</span>
              <span className="ml-auto inline-flex gap-1">
                <Button size="sm" variant={show === 'problems' ? 'default' : 'outline'} onClick={() => setShow('problems')}>{t('bdx.showProblems')}</Button>
                <Button size="sm" variant={show === 'all' ? 'default' : 'outline'} onClick={() => setShow('all')}>{t('bdx.showAll')}</Button>
              </span>
            </div>
            {errorsN > 0 && <p className="text-body text-muted-foreground">{t('bdx.errorsLeftOut')}</p>}
            <div className="max-h-[50vh] overflow-auto rounded-md border">
              <table className="w-full text-table" data-review-table>
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-small text-muted-foreground">
                    <th className="h-11 px-2 text-left font-medium">{t('bdx.row')}</th>
                    <th className="h-11 px-2 text-left font-medium">{t(kind === 'claims' ? 'bdx.field.claim_ref' : 'bdx.field.policy_ref')}</th>
                    <th className="h-11 px-2 text-left font-medium">{t('bdx.field.insured_name')}</th>
                    <th className="h-11 px-2 text-right font-medium">{t(`bdx.amountOf.${kind}`)}</th>
                    <th className="h-11 px-2 text-left font-medium">{t('bdx.check')}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.slice(0, 1000).map((l) => {
                    const amount = kind === 'premium' ? l.values.gross_premium_100 : kind === 'risk' ? (l.values.limit_100 ?? l.values.sum_insured_100) : linesTotal('claims', [l])
                    return (
                      <tr key={l.line_no} className={cn('border-b align-top last:border-0', l.status === 'error' && 'bg-danger-50', l.status === 'warning' && 'bg-warning-50')} data-line={l.line_no} data-status={l.status}>
                        <td className="px-2 py-2 num">{l.line_no}</td>
                        <td className="px-2 py-2 whitespace-nowrap num">{(kind === 'claims' ? l.values.claim_ref : l.values.policy_ref) ?? '—'}</td>
                        <td className="max-w-48 truncate px-2 py-2" title={l.values.insured_name ?? ''}>{l.values.insured_name ?? '—'}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap num">{amount ? `${formatAmount(amount)} ${l.values.currency ?? ''}` : '—'}</td>
                        <td className="min-w-64 px-2 py-2">
                          {l.status === 'ok' && <span className="text-success-700">{t('bdx.lineOk')}</span>}
                          <ul className="grid gap-0.5">
                            {l.issues.map((i, k) => (
                              <li key={k} className={i.level === 'error' ? 'text-danger-700' : 'text-warning-800'}>
                                {i.level === 'error' ? <XCircle className="mr-1 inline size-3.5" /> : <AlertTriangle className="mr-1 inline size-3.5" />}
                                {issueText(i)}
                              </li>
                            ))}
                          </ul>
                          {l.status === 'warning' && (
                            <Input
                              aria-label={t('bdx.commentFor', { row: l.line_no })}
                              placeholder={t('bdx.commentPlaceholder')}
                              className={cn('mt-1 h-9', !(comments[l.line_no] ?? '').trim() && 'border-warning-500')}
                              value={comments[l.line_no] ?? ''}
                              onChange={(e) => setComments((c) => ({ ...c, [l.line_no]: e.target.value }))}
                            />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {shown.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">{t('bdx.noProblems')}</td></tr>}
                </tbody>
              </table>
            </div>
            {shown.length > 1000 && <p className="text-caption text-muted-foreground">{t('bdx.firstRows', { count: 1000 })}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('bdx.computedTotal', { ccy: binder.currency })}>
                <p className="flex h-11 items-center justify-end rounded-md border bg-slate-50 px-3 font-medium num" data-computed-total>{formatAmount(computed)}</p>
              </Field>
              <Field label={t('bdx.statedTotal')} hint={t('bdx.statedTotalHint')} error={statedOk ? undefined : t('v.amount')}>
                <Input inputMode="decimal" className="text-right tabular-nums" value={stated} onChange={(e) => setStated(e.target.value)} data-stated-total />
              </Field>
              {totalsDiffer && (
                <div role="alert" className="grid gap-2 rounded-md border border-warning-300 bg-warning-50 p-3 sm:col-span-2">
                  <p className="inline-flex items-center gap-2 font-medium text-warning-800"><AlertTriangle className="size-4" />{t('bdx.totalsDiffer', { stated: formatAmount(cleanDecimal(stated)), computed: formatAmount(computed) })}</p>
                  <Field label={t('bdx.totalsComment')} required>
                    <Textarea rows={2} value={totalsComment} onChange={(e) => setTotalsComment(e.target.value)} />
                  </Field>
                </div>
              )}
              <Field label={t('fields.notes')} className="sm:col-span-2">
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
            <p className="text-body text-muted-foreground" data-import-effect>{t(`bdx.effect.${kind}`, { share: binder.our_share_pct, days: binder.bordereau_due_days })}</p>
            {uncommented > 0 && <p className="text-body text-warning-800">{t('bdx.needComments', { count: uncommented })}</p>}
          </div>
        )}

        {step === 'done' && result && (
          <div className="grid gap-3 text-body" data-import-result>
            <p className="inline-flex items-center gap-2 text-title font-semibold text-success-700"><CheckCircle2 className="size-5" />{t('bdx.importedTitle', { ref: result.ref })}</p>
            <p>{t('bdx.importedLines', { count: result.lines })}</p>
            {result.installments > 0 && <p>{t('bdx.importedInstallments', { count: result.installments })}</p>}
            {errorsN > 0 && <p className="text-muted-foreground">{t('bdx.importedRejected', { count: errorsN })}</p>}
            {result.docError && <p role="alert" className="rounded-md bg-warning-50 p-3 text-warning-800">{t('bdx.docFailed', { error: result.docError })}</p>}
          </div>
        )}

        {error && <p role="alert" className="rounded-md bg-danger-100 p-3 text-body text-danger-700">{error}</p>}
        <DialogFooter>
          {step === 'done' ? (
            <Button onClick={onClose}>{t('common.close')}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => (step === 'file' ? onClose() : setStep(step === 'review' ? 'map' : 'file'))} disabled={busy}>
                {step === 'file' ? t('common.cancel') : t('common.back')}
              </Button>
              {step === 'file' && <Button onClick={toMapping} disabled={!file || !sheets.length || !periodStart || !received || tooMany || templates.isLoading}>{t('common.next')}</Button>}
              {step === 'map' && (
                <Button onClick={() => void toReview()} disabled={busy || missingRequired.length > 0}>
                  {busy && <Loader2 className="animate-spin" />}
                  {t('bdx.check')}
                </Button>
              )}
              {step === 'review' && (
                <Button onClick={() => void doImport()} disabled={busy || !canImport} data-import>
                  {busy ? <Loader2 className="animate-spin" /> : <Upload />}
                  {t('bdx.importN', { count: good.length })}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
