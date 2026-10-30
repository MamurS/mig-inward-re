import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Popover as P } from 'radix-ui'
import { Check, ChevronDown, ListFilter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { cn } from '@/lib/utils'
import { compact } from './normalize'
import { fieldOf, type ListField, type Option, type ParsedQuery, type SearchContext } from './query'
import { builderFromQuery, builderToText, emptyBuilder, type BuilderItem, type BuilderState } from './builder'
import type { PageSearch } from './pages'

/**
 * The filter builder behind the funnel icon in the search pill: plain
 * controls for the page's fields. Applying writes the equivalent query text
 * into the bar, and the builder always opens on what the bar says — so people
 * can filter without the syntax, and learn it by seeing it.
 */
export function FilterBuilder({
  open,
  onOpenChange,
  page,
  ctx,
  parsed,
  onApply,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  page: PageSearch
  ctx: SearchContext | null
  parsed: ParsedQuery | null
  onApply: (text: string) => void
}) {
  const { t } = useTranslation()
  const spec = page.builder
  const [state, setState] = useState<BuilderState>(emptyBuilder)

  // the bar's text → the builder (on open, and whenever the text changes)
  useEffect(() => {
    if (open) setState(builderFromQuery(parsed, spec))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, parsed?.text, ctx, spec])

  const preview = useMemo(() => (ctx ? builderToText(state, page.scope, spec, ctx) : ''), [state, page.scope, spec, ctx])
  const setList = (field: string, values: string[]) => setState((s) => ({ ...s, lists: { ...s.lists, [field]: values } }))
  const toggleValue = (field: string, value: string) =>
    setState((s) => {
      const cur = s.lists[field] ?? []
      return { ...s, lists: { ...s.lists, [field]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] } }
    })
  const setRange = (field: string, patch: Partial<{ from: string; to: string }>) =>
    setState((s) => ({ ...s, ranges: { ...s.ranges, [field]: { ...(s.ranges[field] ?? { from: '', to: '' }), ...patch } } }))

  const fieldLabel = (key: string) => t(fieldOf(page.scope, key)?.labelKey ?? key)

  function control(item: BuilderItem) {
    const f = fieldOf(page.scope, item.field)
    if (!f || !ctx) return null
    const id = `fb-${item.field}`
    if (item.kind === 'chips' && f.kind === 'list') {
      const selected = state.lists[item.field] ?? []
      return (
        <fieldset key={id} className="grid content-start gap-2">
          <legend className="mb-2 text-small font-medium text-foreground">{fieldLabel(item.field)}</legend>
          <div className="flex flex-wrap gap-2">
            {(f as ListField).options(ctx).map((o) => {
              const on = selected.includes(o.value)
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleValue(item.field, o.value)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1 rounded-full border px-3 text-small transition-colors',
                    on ? 'border-brand-300 bg-brand-50 text-brand-800' : 'bg-background text-foreground hover:bg-muted',
                  )}
                >
                  {on && <Check className="size-3.5" aria-hidden />}
                  {o.label}
                </button>
              )
            })}
          </div>
        </fieldset>
      )
    }
    if (item.kind === 'multi' && f.kind === 'list') {
      return (
        <div key={id} className="grid content-start gap-2">
          <span className="text-small font-medium text-foreground" id={`${id}-label`}>{fieldLabel(item.field)}</span>
          <MultiPick labelledBy={`${id}-label`} options={(f as ListField).options(ctx)} value={state.lists[item.field] ?? []} onChange={(v) => setList(item.field, v)} />
        </div>
      )
    }
    if (item.kind === 'range' || item.kind === 'dates') {
      const r = state.ranges[item.field] ?? { from: '', to: '' }
      const dates = item.kind === 'dates'
      return (
        <fieldset key={id} className="grid content-start gap-2">
          <legend className="mb-2 text-small font-medium text-foreground">{fieldLabel(item.field)}</legend>
          <div className="grid grid-cols-2 gap-2">
            {dates ? (
              <>
                <DateInput
                  aria-label={`${fieldLabel(item.field)} — ${t('search.builder.from')}`}
                  value={r.from}
                  onChange={(v) => setRange(item.field, { from: v })}
                />
                <DateInput
                  aria-label={`${fieldLabel(item.field)} — ${t('search.builder.to')}`}
                  value={r.to}
                  onChange={(v) => setRange(item.field, { to: v })}
                />
              </>
            ) : (
              <>
                <Input
                  inputMode="decimal"
                  aria-label={`${fieldLabel(item.field)} — ${t('search.builder.min')}`}
                  placeholder={t('search.builder.min')}
                  value={r.from}
                  onChange={(e) => setRange(item.field, { from: e.target.value })}
                />
                <Input
                  inputMode="decimal"
                  aria-label={`${fieldLabel(item.field)} — ${t('search.builder.max')}`}
                  placeholder={t('search.builder.max')}
                  value={r.to}
                  onChange={(e) => setRange(item.field, { to: e.target.value })}
                />
              </>
            )}
          </div>
        </fieldset>
      )
    }
    return null
  }

  return (
    <P.Root open={open} onOpenChange={onOpenChange}>
      <P.Anchor className="absolute inset-x-0 top-full h-0" />
      <P.Portal>
        <P.Content
          align="start"
          sideOffset={8}
          collisionPadding={16}
          aria-label={t('search.builder.title')}
          className="z-50 flex max-h-[min(78vh,48rem)] w-[min(46rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-pop outline-none duration-(--duration-moderate-01) data-[state=open]:animate-in data-[state=open]:fade-in-0"
          data-filter-builder
        >
          <div className="flex items-start gap-3 border-b px-5 py-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700" aria-hidden>
              <ListFilter className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <h2 className="text-title font-semibold">{t('search.builder.title')}</h2>
              <p className="text-small text-muted-foreground">{t('search.builder.intro')}</p>
            </div>
          </div>

          <div className="grid gap-5 overflow-y-auto px-5 py-4">
            {state.orGroups && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-warning-100 px-3 py-2 text-small text-warning-700" role="status">
                <span>{t('search.builder.orNotice')}</span>
                <Button size="sm" variant="outline" onClick={() => setState(emptyBuilder())}>{t('search.builder.startOver')}</Button>
              </div>
            )}
            <div className="grid gap-2">
              <label htmlFor="fb-text" className="text-small font-medium text-foreground">{t('search.builder.words')}</label>
              <Input id="fb-text" value={state.text} onChange={(e) => setState((s) => ({ ...s, text: e.target.value }))} placeholder={t(`search.page.${page.scope.id}.words`)} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">{spec.items.map(control)}</div>
            {spec.toggles.length > 0 && (
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-small font-medium text-foreground">{t('search.builder.only')}</legend>
                <div className="flex flex-wrap gap-2">
                  {spec.toggles.map((tg) => {
                    const on = 'flag' in tg ? Boolean(state.flags[tg.flag]) : (state.lists[tg.field] ?? []).includes(tg.value)
                    const label = 'flag' in tg ? t(page.scope.flags.find((f) => f.flag === tg.flag)?.labelKey ?? tg.flag) : t(tg.labelKey)
                    return (
                      <button
                        key={'flag' in tg ? tg.flag : `${tg.field}:${tg.value}`}
                        type="button"
                        role="switch"
                        aria-checked={on}
                        onClick={() =>
                          'flag' in tg ? setState((s) => ({ ...s, flags: { ...s.flags, [tg.flag]: !on } })) : toggleValue(tg.field, tg.value)
                        }
                        className={cn(
                          'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-small transition-colors',
                          on ? 'border-brand-300 bg-brand-50 text-brand-800' : 'bg-background text-foreground hover:bg-muted',
                        )}
                      >
                        <span className={cn('flex size-4 items-center justify-center rounded-sm border', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-input')} aria-hidden>
                          {on && <Check className="size-3" />}
                        </span>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            )}
            {state.kept.length > 0 && (
              <p className="text-small text-muted-foreground">
                {t('search.builder.kept')} <code className="rounded-sm bg-muted px-1 font-mono text-foreground">{state.kept.join(', ')}</code>
              </p>
            )}
          </div>

          <div className="grid gap-3 border-t bg-muted/40 px-5 py-4">
            <div className="grid gap-1">
              <span className="text-caption font-medium text-muted-foreground">{t('search.builder.preview')}</span>
              <code className="min-h-8 rounded-md border bg-background px-3 py-1 font-mono text-small break-all text-foreground" data-builder-preview>
                {preview || <span className="text-muted-foreground">{t('search.builder.nothing')}</span>}
              </code>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setState(emptyBuilder())}>{t('search.builder.clear')}</Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
              <Button onClick={() => onApply(preview)}>{t('search.builder.apply')}</Button>
            </div>
          </div>
        </P.Content>
      </P.Portal>
    </P.Root>
  )
}

/** A searchable checklist in a small popover (MGAs, brokers, lines, countries, people). */
function MultiPick({ options, value, onChange, labelledBy }: { options: Option[]; value: string[]; onChange: (v: string[]) => void; labelledBy: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const c = compact(filter)
  const shown = options.filter((o) => !c || compact(o.label).includes(c) || o.names.some((n) => compact(n).includes(c)))
  const selected = options.filter((o) => value.includes(o.value))
  const summary = selected.length === 0 ? t('search.builder.any') : selected.length <= 2 ? selected.map((o) => o.label).join(', ') : t('search.builder.nSelected', { count: selected.length })
  return (
    <P.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setFilter('') }}>
      <P.Trigger asChild>
        <button
          type="button"
          aria-labelledby={labelledBy}
          aria-describedby={`${labelledBy}-value`}
          className="flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-control border border-input bg-background px-3 text-left text-body transition-colors hover:bg-muted/50"
        >
          <span id={`${labelledBy}-value`} className={cn('truncate', !selected.length && 'text-muted-foreground')} title={selected.map((o) => o.label).join(', ')}>{summary}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </P.Trigger>
      <P.Portal>
        <P.Content align="start" sideOffset={4} className="z-50 grid w-[var(--radix-popover-trigger-width)] min-w-64 gap-1 rounded-xl border bg-popover p-2 shadow-pop outline-none">
          <Input autoFocus value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('search.builder.find')} aria-label={t('search.builder.find')} className="h-9" />
          <div className="max-h-64 overflow-y-auto" role="group" aria-labelledby={labelledBy}>
            {shown.length === 0 && <p className="px-2 py-2 text-small text-muted-foreground">{t('search.builder.noMatch')}</p>}
            {shown.map((o) => {
              const on = value.includes(o.value)
              return (
                <label key={o.value} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-body hover:bg-muted">
                  <input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])} className="accent-(--color-primary)" />
                  <span className="truncate" title={o.label}>{o.label}</span>
                </label>
              )
            })}
          </div>
          {value.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="justify-self-start px-2 py-1 text-small text-link hover:underline">
              {t('search.builder.clearField')}
            </button>
          )}
        </P.Content>
      </P.Portal>
    </P.Root>
  )
}
