import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function MfaVerify() {
  const { verifyMfa, signOut } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 6) { setError('Enter the 6-digit code from your authenticator app.'); return }
    setLoading(true)
    setError(null)
    const { error } = await verifyMfa(code)
    if (error) { setError(error); setLoading(false); return }
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-brand-navy flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-teal/20 border border-brand-teal/30 flex items-center justify-center">
            <ShieldCheck size={28} className="text-brand-teal" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-100">Two-Factor Authentication</h1>
            <p className="text-sm text-slate-500 mt-1">Enter the code from your authenticator app</p>
          </div>
        </div>

        <div className="rounded-2xl bg-brand-dark border border-brand-border p-6 space-y-5">
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              label="Authentication Code"
              type="text"
              inputMode="numeric"
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-[0.5em] font-mono"
            />

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full">
              Verify
            </Button>
          </form>
        </div>

        <button
          onClick={() => signOut()}
          className="block w-full text-center text-xs text-slate-600 hover:text-slate-400 mt-4 transition-colors"
        >
          Sign out and use a different account
        </button>
      </div>
    </div>
  )
}
