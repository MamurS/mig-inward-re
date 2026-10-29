import { useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/Field'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { useAuth } from '@/auth/AuthProvider'
import { supabaseConfigured } from '@/lib/supabase'
import { formatLongDate } from '@/lib/format'
import { FullPageSpinner } from '@/components/FullPageSpinner'

const schema = z.object({
  email: z.string().trim().email('auth.invalidEmail'),
  password: z.string().min(1, 'auth.passwordRequired'),
})
type FormValues = z.infer<typeof schema>

/** The owner's own photograph for the brand panel (VITE_LOGIN_PHOTO); without one, the drawn pattern. */
const PHOTO = (import.meta.env.VITE_LOGIN_PHOTO as string | undefined)?.trim() || null

/** Layers of cover, drawn as arcs: the brand panel's quiet signature. */
function BrandPattern() {
  return (
    <svg className="absolute inset-0 size-full" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g fill="none" className="stroke-navy-700" strokeWidth="1.5">
        {Array.from({ length: 9 }, (_, i) => (
          <circle key={i} cx="600" cy="800" r={140 + i * 70} />
        ))}
      </g>
      <g fill="none" className="stroke-navy-600" strokeWidth="2">
        <path d="M600 380a420 420 0 0 0-420 420" />
        <path d="M600 520a280 280 0 0 0-280 280" />
      </g>
      <circle cx="180" cy="800" r="6" className="fill-sky-400" />
      <circle cx="320" cy="800" r="6" className="fill-sky-400" />
    </svg>
  )
}

export function LoginPage() {
  const { t } = useTranslation()
  const { session, sessionLoading, signIn } = useAuth()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' }, mode: 'onTouched' })

  if (sessionLoading) return <FullPageSpinner />
  if (session) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />
  }

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    const res = await signIn(values.email, values.password)
    if (res.error) setError(/invalid login credentials/i.test(res.error) ? t('auth.invalidCredentials') : res.error)
  })

  const today = formatLongDate(new Date(), true)

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
      {/* Brand panel */}
      <section className="relative flex min-h-56 flex-col justify-between overflow-hidden bg-sidebar p-6 text-white lg:min-h-screen lg:p-12">
        {PHOTO ? (
          <>
            <img src={PHOTO} alt="" className="absolute inset-0 size-full object-cover" />
            {/* A navy veil, ≥ 70 % everywhere: white text stays ≥ 6 : 1 even over a white photograph */}
            <div className="absolute inset-0 bg-gradient-to-t from-navy-900/90 via-navy-900/75 to-navy-900/70" />
          </>
        ) : (
          <BrandPattern />
        )}
        <div className="relative flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-white/10 text-body font-display-bold text-white">MIG</div>
          <div className="leading-tight">
            <div className="text-body font-semibold text-white">{t('app.name')}</div>
            <div className="text-caption text-sidebar-muted">{t('app.tagline')}</div>
          </div>
        </div>
        <div className="relative hidden max-w-lg lg:block">
          <p className="font-display-bold text-display text-white">{t('auth.brandLine')}</p>
          <p className="mt-4 text-lead text-sidebar-muted">{t('auth.brandSub')}</p>
        </div>
        <p className="relative hidden text-caption text-sidebar-muted lg:block">© {new Date().getFullYear()} MIG</p>
      </section>

      {/* Form */}
      <section className="flex flex-col p-6 lg:p-12">
        <div className="flex justify-end">
          <LanguageSwitcher variant="outline" />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="grid w-full max-w-sm gap-8">
            <div className="grid gap-2">
              <p className="text-caption font-medium text-muted-foreground first-letter:uppercase">{today}</p>
              <h1 className="font-display-bold text-headline text-foreground">{t('auth.signInTitle')}</h1>
              <p className="text-body text-muted-foreground">{t('auth.signInSubtitle')}</p>
            </div>
            {!supabaseConfigured && (
              <p className="rounded-md bg-danger-100 p-3 text-body text-danger-700">{t('auth.notConfigured')}</p>
            )}
            <form onSubmit={onSubmit} className="grid gap-5" noValidate>
              <Field label={t('auth.email')} htmlFor="email" error={errors.email ? t(errors.email.message ?? '') : undefined}>
                <Input id="email" type="email" autoComplete="username" className="h-10" aria-invalid={!!errors.email} {...register('email')} />
              </Field>
              <Field label={t('auth.password')} htmlFor="password" error={errors.password ? t(errors.password.message ?? '') : undefined}>
                <Input id="password" type="password" autoComplete="current-password" className="h-10" aria-invalid={!!errors.password} {...register('password')} />
              </Field>
              {error && (
                <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-100 p-3 text-body text-danger-700">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
              </Button>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}
