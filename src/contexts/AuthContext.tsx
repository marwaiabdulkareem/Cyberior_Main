import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

export type MfaStatus = 'checking' | 'enroll_required' | 'required' | 'verified'

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  mfaStatus: MfaStatus | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  verifyMfa: (code: string) => Promise<{ error: string | null }>
  enrollMfa: () => Promise<{ qrCode: string; factorId: string; error: string | null }>
  confirmMfaEnroll: (factorId: string, code: string) => Promise<{ error: string | null }>
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  isAdmin: boolean
  isAgent: boolean
  isFinance: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null)

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    setLoading(false)
  }

  async function checkMfaStatus() {
    setMfaStatus('checking')
    try {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (!data) { setMfaStatus('enroll_required'); return }
      const { currentLevel, nextLevel } = data
      if (currentLevel === 'aal2') setMfaStatus('verified')
      else if (nextLevel === 'aal2') setMfaStatus('required')
      else setMfaStatus('enroll_required')
    } catch {
      setMfaStatus('enroll_required')
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
        checkMfaStatus()
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        if (event !== 'PASSWORD_RECOVERY') fetchProfile(session.user.id)
        if (event === 'SIGNED_IN') checkMfaStatus()
        if (event === 'MFA_CHALLENGE_VERIFIED') setMfaStatus('verified')
      } else {
        setProfile(null)
        setMfaStatus(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function verifyMfa(code: string) {
    const { data: factors, error: fe } = await supabase.auth.mfa.listFactors()
    if (fe) return { error: fe.message }
    const factor = factors?.totp?.[0]
    if (!factor) return { error: 'No authenticator found. Please enroll first.' }
    const { data: challenge, error: ce } = await supabase.auth.mfa.challenge({ factorId: factor.id })
    if (ce) return { error: ce.message }
    const { error } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code })
    if (error) return { error: 'Invalid code. Please try again.' }
    setMfaStatus('verified')
    return { error: null }
  }

  async function enrollMfa() {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'Cyberior' })
    if (error) return { qrCode: '', factorId: '', error: error.message }
    return { qrCode: data.totp.qr_code, factorId: data.id, error: null }
  }

  async function confirmMfaEnroll(factorId: string, code: string) {
    const { data: challenge, error: ce } = await supabase.auth.mfa.challenge({ factorId })
    if (ce) return { error: ce.message }
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code })
    if (error) return { error: 'Invalid code. Please check your authenticator app and try again.' }
    setMfaStatus('verified')
    return { error: null }
  }

  async function sendPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error: error?.message ?? null }
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password })
    return { error: error?.message ?? null }
  }

  const role = profile?.role ?? null

  return (
    <AuthContext.Provider value={{
      user, profile, session, loading, mfaStatus,
      signIn, signOut,
      verifyMfa, enrollMfa, confirmMfaEnroll,
      sendPasswordReset, updatePassword,
      isAdmin: role === 'admin',
      isAgent: role === 'agent',
      isFinance: role === 'finance',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
