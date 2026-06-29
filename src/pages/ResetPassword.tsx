import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function ResetPassword() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase sets the session from the URL hash automatically
    // We just need to wait a moment for it to be processed
    const timer = setTimeout(() => setReady(true), 500)
    return () => clearTimeout(timer)
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    setError(null)
    const { error } = await updatePassword(password)
    if (error) { setError(error); setLoading(false); return }
    setDone(true)
    setTimeout(() => navigate('/login', { replace: true }), 2000)
  }

  return (
    <div className="min-h-screen bg-brand-navy flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-teal/20 border border-brand-teal/30 flex items-center justify-center">
            <ShieldCheck size={28} className="text-brand-teal" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-100">Set New Password</h1>
            <p className="text-sm text-slate-500 mt-1">Choose a strong password</p>
          </div>
        </div>

        <div className="rounded-2xl bg-brand-dark border border-brand-border p-6 space-y-5">
          {done ? (
            <div className="text-center space-y-3 py-2">
              <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto">
                <span className="text-green-400 text-xl">✓</span>
              </div>
              <p className="text-sm text-slate-300">Password updated. Redirecting to sign in…</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="relative">
                <Input
                  label="New Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-7 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              <Input
                label="Confirm Password"
                type="password"
                placeholder="Repeat password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <Button type="submit" loading={loading} disabled={!ready} className="w-full">
                Update Password
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
