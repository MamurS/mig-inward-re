import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Dialog as P } from 'radix-ui'
import { Building2, CornerDownLeft, FileText, Languages, Plus, Search } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { NAV_ITEMS } from '@/components/layout/nav'
import { StatusBadge } from '@/components/StatusBadge'
import { highlight } from '@/components/data/highlight'
import { supabase } from '@/lib/supabase'
import { can } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { useCounterparties } from '@/hooks/useReference'
import { cleanSearch } from '@/features/submissions/api'
import type { SubmissionStatus } from '@/lib/status'

/**
 * ⌘K / Ctrl K: one box to jump anywhere — pages, actions, a submission by
 * reference or insured, a counterparty by name. Arrow keys move, Enter goes.
 */

type Item = { id: string; group: string; label: ReactNode; hint?: ReactNode; icon: ReactNode; run: () => void }

export const OPEN_PALETTE = 'mig:open-palette'

export function isMac() {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
}

export function CommandPalette() {
  const { t, i18n } = useTranslation()
  const { role } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_PALETTE, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_PALETTE, onOpen)
    }
  }, [])

  useEffect(() => {
    const h = setTimeout(() => setDebounced(cleanSearch(q)), 150)
    return () => clearTimeout(h)
  }, [q])

  useEffect(() => {
    if (!open) {
      setQ('')
      setDebounced('')
    }
  }, [open])

  const submissions = useQuery({
    queryKey: ['palette', 'submissions', debounced],
    enabled: open && debounced.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('submissions_v')
        .select('id, ref_no, insured_name, status')
        .or(`ref_no.ilike.*${debounced}*,insured_name.ilike.*${debounced}*`)
        .order('received_at', { ascending: false })
        .limit(6)
      if (error) throw error
      return data as { id: string; ref_no: string; insured_name: string; status: SubmissionStatus }[]
    },
  })
  const counterparties = useCounterparties()

  const go = (to: string) => () => {
    setOpen(false)
    navigate(to)
  }

  const items: Item[] = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase()
    const match = (s: string) => !needle || s.toLocaleLowerCase().includes(needle)
    const out: Item[] = []
    for (const n of NAV_ITEMS) {
      if (!role || !n.roles.includes(role)) continue
      const label = t(n.labelKey)
      if (match(label)) out.push({ id: `nav:${n.to}`, group: t('ui.palette.goTo'), label: highlight(label, q), icon: <n.icon />, run: go(n.to) })
    }
    if (can.editSubmissions(role) && match(t('sub.new'))) {
      out.push({ id: 'act:new', group: t('ui.palette.actions'), label: highlight(t('sub.new'), q), icon: <Plus />, run: go('/submissions/new') })
    }
    for (const lng of ['en', 'ru', 'uz'] as const) {
      const label = t('ui.palette.switchLanguage', { lng: lng.toUpperCase() })
      if (lng !== i18n.resolvedLanguage && needle && match(label)) {
        out.push({ id: `lang:${lng}`, group: t('ui.palette.actions'), label: highlight(label, q), icon: <Languages />, run: () => { setOpen(false); void i18n.changeLanguage(lng); localStorage.setItem('mig.lang', lng) } })
      }
    }
    for (const s of submissions.data ?? []) {
      out.push({
        id: `sub:${s.id}`,
        group: t('nav.submissions'),
        label: <span className="truncate">{highlight(s.ref_no, q)} · {highlight(s.insured_name, q)}</span>,
        hint: <StatusBadge status={s.status} />,
        icon: <FileText />,
        run: go(`/submissions/${s.id}`),
      })
    }
    if (needle.length >= 2) {
      for (const c of (counterparties.data ?? []).filter((c) => match(c.name)).slice(0, 5)) {
        out.push({ id: `cp:${c.id}`, group: t('nav.counterparties'), label: highlight(c.name, q), hint: t(`counterpartyType.${c.type}`), icon: <Building2 />, run: go(`/counterparties/${c.id}`) })
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, role, submissions.data, counterparties.data, i18n.resolvedLanguage, t])

  useEffect(() => setActive(0), [q, items.length])
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const groups: [string, { item: Item; index: number }[]][] = []
  items.forEach((item, index) => {
    const g = groups.find(([name]) => name === item.group)
    if (g) g[1].push({ item, index })
    else groups.push([item.group, [{ item, index }]])
  })

  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <P.Portal>
        <P.Overlay className="fixed inset-0 z-50 bg-scrim/40 duration-(--duration-fast-02) data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <P.Content
          aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-background shadow-pop duration-(--duration-moderate-01) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
            if (e.key === 'Enter' && items[active]) { e.preventDefault(); items[active].run() }
          }}
        >
          <P.Title className="sr-only">{t('ui.palette.title')}</P.Title>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('ui.palette.placeholder')}
              className="h-12 flex-1 bg-transparent text-lead outline-none placeholder:text-muted-foreground"
              role="combobox"
              aria-expanded
              aria-controls="palette-list"
              aria-activedescendant={items[active] ? `palette-${active}` : undefined}
            />
            <kbd className="rounded-sm border bg-muted px-2 py-0.5 text-caption text-muted-foreground">Esc</kbd>
          </div>
          <div ref={listRef} id="palette-list" role="listbox" className="max-h-96 overflow-y-auto p-2">
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-body text-muted-foreground">
                {submissions.isFetching ? t('common.loading') : t('ui.palette.nothing')}
              </p>
            ) : (
              groups.map(([name, list]) => (
                <div key={name} className="pb-2">
                  <div className="px-3 py-1 text-caption font-medium text-muted-foreground">{name}</div>
                  {list.map(({ item, index }) => (
                    <div
                      key={item.id}
                      id={`palette-${index}`}
                      data-index={index}
                      role="option"
                      aria-selected={index === active}
                      onMouseMove={() => setActive(index)}
                      onClick={item.run}
                      className={cn(
                        'flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-body [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground',
                        index === active && 'bg-brand-50',
                      )}
                    >
                      {item.icon}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.hint && <span className="shrink-0 text-caption text-muted-foreground">{item.hint}</span>}
                      {index === active && <CornerDownLeft className="size-4" />}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </P.Content>
      </P.Portal>
    </P.Root>
  )
}
