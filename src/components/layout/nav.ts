import { Banknote, BookCopy, Building2, CalendarClock, FileStack, HandCoins, LayoutDashboard, LifeBuoy, Settings, type LucideIcon } from 'lucide-react'
import type { AppRole } from '@/lib/roles'

export type NavItem = { to: string; labelKey: string; icon: LucideIcon; roles: AppRole[] }

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, roles: ['admin', 'management', 'finance', 'claims'] },
  { to: '/submissions', labelKey: 'nav.submissions', icon: FileStack, roles: ['admin', 'underwriter', 'finance', 'claims', 'management'] },
  { to: '/agenda', labelKey: 'nav.agenda', icon: CalendarClock, roles: ['admin', 'underwriter', 'finance', 'claims', 'management'] },
  { to: '/binders', labelKey: 'nav.binders', icon: BookCopy, roles: ['admin', 'underwriter', 'finance', 'claims', 'management'] },
  { to: '/claims', labelKey: 'nav.claims', icon: LifeBuoy, roles: ['admin', 'claims', 'finance', 'management', 'underwriter'] },
  { to: '/receivables', labelKey: 'nav.receivables', icon: HandCoins, roles: ['admin', 'finance', 'management'] },
  { to: '/receipts', labelKey: 'nav.receipts', icon: Banknote, roles: ['admin', 'finance', 'management'] },
  { to: '/counterparties', labelKey: 'nav.counterparties', icon: Building2, roles: ['admin', 'underwriter', 'finance', 'claims', 'management'] },
  { to: '/admin', labelKey: 'nav.admin', icon: Settings, roles: ['admin'] },
]

export function homePathFor(role: AppRole | null) {
  return role === 'admin' || role === 'management' ? '/dashboard' : role === 'claims' ? '/claims' : '/submissions'
}
