import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'

import Login from '@/pages/Login'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import MfaVerify from '@/pages/MfaVerify'
import MfaEnroll from '@/pages/MfaEnroll'
import Dashboard from '@/pages/Dashboard'
import Customers from '@/pages/Customers/index'
import CustomerDetail from '@/pages/Customers/CustomerDetail'
import Deals from '@/pages/Deals/index'
import DealDetail from '@/pages/Deals/DealDetail'
import Payments from '@/pages/Payments/index'
import Installments from '@/pages/Installments/index'
import Products from '@/pages/Products/index'
import Agents from '@/pages/Agents/index'
import Reports from '@/pages/Reports/index'
import Settings from '@/pages/Settings/index'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30 * 1000, retry: 1 } },
})

function Spinner() {
  return (
    <div className="min-h-screen bg-brand-navy flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin h-8 w-8 text-brand-teal" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, profile, loading, mfaStatus } = useAuth()

  if (loading || (user && (mfaStatus === null || mfaStatus === 'checking'))) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (mfaStatus === 'required') return <Navigate to="/mfa-verify" replace />
  if (mfaStatus === 'enroll_required') return <Navigate to="/mfa-enroll" replace />
  if (roles && profile && !roles.includes(profile.role)) return <Navigate to="/" replace />

  return <>{children}</>
}

function AppRoutes() {
  const { user, mfaStatus } = useAuth()
  const isFullyAuthenticated = user && mfaStatus === 'verified'

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={
        !user || mfaStatus === null || mfaStatus === 'checking' ? <Login /> :
        mfaStatus === 'verified' ? <Navigate to="/" replace /> :
        mfaStatus === 'required' ? <Navigate to="/mfa-verify" replace /> :
        <Navigate to="/mfa-enroll" replace />
      } />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* MFA gates — accessible after password login, before MFA */}
      <Route path="/mfa-verify" element={
        !user ? <Navigate to="/login" replace /> :
        mfaStatus === 'verified' ? <Navigate to="/" replace /> :
        <MfaVerify />
      } />
      <Route path="/mfa-enroll" element={
        !user ? <Navigate to="/login" replace /> :
        mfaStatus === 'verified' ? <Navigate to="/" replace /> :
        <MfaEnroll />
      } />

      {/* Protected app routes */}
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      <Route path="/customers/:id" element={<ProtectedRoute><CustomerDetail /></ProtectedRoute>} />
      <Route path="/deals" element={<ProtectedRoute><Deals /></ProtectedRoute>} />
      <Route path="/deals/:id" element={<ProtectedRoute><DealDetail /></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
      <Route path="/installments" element={<ProtectedRoute><Installments /></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute roles={['admin', 'finance']}><Products /></ProtectedRoute>} />
      <Route path="/agents" element={<ProtectedRoute roles={['admin', 'finance']}><Agents /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute roles={['admin', 'finance']}><Reports /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute roles={['admin']}><Settings /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
