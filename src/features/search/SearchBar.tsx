import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Building2, Clock, CornerDownLeft, FileText, ListFilter, Plus, Search, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { NAV_ITEMS } from '@/components/layout/nav'
import { StatusBadge } from '@/components/StatusBadge'
import { highlight } from '@/components/data/highlight'
import { supabase } from '@/lib/supabase'
import { can } from '@/lib/roles'
import { cn, isMac } from '@/lib/utils'
import type { SubmissionStatus } from '@/lib/status'
import { compact, norm } from './normalize'
import { currentToken, fieldOf, parseQuery, quoteValue, type ListField } from './query'
import { forgetSearch, readRecent, rememberSearch, usePageSearch, useSearchContext } from './useSearch'
import { pageLink, SUBMISSIONS_PAGE } from './pages'
import { SearchHelp } from './SearchHelp'
import { FilterBuilder } from './FilterBuilder'

/** Other components focus the bar with this event (e.g. an empty state's «Search»). */
export const FOCUS_SEARCH = 'mig:focus-search'

type Item = {
  id: string
  group: 'recent' | 'filter' | 'record' | 'page'
  icon: ReactNode
  label: ReactNode
  hint?: ReactNode
  /** the query text after choosing it (Tab completes to this) */
  complete?: string
  run: () => void
  onRemove?: () => void
}

const MAX_VALUES = 8

/**
 * The one search bar (top bar): search and filtering in one place, in the
 * query language of query.ts. On the register it filters live; anywhere else
 * Enter opens the register with the query. The query lives in the URL (?q=).
 */
export function SearchBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const { session, role } = useAuth()
  const userId = session?.user.id ?? null
  const ctx = useSearchContext()
  const { page, here } = usePageSearch()
  const scope = page.scope
  const urlQ = here ? (params.get('q') ?? '') : ''

  const [text, setText] = useState(urlQ)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [helpOpen, setHelpOpen] = useState(false)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [recent, setRecent] = useState<string[]>(() => readRecent(userId, scope.id))
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const written = useRef<string | null>(null) // the last q this bar wrote to the URL
  const pushNext = useRef(true) // the first write of a new search adds a history entry
  const pending = useRef<number | undefined>(undefined) // the debounced live-filter write, if any
  const cancelPending = () => window.clearTimeout(pending.current)

  // URL → bar (Back / Forward, a chip removed, a link followed). Our own writes are skipped, so
  // keystrokes typed while a debounced write was in flight are never lost.
  useEffect(() => {
    if (urlQ === written.current) return
    cancelPending() // the URL moved on (Back, a chip, a tab): a write still waiting is stale
    written.current = null
    setText(urlQ)
    pushNext.current = true
  }, [urlQ, location.pathname])

  useEffect(() => setRecent(readRecent(userId, scope.id)), [userId, scope.id])

  /** Navigate from the bar. The bar shows `nextText` now: React Router applies the move a moment
   * later, and the URL → bar effect must not then wipe what was typed in between. */
  function go(to: string, nextText: string) {
    cancelPending()
    written.current = nextText
    setText(nextText)
    setOpen(false)
    navigate(to)
  }

  function writeUrl(q: string, push: boolean) {
    written.current = q
    // only q changes: the page's other params (sort, tab) stay
    const next = new URLSearchParams(window.location.search)
    if (q) next.set('q', q)
    else next.delete('q')
    setParams(next, { replace: !push })
  }

  // Live filtering on the register (debounced)
  useEffect(() => {
    if (!here || text === urlQ) return
    pending.current = window.setTimeout(() => {
      writeUrl(text, pushNext.current)
      pushNext.current = false
    }, 200)
    return cancelPending
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, here])

  // Ctrl / ⌘ K focuses the bar from anywhere
  useEffect(() => {
    const focus = () => {
      inputRef.current?.focus()
      inputRef.current?.select()
      setOpen(true)
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        focus()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(FOCUS_SEARCH, focus)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(FOCUS_SEARCH, focus)
    }
  }, [])

  /** Run the search: filter the register (here) or open it (elsewhere). */
  function submit(q = text) {
    const clean = q.trim()
    cancelPending()
    rememberSearch(userId, clean, scope.id)
    setRecent(readRecent(userId, scope.id))
    setOpen(false)
    setActive(-1)
    if (here) {
      if (clean !== urlQ) writeUrl(clean, true)
      pushNext.current = true
    } else {
      go(pageLink(SUBMISSIONS_PAGE, clean), clean)
    }
  }

  const tok = currentToken(text, scope)
  const typed = norm(tok.value.trim())
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const h = setTimeout(() => setDebounced(tok.field === null && !tok.neg ? tok.value.trim() : ''), 150)
    return () => clearTimeout(h)
  }, [tok.value, tok.field, tok.neg])

  // Direct hits: submissions by ref no. or insured
  const records = useQuery({
    queryKey: ['search', 'records', debounced],
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const v = `"*${debounced.replace(/["\\*%,()]/g, '')}*"`
      const { data, error } = await supabase
        .from('submissions_v')
        .select('id, ref_no, insured_name, status')
        .or(`ref_no.ilike.${v},insured_name.ilike.${v}`)
        .order('received_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data as { id: string; ref_no: string; insured_name: string; status: SubmissionStatus }[]
    },
  })

  const items: Item[] = useMemo(() => {
    const out: Item[] = []
    const replaceToken = (field: string | null, value: string) =>
      text.slice(0, tok.start) + (tok.neg ? '-' : '') + (field ? `${field}:` : '') + quoteValue(value)
    const fieldItem = (field: string, value: string, label: string, kind: string, icon: ReactNode = <Search />): Item => {
      const complete = replaceToken(field, value)
      return {
        id: `f:${field}:${value}`,
        group: 'filter',
        icon,
        label: <>{highlight(label, tok.value.trim().length >= 2 ? tok.value.trim() : '')}</>,
        hint: kind,
        complete,
        run: () => {
          setText(complete)
          setActive(-1)
          inputRef.current?.focus()
        },
      }
    }

    // recent searches (all of them while the bar is empty)
    const needle = norm(text.trim())
    for (const r of recent.filter((r) => !needle || (norm(r).includes(needle) && r !== text.trim())).slice(0, needle ? 3 : 8)) {
      out.push({
        id: `r:${r}`,
        group: 'recent',
        icon: <Clock />,
        label: <span className="truncate">{r}</span>,
        complete: r,
        run: () => {
          setText(r)
          submit(r)
        },
        onRemove: () => {
          forgetSearch(userId, r, scope.id)
          setRecent(readRecent(userId, scope.id))
        },
      })
    }
    if (!ctx) return out

    // values for what is being typed: field:value suggestions
    const minLen = tok.field ? 0 : 2
    if (typed.length >= minLen && (tok.field || typed)) {
      const c = compact(tok.value)
      const values: Item[] = []
      for (const key of tok.field ? [tok.field] : page.suggest) {
        const f = fieldOf(scope, key)
        if (f?.kind !== 'list') continue
        const hits = (f as ListField)
          .options(ctx)
          .filter((o) => !c || compact(o.label).includes(c) || o.names.some((n) => compact(n).startsWith(c)) || (tok.field && (o.codes ?? []).some((n) => compact(n).startsWith(c))))
          .slice(0, tok.field ? MAX_VALUES : 4)
        const icon = key === 'mga' || key === 'broker' ? <Building2 /> : undefined
        for (const o of hits) values.push(fieldItem(key, o.insert, o.label, t(f.labelKey), icon))
      }
      out.push(...values.slice(0, MAX_VALUES))
    }

    // direct hits: Enter opens the record
    for (const s of records.data ?? []) {
      if (!debounced || tok.field) break
      out.push({
        id: `s:${s.id}`,
        group: 'record',
        icon: <FileText />,
        label: <span className="truncate">{highlight(s.ref_no, debounced)} · {highlight(s.insured_name, debounced)}</span>,
        hint: <StatusBadge status={s.status} />,
        run: () => {
          rememberSearch(userId, text.trim(), scope.id)
          go(`/submissions/${s.id}`, '')
        },
      })
    }

    // pages and the one action (what the old ⌘K palette did)
    if (typed.length >= 2 && !tok.field) {
      for (const n of NAV_ITEMS) {
        if (!role || !n.roles.includes(role)) continue
        const label = t(n.labelKey)
        if (!norm(label).includes(typed)) continue
        out.push({ id: `p:${n.to}`, group: 'page', icon: <n.icon />, label: highlight(label, tok.value.trim()), hint: t('search.kind.page'), run: () => go(n.to, '') })
      }
      if (can.editSubmissions(role) && norm(t('sub.new')).includes(typed)) {
        out.push({ id: 'a:new', group: 'page', icon: <Plus />, label: highlight(t('sub.new'), tok.value.trim()), hint: t('search.kind.action'), run: () => go('/submissions/new', '') })
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, recent, ctx, records.data, debounced, role, t, page])

  useEffect(() => setActive(-1), [text])

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return setOpen(true)
      if (!items.length) return
      setActive((a) => (e.key === 'ArrowDown' ? (a + 1) % items.length : a <= 0 ? items.length - 1 : a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && active >= 0 && items[active]) items[active].run()
      else submit()
    } else if (e.key === 'Tab' && open && !e.shiftKey) {
      const target = (active >= 0 ? items[active] : undefined) ?? items.find((i) => i.complete && i.group === 'filter')
      if (target?.complete && target.complete !== text) {
        e.preventDefault()
        setText(target.complete)
        setActive(-1)
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        setOpen(false)
        setActive(-1)
      } else inputRef.current?.blur()
    }
  }

  const showPanel = open
  const groupLabel: Record<Item['group'], string> = {
    recent: t('search.group.recent'),
    filter: t('search.group.filter'),
    record: t('search.group.record'),
    page: t('search.group.page'),
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-11 w-full min-w-0 flex-1 md:mr-6"
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node)) {
          setOpen(false)
          setActive(-1)
        }
      }}
    >
      <div
        className={cn(
          'absolute inset-x-0 top-0 z-40 overflow-hidden border bg-card transition-[box-shadow,border-color] duration-(--duration-moderate-01)',
          showPanel
            ? 'rounded-3xl border-transparent shadow-search-active'
            : 'rounded-full border-border shadow-search hover:border-transparent hover:shadow-search-active focus-within:border-transparent focus-within:shadow-search-active',
        )}
        data-search-bar
      >
        <div className="flex h-11 items-center gap-3 pr-2 pl-4">
          <Search className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setOpen(true)
            }}
            onFocus={() => {
              setOpen(true)
              pushNext.current = true
            }}
            onKeyDown={onKeyDown}
            placeholder={t(`search.page.${scope.id}.placeholder`)}
            aria-label={t(`search.page.${scope.id}.label`)}
            role="combobox"
            aria-expanded={showPanel}
            aria-controls="search-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `search-opt-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-muted-foreground"
          />
          {text ? (
            <button
              type="button"
              aria-label={t('search.clear')}
              title={t('search.clear')}
              onClick={() => {
                setText('')
                inputRef.current?.focus()
                if (here) writeUrl('', true)
              }}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-[18px]" />
            </button>
          ) : (
            <kbd className="mr-1 hidden shrink-0 rounded-sm border bg-background px-2 text-caption text-muted-foreground sm:inline">{isMac() ? '⌘K' : 'Ctrl K'}</kbd>
          )}
          <span className="h-6 w-px shrink-0 bg-border" aria-hidden />
          <button
            type="button"
            aria-label={t('search.filters')}
            title={t('search.filters')}
            aria-haspopup="dialog"
            aria-expanded={builderOpen}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setOpen(false)
              setBuilderOpen((o) => !o)
            }}
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted hover:text-foreground',
              builderOpen ? 'bg-brand-50 text-brand-700' : 'text-muted-foreground',
            )}
          >
            <ListFilter className="size-[18px]" />
          </button>
        </div>

        {showPanel && (
          <div className="border-t border-border/70 pb-2">
            <div id="search-suggestions" role="listbox" aria-label={t('search.suggestions')} className="max-h-[60vh] overflow-y-auto pt-2">
              {items.length === 0 && (
                <p className="px-4 py-3 text-body text-muted-foreground">
                  {records.isFetching ? t('common.loading') : text.trim() ? t('search.enterToSearch') : t('search.startTyping')}
                </p>
              )}
              {items.map((item, index) => (
                <div key={item.id}>
                  {(index === 0 || items[index - 1].group !== item.group) && (
                    <div className="px-4 pt-2 pb-1 text-caption font-medium text-muted-foreground">{groupLabel[item.group]}</div>
                  )}
                  <div
                    id={`search-opt-${index}`}
                    role="option"
                    aria-selected={index === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseMove={() => setActive(index)}
                    onClick={item.run}
                    className={cn(
                      'group/opt flex h-10 cursor-pointer items-center gap-3 px-4 text-body [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground',
                      index === active && 'bg-brand-50',
                    )}
                  >
                    {item.icon}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.hint && <span className="shrink-0 text-caption text-muted-foreground">{item.hint}</span>}
                    {item.onRemove ? (
                      <button
                        type="button"
                        aria-label={t('search.removeRecent')}
                        title={t('search.removeRecent')}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation()
                          item.onRemove!()
                        }}
                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="size-4" />
                      </button>
                    ) : (
                      index === active && <CornerDownLeft className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/70 px-4 pt-2 text-caption text-muted-foreground">
              <span className="min-w-0">{t('search.tip')}</span>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false)
                  setHelpOpen(true)
                }}
                className="text-link hover:underline"
              >
                {t('search.helpLink')}
              </button>
            </div>
          </div>
        )}
      </div>
      <FilterBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        page={page}
        ctx={ctx}
        parsed={ctx ? parseQuery(text, ctx, scope) : null}
        onApply={(q) => {
          setBuilderOpen(false)
          setText(q)
          submit(q)
        }}
      />
      <SearchHelp
        open={helpOpen}
        onOpenChange={setHelpOpen}
        page={page}
        onTry={(example) => {
          setHelpOpen(false)
          setText(example)
          submit(example)
        }}
      />
    </div>
  )
}
