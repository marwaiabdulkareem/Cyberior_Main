import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface LoginForm {
  email: string
  password: string
}

export default function Login() {
  const { signIn } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()

  async function onSubmit(data: LoginForm) {
    setLoading(true)
    setError(null)
    const { error } = await signIn(data.email, data.password)
    if (error) setError(error)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-brand-navy flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-teal/20 border border-brand-teal/30 flex items-center justify-center">
            <ShieldCheck size={28} className="text-brand-teal" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-100">Cyberior</h1>
            <p className="text-sm text-slate-500">Payment Tracker</p>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-2xl bg-brand-dark border border-brand-border p-6 space-y-5">
          <h2 className="text-base font-semibold text-slate-200">Sign In</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="your@email.com"
              error={errors.email?.message}
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
              })}
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                error={errors.password?.message}
                {...register('password', { required: 'Password is required' })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-7 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full">
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Cyberior Internal System — Authorized Users Only
        </p>
      </div>
    </div>
  )
}
