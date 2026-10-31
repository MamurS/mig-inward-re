import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDemoMode } from '@/lib/demo'
import { cn } from '@/lib/utils'

export type DashSection = { key: string; label: string; /** The section's heading id; null = the top of the page. */ id: string | null }

/** Room left above a section's heading when the switcher scrolls to it. */
const GAP = 12

/**
 * The dashboard's section switcher: stays under the top bar while the page
 * scrolls, jumps to a section (its heading takes focus, for keyboard and
 * screen-reader users) and marks the section being read. Only colours change
 * with the mark — nothing moves.
 */
export function SectionNav({ sections }: { sections: DashSection[] }) {
  const { t } = useTranslation()
  const demo = useDemoMode()
  const nav = useRef<HTMLElement>(null)
  const [current, setCurrent] = useState(sections[0]?.key)

  useEffect(() => {
    let frame = 0
    const spy = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const line = (nav.current?.getBoundingClientRect().bottom ?? 0) + GAP * 2
        const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
        let on = sections[0]?.key
        for (const s of sections) {
          const el = s.id ? document.getElementById(s.id) : null
          if (el && (el.getBoundingClientRect().top <= line || (atBottom && window.scrollY > 0))) on = s.key
        }
        setCurrent(on)
      })
    }
    spy()
    window.addEventListener('scroll', spy, { passive: true })
    window.addEventListener('resize', spy)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', spy)
      window.removeEventListener('resize', spy)
    }
  }, [sections])

  const go = (s: DashSection) => {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const el = s.id ? document.getElementById(s.id) : null
    if (el) {
      el.setAttribute('tabindex', '-1')
      el.focus({ preventScroll: true })
    }
    // where the switcher's bottom will be once stuck (at the top of the page it still sits lower, in the flow)
    const stuck = nav.current ? parseFloat(getComputedStyle(nav.current).top) + nav.current.offsetHeight : 0
    const top = el ? el.getBoundingClientRect().top + window.scrollY - stuck - GAP : 0
    window.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' })
    setCurrent(s.key)
  }

  return (
    <nav
      ref={nav}
      aria-label={t('dash.nav.label')}
      className={cn('sticky z-20 -mx-4 mb-4 border-b bg-background/80 px-4 py-2 backdrop-blur-md md:-mx-6 md:px-6 lg:-mx-8 lg:px-8', demo.on ? 'top-26' : 'top-16')}
      data-section-nav
    >
      <ul className="flex gap-1 overflow-x-auto">
        {sections.map((s) => (
          <li key={s.key} className="shrink-0">
            <a
              href={s.id ? `#${s.id}` : '#'}
              aria-current={current === s.key ? 'location' : undefined}
              onClick={(e) => {
                e.preventDefault()
                go(s)
              }}
              className={cn(
                'inline-flex h-8 items-center rounded-md px-3 text-body font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                current === s.key ? 'bg-brand-50 text-brand-700' : 'text-muted-foreground hover:bg-slate-100 hover:text-foreground',
              )}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
