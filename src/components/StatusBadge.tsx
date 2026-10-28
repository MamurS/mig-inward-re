import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { STATUS_STYLES, type SubmissionStatus } from '@/lib/status'

export function StatusBadge({ status, className }: { status: SubmissionStatus | null; className?: string }) {
  const { t } = useTranslation()
  if (!status) return null
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap', STATUS_STYLES[status], className)}>
      {t(`status.${status}`)}
    </span>
  )
}
