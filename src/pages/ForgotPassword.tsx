import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function ForgotPassword() {
  const { sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await sendPasswordReset(email)
    if (error) { setError(error); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-brand-navy flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-teal/20 border border-brand-teal/30 flex items-center justify-center">
            <ShieldCheck size={28} className="text-brand-teal" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-100">Reset Password</h1>
            <p className="text-sm text-slate-500 mt-1">We'll send a reset link to your email</p>
          </div>
        </div>

        <div className="rounded-2xl bg-brand-dark border border-brand-border p-6 space-y-5">
          {sent ? (
            <div className="text-center space-y-3 py-2">
              <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto">
                <span className="text-green-400 text-xl">✓</span>
              </div>
              <p className="text-sm text-slate-300">Check your email for a password reset link.</p>
              <p className="text-xs text-slate-500">If you don't see it, check your spam folder.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <Button type="submit" loading={loading} className="w-full">
                Send Reset Link
              </Button>
            </form>
          )}
        </div>

        <Link
          to="/login"
          className="flex items-center justify-center gap-1.5 text-xs text-slate-600 hover:text-slate-400 mt-4 transition-colors"
        >
          <ArrowLeft size={12} />
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
