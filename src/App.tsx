import { Navigate, Route, Routes } from 'react-router'
import { RequireAuth, RequireRole } from '@/auth/guards'
import { useAuth } from '@/auth/AuthProvider'
import { AppLayout } from '@/components/layout/AppLayout'
import { homePathFor } from '@/components/layout/nav'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

function HomeRedirect() {
  const { role } = useAuth()
  return <Navigate to={homePathFor(role)} replace />
}

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
          <Route path="submissions" element={<PlaceholderPage page="submissions" />} />
          <Route path="agenda" element={<PlaceholderPage page="agenda" />} />
          <Route path="counterparties" element={<PlaceholderPage page="counterparties" />} />
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
