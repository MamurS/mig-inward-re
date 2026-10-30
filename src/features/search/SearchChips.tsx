import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fieldOf, removeTerm, type ParsedQuery, type Scope, type Term } from './query'

/** How a part of the query reads back to the user («MGA: Sevil», «Premium (USD) > 100k», «Not: declined»). */
export function termLabel(term: Term, t: TFunction, scope: Scope): string {
  const fieldLabel = (key: string) => t(fieldOf(scope, key)?.labelKey ?? key)
  let label: string
  switch (term.kind) {
    case 'text':
      label = term.phrase ? `“${term.words.join(' ')}”` : term.words.join(' ')
      break
    case 'field':
      label = `${fieldLabel(term.field)}: ${term.labels.join(' | ')}`
      break
    case 'num':
      label = `${fieldLabel(term.field)} ${term.display}`
      break
    case 'date':
      label = term.keyword ? t(`search.kw.${term.keyword}`) : `${fieldLabel(term.field)} ${term.display}`.replace(/\s+$/, '')
      break
    case 'flag':
      label = t(scope.flags.find((f) => f.flag === term.flag)?.labelKey ?? term.flag)
      break
  }
  return term.neg ? t('search.not', { label }) : label
}

/**
 * The query read back as chips — one row per OR group, «OR» between them —
 * so users see how their text was understood. × removes that part from the
 * text too. Parts searched as plain text say so.
 */
export function SearchChips({ query, scope, count, onChange }: { query: ParsedQuery; scope: Scope; count: React.ReactNode; onChange: (text: string) => void }) {
  const { t } = useTranslation()
  return (
    <div className="mb-4 grid gap-2" data-search-chips>
      {query.groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label={t('search.understood')}>
          {query.groups.map((g, gi) => (
            <Fragment key={gi}>
              {gi > 0 && <span className="px-1 text-caption font-semibold tracking-wide text-muted-foreground uppercase">{t('search.or')}</span>}
              {g.terms.map((term) => {
                const label = termLabel(term, t, scope)
                const asText = term.kind === 'text' && term.asText
                return (
                  <span
                    key={term.id}
                    data-chip
                    title={asText ? t('search.asTextHint', { raw: term.raw }) : term.raw}
                    className={cn(
                      'inline-flex h-8 max-w-full items-center gap-1 rounded-full border pr-1 pl-3 text-small',
                      asText ? 'border-dashed bg-background text-muted-foreground' : term.neg ? 'border-danger-200 bg-danger-50 text-danger-700' : 'border-brand-200 bg-brand-50 text-brand-800',
                    )}
                  >
                    <span className="truncate">{label}</span>
                    {asText && <span className="shrink-0 text-caption">· {t('search.asText')}</span>}
                    <button
                      type="button"
                      aria-label={t('search.removePart', { label })}
                      title={t('search.removePart', { label })}
                      onClick={() => onChange(removeTerm(query.text, term))}
                      className="flex size-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-slate-900/5"
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                )
              })}
            </Fragment>
          ))}
        </div>
      )}
      <div className="text-small text-muted-foreground num" aria-live="polite">{count}</div>
    </div>
  )
}
