import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { RequireAuth, RequireRole } from '@/auth/guards'
import { useAuth } from '@/auth/AuthProvider'
import { AppLayout } from '@/components/layout/AppLayout'
import { homePathFor } from '@/components/layout/nav'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

const SubmissionsPage = lazy(() => import('@/features/submissions/SubmissionsPage').then((m) => ({ default: m.SubmissionsPage })))
const SubmissionFormPage = lazy(() => import('@/features/submissions/SubmissionFormPage').then((m) => ({ default: m.SubmissionFormPage })))
const AgendaPage = lazy(() => import('@/features/followups/AgendaPage').then((m) => ({ default: m.AgendaPage })))
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const CounterpartiesPage = lazy(() => import('@/features/counterparties/CounterpartiesPage').then((m) => ({ default: m.CounterpartiesPage })))
const CounterpartyDetailPage = lazy(() => import('@/features/counterparties/CounterpartyDetailPage').then((m) => ({ default: m.CounterpartyDetailPage })))
const AdminPage = lazy(() => import('@/features/admin/AdminPage').then((m) => ({ default: m.AdminPage })))
const TokensPage = lazy(() => import('@/features/admin/TokensPage').then((m) => ({ default: m.TokensPage })))
const SubmissionDetailPage = lazy(() => import('@/features/submissions/SubmissionDetailPage').then((m) => ({ default: m.SubmissionDetailPage })))

function HomeRedirect() {
  const { role } = useAuth()
  return <Navigate to={homePathFor(role)} replace />
}

const page = (node: ReactNode) => <Suspense fallback={<FullPageSpinner />}>{node}</Suspense>

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomeRedirect />} />
          <Route
            path="dashboard"
            element={
              <RequireRole roles={['admin', 'management']}>{page(<DashboardPage />)}</RequireRole>
            }
          />
          <Route path="ceo-dashboard" element={<Navigate to="/dashboard" replace />} />
          <Route path="submissions" element={page(<SubmissionsPage />)} />
          <Route
            path="submissions/new"
            element={<RequireRole roles={['admin', 'underwriter']}>{page(<SubmissionFormPage key="new" />)}</RequireRole>}
          />
          <Route path="submissions/:id" element={page(<SubmissionDetailPage />)} />
          <Route
            path="submissions/:id/edit"
            element={<RequireRole roles={['admin', 'underwriter']}>{page(<SubmissionFormPage />)}</RequireRole>}
          />
          <Route path="agenda" element={page(<AgendaPage />)} />
          <Route path="counterparties" element={page(<CounterpartiesPage />)} />
          <Route path="counterparties/:id" element={page(<CounterpartyDetailPage />)} />
          <Route
            path="admin"
            element={
              <RequireRole roles={['admin']}>{page(<AdminPage />)}</RequireRole>
            }
          />
          <Route
            path="admin/tokens"
            element={
              <RequireRole roles={['admin']}>{page(<TokensPage />)}</RequireRole>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
