import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import { STATUS_SOLID, type SubmissionStatus } from '@/lib/status'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * The submission's path at a glance: received → under review → offered →
 * bound, each reached step in its status colour with the date it was
 * reached. A submission that ended elsewhere (declined, NTU, no response)
 * shows that outcome in place of the next step.
 */
const PATH: SubmissionStatus[] = ['received', 'under_review', 'offered', 'bound']
/** Where each status sits on the path. */
const POSITION: Record<SubmissionStatus, number> = { received: 0, under_review: 1, offered: 2, no_response: 3, bound: 3, declined: 2, ntu: 3 }
const ENDED: SubmissionStatus[] = ['declined', 'ntu', 'no_response']

export function StatusStepper({ status, reachedAt }: { status: SubmissionStatus; reachedAt: Partial<Record<SubmissionStatus, string>> }) {
  const { t } = useTranslation()
  const at = POSITION[status]
  const ended = ENDED.includes(status)
  const steps = PATH.map((s, i) => (ended && i === at ? status : s))

  return (
    <ol className="grid grid-cols-4 gap-2" aria-label={t('fields.status')}>
      {steps.map((s, i) => {
        const reached = i <= at
        const current = i === at
        const colour = reached ? STATUS_SOLID[s] : undefined
        const date = reachedAt[s]
        return (
          <li key={s} className="relative grid gap-2" aria-current={current ? 'step' : undefined}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-white',
                  !reached && 'border-slate-300 bg-background',
                  current && 'ring-4 ring-slate-100',
                )}
                style={reached ? { background: colour, borderColor: colour } : undefined}
              >
                {reached && (ended && current ? <X className="size-3.5" strokeWidth={3} /> : <Check className="size-3.5" strokeWidth={3} />)}
              </span>
              {i < steps.length - 1 && (
                <span className={cn('h-0.5 flex-1 rounded-full', i < at ? 'bg-slate-400' : 'bg-slate-200')} />
              )}
            </div>
            <div className="min-w-0 pr-2">
              <div className={cn('truncate text-body', current ? 'font-semibold text-foreground' : reached ? 'text-foreground' : 'text-muted-foreground')}>
                {t(`status.${s}`)}
              </div>
              <div className="text-caption text-muted-foreground num">{date ? formatDate(date) : reached ? '—' : ' '}</div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
