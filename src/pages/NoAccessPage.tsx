import { useTranslation } from 'react-i18next'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { useAuth } from '@/auth/AuthProvider'

export function NoAccessPage() {
  const { t } = useTranslation()
  const { session, signOut } = useAuth()
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-warning-600" />
            {t('access.noAccessTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-body text-muted-foreground">{t('access.noAccessBody', { email: session?.user.email ?? '' })}</p>
          <div className="flex justify-between">
            <LanguageSwitcher variant="outline" />
            <Button variant="outline" onClick={() => void signOut()}>
              {t('auth.signOut')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
