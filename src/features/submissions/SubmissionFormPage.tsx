import { useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Controller, useForm, useWatch, type UseFormRegisterReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Info, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/Field'
import { StatusBadge } from '@/components/StatusBadge'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { calcFigures, cleanDecimal, isDecimal, toScaled } from '@/lib/decimal'
import { formatAmount, formatPct, isoDate } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import { useCounterparties, useCountries, useCurrencies, useLinesOfBusiness, useLocalName, useUsers, userName } from '@/hooks/useReference'
import { QuickAddCounterparty } from '@/features/counterparties/QuickAddCounterparty'
import { useSubmission, type SubmissionRow } from './api'

// ---------------------------------------------------------------------------
// Schema: every numeric field is kept as a string (exact decimal) until saved.
// Messages are i18n keys.
// ---------------------------------------------------------------------------
const MAX_AMOUNT_INT_DIGITS = 16 // numeric(18,2)

const amount = z
  .string()
  .refine((v) => v.trim() === '' || isDecimal(v, 2), 'v.amount')
  .refine((v) => v.trim() === '' || !cleanDecimal(v).startsWith('-'), 'v.nonNegative')
  .refine((v) => v.trim() === '' || cleanDecimal(v).split('.')[0].length <= MAX_AMOUNT_INT_DIGITS, 'v.tooLarge')
const pct = z
  .string()
  .refine((v) => v.trim() === '' || isDecimal(v, 6), 'v.pct')
  .refine((v) => v.trim() === '' || (Number(cleanDecimal(v)) >= 0 && Number(cleanDecimal(v)) <= 100), 'v.pctRange')

const schema = z
  .object({
    received_at: z.string().min(1, 'v.required'),
    mga_id: z.string().min(1, 'v.required'),
    broker_id: z.string(),
    source_party_id: z.string().min(1, 'v.required'),
    business_type: z.enum(['facultative', 'binder']),
    underwriter_id: z.string(),
    insured_name: z.string().trim().min(1, 'v.required'),
    insured_country: z.string(),
    lob_id: z.string(),
    risk_description: z.string(),
    period_from: z.string(),
    period_to: z.string(),
    currency: z.string().min(1, 'v.required'),
    sum_insured_100: amount,
    limit_100: amount,
    deductible: amount,
    gross_premium_100: amount,
    commission_pct: pct,
    brokerage_pct: pct,
    written_share_pct: pct.refine((v) => v.trim() === '' || Number(cleanDecimal(v)) > 0, 'v.shareAboveZero'),
    offer_valid_until: z.string(),
    payment_terms_days: z.string().refine((v) => v.trim() === '' || /^\d{1,4}$/.test(v.trim()), 'v.days'),
    ppw_date: z.string(),
    notes: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.period_from && v.period_to && v.period_to < v.period_from) {
      ctx.addIssue({ code: 'custom', path: ['period_to'], message: 'v.periodOrder' })
    }
    const c = toScaled(v.commission_pct || '0', 6) ?? 0n
    const b = toScaled(v.brokerage_pct || '0', 6) ?? 0n
    if (c + b > 100_000_000n) ctx.addIssue({ code: 'custom', path: ['brokerage_pct'], message: 'v.deductionsOver100' })
  })

type FormValues = z.infer<typeof schema>

const toStr = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v))
const orNull = (v: string) => (v.trim() === '' ? null : v.trim())
const decOrNull = (v: string) => (v.trim() === '' ? null : cleanDecimal(v))

function rowToForm(r: SubmissionRow): FormValues {
  return {
    received_at: r.received_at ?? isoDate(),
    mga_id: r.mga_id ?? '',
    broker_id: r.broker_id ?? '',
    source_party_id: r.source_party_id ?? '',
    business_type: r.business_type ?? 'facultative',
    underwriter_id: r.underwriter_id ?? '',
    insured_name: r.insured_name ?? '',
    insured_country: r.insured_country ?? '',
    lob_id: r.lob_id ?? '',
    risk_description: r.risk_description ?? '',
    period_from: r.period_from ?? '',
    period_to: r.period_to ?? '',
    currency: r.currency ?? 'USD',
    sum_insured_100: toStr(r.sum_insured_100),
    limit_100: toStr(r.limit_100),
    deductible: toStr(r.deductible),
    gross_premium_100: toStr(r.gross_premium_100),
    commission_pct: toStr(r.commission_pct),
    brokerage_pct: toStr(r.brokerage_pct),
    written_share_pct: toStr(r.written_share_pct),
    offer_valid_until: r.offer_valid_until ?? '',
    payment_terms_days: toStr(r.payment_terms_days),
    ppw_date: r.ppw_date ?? '',
    notes: r.notes ?? '',
  }
}

function formToPayload(v: FormValues) {
  return {
    received_at: v.received_at,
    mga_id: v.mga_id,
    broker_id: orNull(v.broker_id),
    source_party_id: v.source_party_id,
    business_type: v.business_type,
    underwriter_id: orNull(v.underwriter_id),
    insured_name: v.insured_name.trim(),
    insured_country: orNull(v.insured_country),
    lob_id: orNull(v.lob_id),
    risk_description: orNull(v.risk_description),
    period_from: orNull(v.period_from),
    period_to: orNull(v.period_to),
    currency: v.currency,
    // exact decimals are sent as strings; Postgres casts them to numeric without float rounding
    sum_insured_100: decOrNull(v.sum_insured_100),
    limit_100: decOrNull(v.limit_100),
    deductible: decOrNull(v.deductible),
    gross_premium_100: decOrNull(v.gross_premium_100),
    commission_pct: decOrNull(v.commission_pct) ?? '0',
    brokerage_pct: decOrNull(v.brokerage_pct) ?? '0',
    written_share_pct: decOrNull(v.written_share_pct),
    offer_valid_until: orNull(v.offer_valid_until),
    payment_terms_days: v.payment_terms_days.trim() === '' ? null : Number(v.payment_terms_days),
    ppw_date: orNull(v.ppw_date),
    notes: orNull(v.notes),
  }
}

export function SubmissionFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const existing = useSubmission(id)
  if (isEdit && existing.isLoading) return <FullPageSpinner />
  if (isEdit && !existing.data) return <p className="p-6 text-body text-muted-foreground">—</p>
  return <SubmissionForm existing={existing.data ?? null} />
}

function SubmissionForm({ existing }: { existing: SubmissionRow | null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const localName = useLocalName()
  const counterparties = useCounterparties()
  const countries = useCountries()
  const currencies = useCurrencies()
  const lobs = useLinesOfBusiness()
  const users = useUsers()

  const defaults = useMemo<FormValues>(
    () =>
      existing
        ? rowToForm(existing)
        : {
            ...rowToForm({} as SubmissionRow),
            received_at: isoDate(),
            currency: 'USD',
            underwriter_id: profile?.id ?? '',
            payment_terms_days: '90',
          },
    [existing, profile?.id],
  )

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults, mode: 'onTouched' })

  const v = useWatch({ control })
  const sourceTouched = useRef(Boolean(existing))

  // Default "received from" = broker if there is one, otherwise the MGA (until the user picks it)
  useEffect(() => {
    if (sourceTouched.current) return
    setValue('source_party_id', v.broker_id || v.mga_id || '', { shouldDirty: true })
  }, [v.broker_id, v.mga_id, setValue])

  const mgas = counterparties.data?.filter((c) => c.type === 'mga' && (c.active || c.id === v.mga_id)) ?? []
  const brokers = counterparties.data?.filter((c) => c.type === 'broker' && (c.active || c.id === v.broker_id)) ?? []
  const sources = counterparties.data?.filter((c) => c.active || c.id === v.source_party_id) ?? []
  const underwriters = users.data?.filter((u) => (u.role === 'underwriter' || u.role === 'admin') && u.active) ?? []

  // Same FX date rule as the database view: bound date if bound, otherwise received date
  const fxDate = existing?.status === 'bound' && existing.bound_at ? existing.bound_at.slice(0, 10) : v.received_at
  const fx = useQuery({
    queryKey: ['fx', v.currency, fxDate],
    enabled: Boolean(v.currency && fxDate),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fx_rate_to_usd', { p_currency: v.currency!, p_date: fxDate! })
      if (error) throw error
      return data as number | null
    },
  })

  const isBound = existing?.status === 'bound'
  const shareForCalc = isBound ? toStr(existing?.signed_share_pct) : v.written_share_pct
  const figures = calcFigures({
    grossPremium100: v.gross_premium_100 && isDecimal(v.gross_premium_100, 2) ? v.gross_premium_100 : null,
    sumInsured100: v.sum_insured_100 && isDecimal(v.sum_insured_100, 2) ? v.sum_insured_100 : null,
    limit100: v.limit_100 && isDecimal(v.limit_100, 2) ? v.limit_100 : null,
    sharePct: shareForCalc && isDecimal(shareForCalc, 6) ? shareForCalc : null,
    commissionPct: v.commission_pct && isDecimal(v.commission_pct, 6) ? v.commission_pct : '0',
    brokeragePct: v.brokerage_pct && isDecimal(v.brokerage_pct, 6) ? v.brokerage_pct : '0',
    fxRateToUsd: fx.data ?? null,
  })

  const err = (name: keyof FormValues) => {
    const m = errors[name]?.message
    return m ? t(m) : undefined
  }

  const onSubmit = handleSubmit(async (values) => {
    const payload = formToPayload(values)
    try {
      if (existing) {
        // Supabase types declare numerics as number; strings keep exact decimals
        const { error } = await supabase.from('submissions').update(payload as never).eq('id', existing.id!)
        if (error) throw error
        await Promise.all([qc.invalidateQueries({ queryKey: ['submissions'] }), qc.invalidateQueries({ queryKey: ['audit'] })])
        toast.success(t('sub.saved'))
        navigate(`/submissions/${existing.id}`)
      } else {
        const { data, error } = await supabase.from('submissions').insert(payload as never).select('id, ref_no').single()
        if (error) throw error
        await Promise.all([qc.invalidateQueries({ queryKey: ['submissions'] }), qc.invalidateQueries({ queryKey: ['audit'] })])
        toast.success(t('sub.created', { ref: data.ref_no }))
        navigate(`/submissions/${data.id}`)
      }
    } catch (e) {
      toast.error(errorMessage(e))
    }
  })

  const reg = (name: keyof FormValues): UseFormRegisterReturn & { 'aria-invalid'?: boolean; id: string } => ({
    ...register(name),
    id: name,
    'aria-invalid': Boolean(errors[name]) || undefined,
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        title={existing ? t('sub.editTitle', { ref: existing.ref_no }) : t('sub.newTitle')}
        subtitle={existing ? existing.insured_name ?? undefined : t('sub.newSubtitle')}
      />

      {existing && (
        <div className="mb-4 flex items-center gap-2 text-body text-muted-foreground">
          <StatusBadge status={existing.status} />
          <Info className="size-4" />
          {t('sub.statusViaActions')}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-4">
          {/* Source */}
          <Card>
            <CardHeader><CardTitle>{t('sub.section.source')}</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t('fields.receivedAt')} htmlFor="received_at" error={err('received_at')} required>
                <Input type="date" {...reg('received_at')} />
              </Field>
              <Field label={t('fields.mga')} htmlFor="mga_id" error={err('mga_id')} required>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <NativeSelect {...reg('mga_id')}>
                      <option value="">—</option>
                      {mgas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </NativeSelect>
                  </div>
                  <QuickAddCounterparty type="mga" onCreated={(newId) => setValue('mga_id', newId, { shouldDirty: true, shouldValidate: true })} />
                </div>
              </Field>
              <Field label={t('fields.broker')} htmlFor="broker_id" hint={t('sub.brokerHint')}>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <NativeSelect {...reg('broker_id')}>
                      <option value="">{t('sub.directNoBroker')}</option>
                      {brokers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </NativeSelect>
                  </div>
                  <QuickAddCounterparty type="broker" onCreated={(newId) => setValue('broker_id', newId, { shouldDirty: true })} />
                </div>
              </Field>
              <Field label={t('fields.sourceParty')} htmlFor="source_party_id" error={err('source_party_id')} hint={t('sub.sourceHint')} required>
                <NativeSelect
                  {...reg('source_party_id')}
                  onChange={(e) => {
                    sourceTouched.current = true
                    void register('source_party_id').onChange(e)
                  }}
                >
                  <option value="">—</option>
                  {sources.map((c) => <option key={c.id} value={c.id}>{c.name} · {t(`counterpartyType.${c.type}`)}</option>)}
                </NativeSelect>
              </Field>
              <Field label={t('fields.businessType')} htmlFor="business_type">
                <Controller
                  control={control}
                  name="business_type"
                  render={({ field }) => (
                    <SegmentedControl
                      id="business_type"
                      ariaLabel={t('fields.businessType')}
                      value={field.value}
                      onChange={(val) => { field.onChange(val); field.onBlur() }}
                      options={[
                        { value: 'facultative' as const, label: t('businessType.facultative') },
                        { value: 'binder' as const, label: t('businessType.binder') },
                      ]}
                    />
                  )}
                />
              </Field>
              <Field label={t('fields.underwriter')} htmlFor="underwriter_id">
                <NativeSelect {...reg('underwriter_id')}>
                  <option value="">—</option>
                  {underwriters.map((u) => <option key={u.id} value={u.id}>{userName(u)}</option>)}
                </NativeSelect>
              </Field>
            </CardContent>
          </Card>

          {/* Risk */}
          <Card>
            <CardHeader><CardTitle>{t('sub.section.risk')}</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t('fields.insuredName')} htmlFor="insured_name" error={err('insured_name')} required className="sm:col-span-2">
                <Input {...reg('insured_name')} />
              </Field>
              <Field label={t('fields.insuredCountry')} htmlFor="insured_country">
                <NativeSelect {...reg('insured_country')}>
                  <option value="">—</option>
                  {countries.data?.map((c) => <option key={c.code} value={c.code}>{localName(c)}</option>)}
                </NativeSelect>
              </Field>
              <Field label={t('fields.lob')} htmlFor="lob_id">
                <NativeSelect {...reg('lob_id')}>
                  <option value="">—</option>
                  {lobs.data?.filter((l) => l.active || l.id === v.lob_id).map((l) => <option key={l.id} value={l.id}>{localName(l)}</option>)}
                </NativeSelect>
              </Field>
              <Field label={t('fields.periodFrom')} htmlFor="period_from" error={err('period_from')}>
                <Input type="date" {...reg('period_from')} />
              </Field>
              <Field label={t('fields.periodTo')} htmlFor="period_to" error={err('period_to')}>
                <Input type="date" {...reg('period_to')} />
              </Field>
              <Field label={t('fields.riskDescription')} htmlFor="risk_description" className="sm:col-span-2 lg:col-span-3">
                <Textarea rows={3} {...reg('risk_description')} />
              </Field>
            </CardContent>
          </Card>

          {/* Financials */}
          <Card>
            <CardHeader><CardTitle>{t('sub.section.financials')}</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t('fields.currency')} htmlFor="currency" error={err('currency')} required>
                <NativeSelect {...reg('currency')}>
                  {currencies.data?.filter((c) => c.active || c.code === v.currency).map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                </NativeSelect>
              </Field>
              <Field label={t('fields.sumInsured100')} htmlFor="sum_insured_100" error={err('sum_insured_100')}>
                <Input inputMode="decimal" className="text-right tabular-nums" {...reg('sum_insured_100')} />
              </Field>
              <Field label={t('fields.limit100')} htmlFor="limit_100" error={err('limit_100')}>
                <Input inputMode="decimal" className="text-right tabular-nums" {...reg('limit_100')} />
              </Field>
              <Field label={t('fields.deductible')} htmlFor="deductible" error={err('deductible')}>
                <Input inputMode="decimal" className="text-right tabular-nums" {...reg('deductible')} />
              </Field>
              <Field label={t('fields.grossPremium100')} htmlFor="gross_premium_100" error={err('gross_premium_100')}>
                <Input inputMode="decimal" className="text-right tabular-nums" {...reg('gross_premium_100')} />
              </Field>
              <div />
              <Field label={t('fields.commissionPct')} htmlFor="commission_pct" error={err('commission_pct')} hint={t('sub.commissionHint')}>
                <Input inputMode="decimal" className="text-right tabular-nums" {...reg('commission_pct')} />
              </Field>
              <Field label={t('fields.brokeragePct')} htmlFor="brokerage_pct" error={err('brokerage_pct')}>
                <Input inputMode="decimal" className="text-right tabular-nums" {...reg('brokerage_pct')} />
              </Field>
            </CardContent>
          </Card>

          {/* Terms */}
          <Card>
            <CardHeader><CardTitle>{t('sub.section.terms')}</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t('fields.writtenSharePct')} htmlFor="written_share_pct" error={err('written_share_pct')} hint={t('sub.writtenHint')}>
                <Input inputMode="decimal" className="text-right tabular-nums" {...reg('written_share_pct')} />
              </Field>
              <Field label={t('fields.signedSharePct')}>
                <Input value={existing?.signed_share_pct === null || existing?.signed_share_pct === undefined ? '' : formatPct(existing.signed_share_pct)} disabled placeholder={t('sub.signedSetOnBind')} />
              </Field>
              <Field label={t('fields.offerValidUntil')} htmlFor="offer_valid_until">
                <Input type="date" {...reg('offer_valid_until')} />
              </Field>
              <Field label={t('fields.paymentTermsDays')} htmlFor="payment_terms_days" error={err('payment_terms_days')}>
                <Input inputMode="numeric" className="text-right tabular-nums" {...reg('payment_terms_days')} />
              </Field>
              <Field label={t('fields.ppwDate')} htmlFor="ppw_date" hint={t('sub.ppwHint')}>
                <Input type="date" {...reg('ppw_date')} />
              </Field>
              <Field label={t('fields.notes')} htmlFor="notes" className="sm:col-span-2 lg:col-span-3">
                <Textarea rows={3} {...reg('notes')} />
              </Field>
            </CardContent>
          </Card>
        </div>

        {/* Live figures */}
        <div className="xl:sticky xl:top-20 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>{t('sub.liveFigures')}</CardTitle>
              <p className="text-caption text-muted-foreground">
                {isBound ? t('sub.basisSigned', { pct: formatPct(shareForCalc) }) : shareForCalc ? t('sub.basisWritten', { pct: formatPct(shareForCalc) }) : t('sub.enterShare')}
              </p>
            </CardHeader>
            <CardContent>
              <FiguresTable figures={figures} currency={v.currency ?? ''} fxRate={fx.data ?? null} fxLoading={fx.isLoading} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky footer: the outcome button is always in reach, whatever the scroll */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center justify-end gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <span className="mr-auto text-caption text-muted-foreground">
          {Object.keys(errors).length > 0 ? (
            <span className="font-medium text-destructive">{t('ui.form.fixErrors', { count: Object.keys(errors).length })}</span>
          ) : isDirty ? (
            t('ui.form.unsaved')
          ) : existing ? (
            t('ui.form.noChanges')
          ) : null}
        </span>
        <Button type="button" variant="outline" asChild>
          <Link to={existing ? `/submissions/${existing.id}` : '/submissions'}>
            <ArrowLeft />
            {t('common.cancel')}
          </Link>
        </Button>
        <Button type="submit" disabled={isSubmitting || (Boolean(existing) && !isDirty)}>
          {isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}
          {existing ? t('ui.form.saveChanges') : t('ui.form.createSubmission')}
        </Button>
      </div>
    </form>
  )
}

export function FiguresTable({
  figures,
  currency,
  fxRate,
  fxLoading,
}: {
  figures: ReturnType<typeof calcFigures> | {
    ourGross: number | string | null; commission: number | string | null; brokerage: number | string | null; ourNet: number | string | null
    ourSumInsured: number | string | null; ourLimit: number | string | null; ourGrossUsd: number | string | null; ourNetUsd: number | string | null
  }
  currency: string
  fxRate: number | null
  fxLoading?: boolean
}) {
  const { t } = useTranslation()
  const Row = ({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) => (
    <div className={`flex items-baseline justify-between gap-3 py-2 text-body ${strong ? 'font-semibold' : ''} ${muted ? 'text-muted-foreground' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
  return (
    <div className="divide-y">
      <div>
        <Row label={t('fields.ourSumInsured')} value={formatAmount(figures.ourSumInsured)} muted />
        <Row label={t('fields.ourLimit')} value={formatAmount(figures.ourLimit)} muted />
      </div>
      <div>
        <Row label={`${t('fields.ourGrossPremium')} (${currency})`} value={formatAmount(figures.ourGross)} strong />
        <Row label={`− ${t('fields.commission')}`} value={formatAmount(figures.commission)} />
        <Row label={`− ${t('fields.brokerage')}`} value={formatAmount(figures.brokerage)} />
        <Row label={`${t('fields.ourNetPremium')} (${currency})`} value={formatAmount(figures.ourNet)} strong />
      </div>
      <div>
        <Row label={t('fields.ourGrossUsd')} value={formatAmount(figures.ourGrossUsd)} />
        <Row label={t('fields.ourNetUsd')} value={formatAmount(figures.ourNetUsd)} />
        <p className="pt-1 text-caption text-muted-foreground">
          {currency === 'USD' ? '' : fxLoading ? t('common.loading') : fxRate ? t('sub.fxUsed', { rate: fxRate, currency }) : t('sub.noFx', { currency })}
        </p>
      </div>
    </div>
  )
}
