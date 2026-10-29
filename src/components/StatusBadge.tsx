import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { SubmissionStatus } from '@/lib/status'

export function StatusBadge({ status, className }: { status: SubmissionStatus | null; className?: string }) {
  const { t } = useTranslation()
  if (!status) return null
  return <Badge tone={status} className={className}>{t(`status.${status}`)}</Badge>
}
