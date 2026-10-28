import { useTranslation } from 'react-i18next'
import { Construction } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'

/** Temporary page shell until the real page is built in a later step. */
export function PlaceholderPage({ page }: { page: 'dashboard' | 'submissions' | 'agenda' | 'counterparties' | 'admin' }) {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={t(`pages.${page}.title`)} subtitle={t(`pages.${page}.subtitle`)} />
      <Card>
        <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
          <Construction className="size-5" />
          {t('common.comingSoon')}
        </CardContent>
      </Card>
    </>
  )
}
