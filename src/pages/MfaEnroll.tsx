import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Smartphone } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function MfaEnroll() {
  const { enrollMfa, confirmMfaEnroll, signOut } = useAuth()
  const navigate = useNavigate()
  const [qrCode, setQrCode] = useState('')
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [enrolling, setEnrolling] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    enrollMfa().then(({ qrCode, factorId, error }) => {
      if (error) { setError(error); setEnrolling(false); return }
      setQrCode(qrCode)
      setFactorId(factorId)
      setEnrolling(false)
    })
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 6) { setError('Enter the 6-digit code from your authenticator app.'); return }
    setLoading(true)
    setError(null)
    const { error } = await confirmMfaEnroll(factorId, code)
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
            <h1 className="text-xl font-bold text-slate-100">Set Up Two-Factor Authentication</h1>
            <p className="text-sm text-slate-500 mt-1">Required for all Cyberior accounts</p>
          </div>
        </div>

        <div className="rounded-2xl bg-brand-dark border border-brand-border p-6 space-y-5">
          {/* Step 1 */}
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-brand-teal/20 border border-brand-teal/40 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-brand-teal">1</span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">Install an authenticator app</p>
              <p className="text-xs text-slate-500 mt-0.5">Google Authenticator or Authy on your phone</p>
            </div>
          </div>

          {/* Step 2 — QR Code */}
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-brand-teal/20 border border-brand-teal/40 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-brand-teal">2</span>
            </div>
            <div className="w-full">
              <p className="text-sm font-medium text-slate-200 mb-3">Scan this QR code</p>
              {enrolling ? (
                <div className="w-40 h-40 rounded-lg bg-brand-border/30 animate-pulse mx-auto" />
              ) : qrCode ? (
                <img
                  src={qrCode}
                  alt="Scan this QR code with your authenticator app"
                  className="w-44 h-44 rounded-lg bg-white p-2 mx-auto"
                />
              ) : null}
            </div>
          </div>

          {/* Step 3 — Code */}
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-brand-teal/20 border border-brand-teal/40 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-brand-teal">3</span>
            </div>
            <div className="w-full">
              <p className="text-sm font-medium text-slate-200 mb-3">Enter the 6-digit code shown in the app</p>
              <form onSubmit={onSubmit} className="space-y-3">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-xl tracking-[0.4em] font-mono"
                />

                {error && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3">
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                <Button type="submit" loading={loading} disabled={enrolling} className="w-full">
                  <Smartphone size={15} className="mr-2" />
                  Activate & Continue
                </Button>
              </form>
            </div>
          </div>
        </div>

        <button
          onClick={() => signOut()}
          className="block w-full text-center text-xs text-slate-600 hover:text-slate-400 mt-4 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
