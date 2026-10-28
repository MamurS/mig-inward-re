import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { RequireAuth, RequireRole } from '@/auth/guards'
import { useAuth } from '@/auth/AuthProvider'
import { AppLayout } from '@/components/layout/AppLayout'
import { homePathFor } from '@/components/layout/nav'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

const SubmissionsPage = lazy(() => import('@/features/submissions/SubmissionsPage').then((m) => ({ default: m.SubmissionsPage })))
const SubmissionFormPage = lazy(() => import('@/features/submissions/SubmissionFormPage').then((m) => ({ default: m.SubmissionFormPage })))
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
              <RequireRole roles={['admin', 'management']}>
                <PlaceholderPage page="dashboard" />
              </RequireRole>
            }
          />
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
          <Route path="agenda" element={<PlaceholderPage page="agenda" />} />
          <Route path="counterparties" element={<PlaceholderPage page="counterparties" />} />
          <Route path="counterparties/:id" element={<PlaceholderPage page="counterparties" />} />
          <Route
            path="admin"
            element={
              <RequireRole roles={['admin']}>
                <PlaceholderPage page="admin" />
              </RequireRole>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
