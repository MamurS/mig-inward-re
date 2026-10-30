import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Field } from '@/components/Field'
import { useAuth } from '@/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { formatAmount, formatDate, formatPct, isoDate } from '@/lib/format'
import { cleanDecimal, isDecimal } from '@/lib/decimal'
import { useCurrencies, useUsers, userName } from '@/hooks/useReference'
import { createClaim, useCoverageCheck, useInvalidateClaims } from './api'

type Risk = {
  id: string
  ref_no: string
  insured_name: string
  mga_name: string | null
  currency: string
  period_from: string | null
  period_to: string | null
  signed_share_pct: number | null
  status: string
}
const RISK_COLUMNS = 'id, ref_no, insured_name, mga_name, currency, period_from, period_to, signed_share_pct, status'

/** Bound risks matching the typed words (ref no. or insured), for the picker. */
function useRiskSearch(text: string, enabled: boolean) {
  const words = text.trim().replace(/[%,()"\\*]/g, ' ').trim()
  return useQuery({
    queryKey: ['claims', 'risk-search', words],
    enabled: enabled && words.length >= 2,
    queryFn: async () => {
      const v = `"*${words}*"`
      const { data, error } = await supabase
        .from('submissions_v')
        .select(RISK_COLUMNS)
        .eq('status', 'bound')
        .or(`ref_no.ilike.${v},insured_name.ilike.${v},mga_name.ilike.${v}`)
        .order('received_at', { ascending: false })
        .limit(8)
      if (error) throw error
      return data as Risk[]
    },
  })
}

/**
 * New claim: pick a bound risk (searchable), the loss, and see the coverage
 * check inline. A failed check never blocks silently: saving asks for a
 * comment, which the database also requires.
 */
export function NewClaimDialog({ open, onClose, submissionId }: { open: boolean; onClose: () => void; submissionId?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const users = useUsers()
  const currencies = useCurrencies()
  const invalidate = useInvalidateClaims()
  const [search, setSearch] = useState('')
  const [risk, setRisk] = useState<Risk | null>(null)
  const empty = { notified_date: isoDate(), date_of_loss: '', currency: '', estimate_100: '', cause: '', location: '', description: '', cedent_claim_ref: '', handler_id: '', coverage_comment: '', notes: '' }
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const results = useRiskSearch(search, open && !risk)
  const coverage = useCoverageCheck(risk?.id ?? null, form.date_of_loss, form.currency)
  const issues = coverage.data ?? []

  // a preset risk (from its Claims tab)
  const preset = useQuery({
    queryKey: ['claims', 'risk', submissionId],
    enabled: open && Boolean(submissionId),
    queryFn: async () => {
      const { data, error } = await supabase.from('submissions_v').select(RISK_COLUMNS).eq('id', submissionId!).single()
      if (error) throw error
      return data as Risk
    },
  })

  useEffect(() => {
    if (!open) return
    setSearch('')
    setRisk(null)
    setForm({ ...empty, handler_id: profile?.id ?? '' })
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  useEffect(() => {
    if (preset.data) choose(preset.data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset.data])

  function choose(r: Risk) {
    setRisk(r)
    setForm((f) => ({ ...f, currency: r.currency }))
  }

  const estimateOk = form.estimate_100.trim() === '' || isDecimal(form.estimate_100, 2)
  const needsComment = issues.length > 0
  const ready = Boolean(risk && form.date_of_loss && form.notified_date && form.currency && estimateOk && (!needsComment || form.coverage_comment.trim()))
  const ourShare = risk?.signed_share_pct !== null && risk?.signed_share_pct !== undefined && form.estimate_100.trim() && estimateOk
    ? (Number(cleanDecimal(form.estimate_100)) * Number(risk.signed_share_pct)) / 100
    : null

  async function save() {
    if (!risk || !ready) return
    setBusy(true)
    setError(null)
    const nul = (v: string) => (v.trim() === '' ? null : v.trim())
    try {
      const c = await createClaim({
        submission_id: risk.id,
        notified_date: form.notified_date,
        date_of_loss: form.date_of_loss,
        currency: form.currency,
        estimate_100: form.estimate_100.trim() ? cleanDecimal(form.estimate_100) : null,
        cause: nul(form.cause),
        location: nul(form.location),
        description: nul(form.description),
        cedent_claim_ref: nul(form.cedent_claim_ref),
        handler_id: form.handler_id || null,
        coverage_comment: needsComment ? form.coverage_comment.trim() : null,
        notes: nul(form.notes),
      })
      await invalidate()
      toast.success(t('claim.created', { no: c.claim_no }))
      onClose()
      navigate(`/claims/${c.id}`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('claim.new')}</DialogTitle>
          <DialogDescription>{t('claim.newHint')}</DialogDescription>
        </DialogHeader>

        {!risk ? (
          <Field label={t('claim.risk')} hint={t('claim.riskHint')} htmlFor="claim-risk-search">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="claim-risk-search" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('claim.riskPlaceholder')} autoFocus />
            </div>
            <ul className="mt-2 grid gap-1" data-risk-results>
              {results.data?.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => choose(r)} className="grid w-full grid-cols-[max-content_minmax(0,1fr)_auto] items-baseline gap-x-3 rounded-md border px-3 py-2 text-left text-body hover:border-input hover:bg-slate-50">
                    <span className="font-medium whitespace-nowrap text-link num">{r.ref_no}</span>
                    <span className="min-w-0">
                      <span className="block truncate" title={r.insured_name}>{r.insured_name}</span>
                      <span className="block truncate text-caption text-muted-foreground">{r.mga_name}</span>
                    </span>
                    <span className="text-caption whitespace-nowrap text-muted-foreground">{formatDate(r.period_from)} – {formatDate(r.period_to)}</span>
                  </button>
                </li>
              ))}
              {results.data?.length === 0 && <li className="text-body text-muted-foreground">{t('claim.noRisk')}</li>}
            </ul>
          </Field>
        ) : (
          <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border bg-slate-50 px-3 py-2 text-body" data-chosen-risk>
            <span className="min-w-0">
              <span className="font-medium num">{risk.ref_no}</span> · {risk.insured_name}
              <span className="block text-caption text-muted-foreground">
                {risk.mga_name} · {formatDate(risk.period_from)} – {formatDate(risk.period_to)} · {t('fields.signedSharePct')} {formatPct(risk.signed_share_pct)} · {risk.currency}
              </span>
            </span>
            {!submissionId && <Button size="sm" variant="ghost" onClick={() => setRisk(null)}>{t('claim.changeRisk')}</Button>}
          </div>
        )}

        {risk && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('claim.dateOfLoss')} required htmlFor="claim-dol">
              <Input id="claim-dol" type="date" value={form.date_of_loss} onChange={set('date_of_loss')} />
            </Field>
            <Field label={t('claim.notifiedDate')} required htmlFor="claim-notified">
              <Input id="claim-notified" type="date" value={form.notified_date} onChange={set('notified_date')} />
            </Field>
            <Field label={t('fields.currency')} required htmlFor="claim-ccy">
              <NativeSelect id="claim-ccy" value={form.currency} onChange={set('currency')}>
                {(currencies.data ?? []).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </NativeSelect>
            </Field>
            <Field label={t('claim.estimate100', { ccy: form.currency })} error={estimateOk ? undefined : t('v.amount')} htmlFor="claim-estimate"
              hint={ourShare !== null ? t('claim.ourShareIs', { amount: formatAmount(ourShare), ccy: form.currency }) : undefined}>
              <Input id="claim-estimate" inputMode="decimal" className="text-right tabular-nums" value={form.estimate_100} onChange={set('estimate_100')} />
            </Field>
            <Field label={t('claim.cause')} htmlFor="claim-cause"><Input id="claim-cause" value={form.cause} onChange={set('cause')} /></Field>
            <Field label={t('claim.location')} htmlFor="claim-location"><Input id="claim-location" value={form.location} onChange={set('location')} /></Field>
            <Field label={t('claim.cedentRef')} htmlFor="claim-cedent-ref"><Input id="claim-cedent-ref" value={form.cedent_claim_ref} onChange={set('cedent_claim_ref')} /></Field>
            <Field label={t('claim.handler')} htmlFor="claim-handler">
              <NativeSelect id="claim-handler" value={form.handler_id} onChange={set('handler_id')}>
                <option value="">—</option>
                {users.data?.filter((u) => u.active && (u.role === 'claims' || u.role === 'admin')).map((u) => <option key={u.id} value={u.id}>{userName(u)}</option>)}
              </NativeSelect>
            </Field>
            <Field label={t('claim.description')} className="sm:col-span-2" htmlFor="claim-description">
              <Textarea id="claim-description" rows={2} value={form.description} onChange={set('description')} />
            </Field>

            {/* the database's coverage check, live */}
            <div className="sm:col-span-2" data-coverage>
              {coverage.isFetching && <p className="text-caption text-muted-foreground"><Loader2 className="mr-1 inline size-3.5 animate-spin" />{t('claim.checking')}</p>}
              {!coverage.isFetching && form.date_of_loss && issues.length === 0 && (
                <p className="inline-flex items-center gap-2 text-body text-success-700"><CheckCircle2 className="size-4" />{t('claim.coverageOk')}</p>
              )}
              {issues.length > 0 && (
                <div role="alert" className="grid gap-2 rounded-md border border-warning-300 bg-warning-50 p-3 text-body">
                  <p className="inline-flex items-center gap-2 font-medium text-warning-800"><AlertTriangle className="size-4" />{t('claim.coverageWarn')}</p>
                  <ul className="list-disc pl-6 text-warning-800">
                    {issues.map((i) => <li key={i}>{t(`claim.coverage.${i}`, { from: formatDate(risk.period_from), to: formatDate(risk.period_to), ccy: risk.currency })}</li>)}
                  </ul>
                  <Field label={t('claim.coverageComment')} required htmlFor="claim-coverage-comment">
                    <Textarea id="claim-coverage-comment" rows={2} value={form.coverage_comment} onChange={set('coverage_comment')} />
                  </Field>
                </div>
              )}
            </div>
          </div>
        )}

        {error && <p role="alert" className="rounded-md bg-danger-100 p-3 text-body text-danger-700">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button onClick={() => void save()} disabled={busy || !ready}>
            {busy && <Loader2 className="animate-spin" />}
            {t('claim.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
