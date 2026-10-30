import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { NAV_ITEMS } from './nav'
import { LanguageSwitcher } from './LanguageSwitcher'
import { UserMenu } from './UserMenu'
import { useMyOverdueCount } from '@/features/followups/FollowUps'
import { AppearanceSync } from './AppearanceDialog'
import { SearchBar } from '@/features/search/SearchBar'

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
    <nav className="flex flex-col gap-1 px-3 py-4">
      {items.map(({ to, labelKey, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex min-h-10 items-center gap-3 rounded-control px-3 py-2 text-body text-sidebar-foreground transition-colors hover:bg-sidebar-hover [&>svg]:text-sidebar-muted',
              isActive && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent [&>svg]:text-sidebar-accent-foreground',
            )
          }
        >
          <Icon className="size-5 shrink-0" />
          <span className="min-w-0 flex-1 truncate" title={t(labelKey)}>{t(labelKey)}</span>
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
    <div className="flex h-16 items-center gap-3 px-5">
      {/* the brand lives in the logo mark */}
      <div className="flex size-9 shrink-0 items-center justify-center rounded-control bg-navy-800 text-caption font-display-bold text-white">MIG</div>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-body font-semibold text-sidebar-foreground">{t('app.name')}</div>
        <div className="truncate text-caption text-sidebar-muted" title={t('app.tagline')}>{t('app.tagline')}</div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="glass-sidebar sticky top-0 z-20 hidden h-screen w-64 shrink-0 lg:block">
        {brand}
        {nav}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-scrim/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-sidebar shadow-pop">
            {brand}
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md md:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen((o) => !o)}>
            {mobileOpen ? <X /> : <Menu />}
          </Button>
          <SearchBar />
          <div className="flex-1" />
          <LanguageSwitcher />
          <UserMenu />
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
        <AppearanceSync />
      </div>
    </div>
  )
}
