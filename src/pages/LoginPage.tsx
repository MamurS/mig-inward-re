import { useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { useAuth } from '@/auth/AuthProvider'
import { supabaseConfigured } from '@/lib/supabase'
import { FullPageSpinner } from '@/components/FullPageSpinner'

const schema = z.object({
  email: z.string().trim().email('auth.invalidEmail'),
  password: z.string().min(1, 'auth.passwordRequired'),
})
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { t } = useTranslation()
  const { session, sessionLoading, signIn } = useAuth()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })

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

  return (
    <div className="flex min-h-screen flex-col bg-sidebar">
      <div className="flex justify-end p-4">
        <LanguageSwitcher variant="outline" />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center text-white">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-lg bg-white/10 text-lead font-display-bold">MIG</div>
            <div className="text-lead font-semibold">{t('app.name')}</div>
            <div className="text-body text-sidebar-muted">{t('app.tagline')}</div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t('auth.signInTitle')}</CardTitle>
              <CardDescription>{t('auth.signInSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              {!supabaseConfigured && (
                <p className="mb-4 rounded-md bg-destructive/10 p-3 text-body text-destructive">{t('auth.notConfigured')}</p>
              )}
              <form onSubmit={onSubmit} className="grid gap-4" noValidate>
                <div className="grid gap-2">
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input id="email" type="email" autoComplete="username" aria-invalid={!!errors.email} {...register('email')} />
                  {errors.email && <p className="text-caption text-destructive">{t(errors.email.message ?? '')}</p>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">{t('auth.password')}</Label>
                  <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register('password')} />
                  {errors.password && <p className="text-caption text-destructive">{t(errors.password.message ?? '')}</p>}
                </div>
                {error && (
                  <p className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-body text-destructive">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    {error}
                  </p>
                )}
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="animate-spin" />}
                  {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
