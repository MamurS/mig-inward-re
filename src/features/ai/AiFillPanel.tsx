import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, FileText, Loader2, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/Field'
import { SegmentedControl } from '@/components/SegmentedControl'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCounterparties, useCountries, useCurrencies, useLinesOfBusiness } from '@/hooks/useReference'
import { AI_FILE_TYPES, AiError, extractSubmission, useDuplicates } from './api'
import { defaultPicks, toSuggestions, type AiSubmission, type Suggestion } from './apply'
import { ConfidenceBadge } from './ConfidenceBadge'

const LABEL: Record<string, string> = {
  insured_name: 'fields.insuredName', insured_country: 'fields.insuredCountry', mga_id: 'fields.mga', broker_id: 'fields.broker', lob_id: 'fields.lob',
  risk_description: 'fields.riskDescription', period_from: 'fields.periodFrom', period_to: 'fields.periodTo', currency: 'fields.currency',
  sum_insured_100: 'fields.sumInsured100', limit_100: 'fields.limit100', deductible: 'fields.deductible', gross_premium_100: 'fields.grossPremium100',
  commission_pct: 'fields.commissionPct', brokerage_pct: 'fields.brokeragePct', written_share_pct: 'fields.writtenSharePct', ppw_date: 'fields.ppwDate',
  payment_terms_days: 'fields.paymentTermsDays', offer_valid_until: 'fields.offerValidUntil',
}
export const aiFieldLabel = (form: string) => LABEL[form] ?? form

/**
 * «Fill from document»: the AI reads a slip, quote request or e-mail; every
 * suggested field shows its confidence and the snippet it came from; the user
 * ticks what to take. Nothing is saved here — the form is filled, the user
 * checks it and saves.
 */
export function AiFillPanel({ open, onClose, onApply, excludeId }: {
  open: boolean
  onClose: () => void
  onApply: (picked: Suggestion[]) => void
  excludeId?: string
}) {
  const { t } = useTranslation()
  const lobs = useLinesOfBusiness()
  const countries = useCountries()
  const currencies = useCurrencies()
  const parties = useCounterparties()
  const [source, setSource] = useState<'file' | 'text'>('file')
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AiSubmission | null>(null)
  const [picks, setPicks] = useState<Set<string>>(new Set())

  const suggestions = useMemo(
    () => (result ? toSuggestions(result, { lobs: lobs.data ?? [], countries: countries.data ?? [], currencies: currencies.data ?? [], parties: parties.data ?? [] }) : []),
    [result, lobs.data, countries.data, currencies.data, parties.data],
  )
  const val = (k: string) => suggestions.find((s) => s.form === k)?.value || null
  const dupes = useDuplicates(result ? { insured_name: val('insured_name'), mga_id: val('mga_id'), period_from: val('period_from') } : null)
  const duplicates = (dupes.data ?? []).filter((d) => d.row.id !== excludeId)

  function reset() {
    setResult(null)
    setError(null)
    setPicks(new Set())
  }

  async function read() {
    setBusy(true)
    setError(null)
    try {
      const r = await extractSubmission(source === 'file' && file ? { file } : { text })
      setResult(r)
      const s = toSuggestions(r, { lobs: lobs.data ?? [], countries: countries.data ?? [], currencies: currencies.data ?? [], parties: parties.data ?? [] })
      setPicks(defaultPicks(s))
    } catch (e) {
      const code = e instanceof AiError ? e.code : 'error'
      setError(code === 'too_big' ? t('ai.tooBig') : code === 'not_configured' ? t('ai.notConfigured') : code === 'disabled' ? t('ai.disabled') : code === 'limit' ? t('ai.limit') : code === 'refused' ? t('ai.refused') : e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const ready = source === 'file' ? Boolean(file) : text.trim().length > 20
  const problemText = (s: Suggestion) =>
    s.problem === 'noMatch' ? t('ai.problem.noMatch', { name: s.raw })
      : s.problem === 'unsureMatch' ? t('ai.problem.unsureMatch', { names: s.matches!.map((m) => m.party.name).join(', ') })
        : s.problem ? t(`ai.problem.${s.problem}`, { value: s.raw })
          : null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) { reset(); onClose() } }}>
      <DialogContent className="max-w-3xl" data-ai-panel>
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2"><Sparkles className="size-5 text-brand-600" />{t('ai.fillTitle')}</DialogTitle>
          <DialogDescription>{t('ai.fillHint')}</DialogDescription>
        </DialogHeader>

        {!result && (
          <div className="grid gap-4">
            <SegmentedControl ariaLabel={t('ai.source')} value={source} onChange={setSource} options={[{ value: 'file' as const, label: t('ai.fromFile') }, { value: 'text' as const, label: t('ai.fromText') }]} />
            {source === 'file' ? (
              <Field label={t('ai.document')} hint={t('ai.documentHint')}>
                <Input type="file" accept={AI_FILE_TYPES} onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-ai-file />
              </Field>
            ) : (
              <Field label={t('ai.pasteText')} hint={t('ai.pasteHint')}>
                <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} data-ai-text />
              </Field>
            )}
            <p className="text-caption text-muted-foreground">{t('ai.privacy')}</p>
          </div>
        )}

        {result && (
          <div className="grid gap-4" data-ai-result>
            <p className="text-caption text-muted-foreground">
              {result.cached ? t('ai.fromCache') : t('ai.readBy', { model: result.model ?? '' })} · {t('ai.pickHint')}
            </p>
            {duplicates.length > 0 && (
              <div role="alert" className="grid gap-1 rounded-md border border-warning-300 bg-warning-50 p-3 text-body text-warning-800" data-ai-duplicates>
                <p className="inline-flex items-center gap-2 font-medium"><AlertTriangle className="size-4" />{t('ai.duplicates')}</p>
                <ul className="grid gap-0.5">
                  {duplicates.map((d) => (
                    <li key={d.row.id}>
                      <Link to={`/submissions/${d.row.id}`} target="_blank" className="font-medium text-link num hover:underline">{d.row.ref_no}</Link>
                      {' · '}{d.row.insured_name}{d.row.period_from && ` · ${formatDate(d.row.period_from)}`}
                      <span className="text-caption"> · {d.reasons.map((r) => t(`ai.dupReason.${r}`)).join(', ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.notes.length > 0 && (
              <div className="rounded-md border bg-slate-50 p-3 text-body" data-ai-notes>
                <p className="font-medium">{t('ai.notes')}</p>
                <ul className="mt-1 list-disc pl-5">{result.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </div>
            )}
            {suggestions.length === 0 ? (
              <p className="text-body text-muted-foreground">{t('ai.nothingFound')}</p>
            ) : (
              <ul className="grid gap-2" data-ai-suggestions>
                {suggestions.map((s) => {
                  const usable = s.value !== ''
                  const problem = problemText(s)
                  return (
                    <li key={s.form} className={cn('grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-md border px-3 py-2', !usable && 'bg-slate-50')} data-ai-field={s.form}>
                      <input
                        type="checkbox"
                        className="mt-1"
                        aria-label={t('ai.use', { field: t(aiFieldLabel(s.form)) })}
                        disabled={!usable}
                        checked={picks.has(s.form)}
                        onChange={() => setPicks((p) => {
                          const next = new Set(p)
                          if (next.has(s.form)) next.delete(s.form)
                          else next.add(s.form)
                          return next
                        })}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="text-caption text-muted-foreground">{t(aiFieldLabel(s.form))}</span>
                          <ConfidenceBadge value={s.confidence} />
                        </div>
                        <p className={cn('break-words text-body font-medium', !usable && 'text-muted-foreground line-through')}>{s.display ?? s.raw}</p>
                        {problem && <p className="text-caption text-warning-800">{problem}</p>}
                        {s.source && <p className="truncate text-caption text-muted-foreground" title={s.source}><FileText className="mr-1 inline size-3" />«{s.source}»</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {error && <p role="alert" className="rounded-md bg-danger-100 p-3 text-body text-danger-700">{error}</p>}
        <DialogFooter>
          {result ? (
            <>
              <Button variant="outline" onClick={reset}>{t('ai.another')}</Button>
              <Button onClick={() => { onApply(suggestions.filter((s) => picks.has(s.form) && s.value !== '')); reset(); onClose() }} disabled={picks.size === 0} data-ai-apply>
                {t('ai.applyN', { count: picks.size })}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
              <Button onClick={() => void read()} disabled={!ready || busy} data-ai-read>
                {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {busy ? t('ai.reading') : t('ai.read')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
