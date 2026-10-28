import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './AuthProvider'
import type { AppRole } from '@/lib/roles'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { NoAccessPage } from '@/pages/NoAccessPage'
import { ForbiddenPage } from '@/pages/ForbiddenPage'

/** Requires a signed-in user with an assigned, active role. */
export function RequireAuth() {
  const { session, sessionLoading, profileLoading, role } = useAuth()
  const location = useLocation()

  if (sessionLoading || profileLoading) return <FullPageSpinner />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!role) return <NoAccessPage />
  return <Outlet />
}

/** Restricts a route to some roles. */
export function RequireRole({ roles, children }: { roles: AppRole[]; children: ReactNode }) {
  const { role } = useAuth()
  if (!role || !roles.includes(role)) return <ForbiddenPage />
  return <>{children}</>
}
