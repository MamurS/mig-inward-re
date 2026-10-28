import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function ForbiddenPage() {
  const { t } = useTranslation()
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">{t('access.forbiddenTitle')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('access.forbiddenBody')}</p>
      <Button asChild className="mt-6" variant="outline">
        <Link to="/">{t('access.goHome')}</Link>
      </Button>
    </div>
  )
}
