import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Menu, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { NAV_ITEMS } from './nav'
import { LanguageSwitcher } from './LanguageSwitcher'
import { UserMenu } from './UserMenu'
import { useMyOverdueCount } from '@/features/followups/FollowUps'
import { CommandPalette, OPEN_PALETTE, isMac } from '@/components/CommandPalette'

export function AppLayout() {
  const { t, i18n } = useTranslation()
  const { role, profile } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // Close the mobile menu on navigation
  useEffect(() => setMobileOpen(false), [location.pathname])

  // Apply the language saved on the profile when no local choice exists yet
  useEffect(() => {
    if (profile?.preferred_language && !localStorage.getItem('mig.lang')) {
      void i18n.changeLanguage(profile.preferred_language)
    }
  }, [profile?.preferred_language, i18n])

  const items = NAV_ITEMS.filter((item) => role && item.roles.includes(role))
  const overdue = useMyOverdueCount()

  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {items.map(({ to, labelKey, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-body font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
              isActive && 'bg-sidebar-accent text-sidebar-foreground',
            )
          }
        >
          <Icon className="size-4" />
          <span className="flex-1">{t(labelKey)}</span>
          {to === '/agenda' && (overdue.data ?? 0) > 0 && (
            <span className="rounded-full bg-danger-600 px-2 py-0.5 text-caption leading-none font-semibold text-white" title={t('agenda.bucket.overdue')}>
              {overdue.data}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )

  const brand = (
    <div className="flex h-14 items-center gap-2 border-b border-white/10 px-5">
      <div className="flex size-7 items-center justify-center rounded bg-white/10 text-caption font-display-bold text-white">MIG</div>
      <div className="min-w-0 leading-tight">
        <div className="text-body font-semibold text-white">{t('app.name')}</div>
        <div className="truncate text-caption text-sidebar-muted">{t('app.tagline')}</div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 bg-sidebar lg:block">
        {brand}
        {nav}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-scrim/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-sidebar">
            {brand}
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen((o) => !o)}>
            {mobileOpen ? <X /> : <Menu />}
          </Button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE))}
            className="flex h-9 w-full max-w-sm items-center gap-2 rounded-md border bg-canvas px-3 text-body text-muted-foreground transition-colors hover:border-input hover:text-foreground"
          >
            <Search className="size-4" />
            <span className="flex-1 truncate text-left">{t('ui.palette.button')}</span>
            <kbd className="hidden rounded-sm border bg-background px-2 text-caption sm:inline">{isMac() ? '⌘K' : 'Ctrl K'}</kbd>
          </button>
          <div className="flex-1" />
          <LanguageSwitcher />
          <UserMenu />
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-6">
          <Outlet />
        </main>
        <CommandPalette />
      </div>
    </div>
  )
}
