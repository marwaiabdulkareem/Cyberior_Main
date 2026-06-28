import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, UserPlus, Shield, Clock, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/layout/Layout'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { StatusBadge } from '@/components/ui/Badge'
import { formatDateTime } from '@/lib/utils'
import type { Profile, ActivityLog } from '@/types'
import { useAuth } from '@/contexts/AuthContext'

interface NewUserForm {
  email: string
  password: string
  full_name: string
  role: 'admin' | 'agent' | 'finance'
}

function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').order('created_at')
      return (data ?? []) as Profile[]
    },
  })
}

function useActivityLogs() {
  return useQuery({
    queryKey: ['activity-logs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      return (data ?? []) as ActivityLog[]
    },
  })
}

export default function Settings() {
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const [showNewUser, setShowNewUser] = useState(false)
  const [newUser, setNewUser] = useState<NewUserForm>({
    email: '', password: '', full_name: '', role: 'agent',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)

  const { data: profiles = [] } = useProfiles()
  const { data: logs = [] } = useActivityLogs()

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })

  const toggleUserActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await supabase.from('profiles').update({ is_active }).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })

  async function handleCreateUser() {
    setCreateLoading(true)
    setCreateError(null)
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: newUser.email,
        password: newUser.password,
        user_metadata: { full_name: newUser.full_name, role: newUser.role },
        email_confirm: true,
      })
      if (error) throw error
      // Profile is auto-created via trigger
      qc.invalidateQueries({ queryKey: ['profiles'] })
      setShowNewUser(false)
      setNewUser({ email: '', password: '', full_name: '', role: 'agent' })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setCreateLoading(false)
    }
  }

  const actionColors: Record<string, string> = {
    created: 'text-green-400',
    updated: 'text-blue-400',
    deleted: 'text-red-400',
    payment_recorded: 'text-brand-teal',
  }

  return (
    <Layout title="Settings">
      <div className="space-y-6 max-w-4xl">
        {/* Team Members */}
        <div className="rounded-xl bg-brand-surface border border-brand-border">
          <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-brand-teal" />
              <h3 className="text-sm font-semibold text-slate-200">Team Members & Roles</h3>
            </div>
            {isAdmin && (
              <Button size="sm" onClick={() => setShowNewUser(true)}>
                <UserPlus size={14} />
                Add User
              </Button>
            )}
          </div>
          <div className="p-5 space-y-3">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center justify-between p-4 rounded-lg bg-brand-navy"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-teal/20 border border-brand-teal/30 flex items-center justify-center text-xs font-bold text-brand-teal uppercase">
                    {profile.full_name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{profile.full_name}</p>
                    <p className="text-xs text-slate-500 capitalize">{profile.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!profile.is_active && (
                    <span className="text-xs text-red-400">Inactive</span>
                  )}
                  {isAdmin && (
                    <>
                      <Select
                        value={profile.role}
                        onChange={(e) => updateRole.mutate({ id: profile.id, role: e.target.value })}
                        className="text-xs w-28 py-1"
                      >
                        <option value="admin">Admin</option>
                        <option value="agent">Sales Agent</option>
                        <option value="finance">Finance</option>
                      </Select>
                      <Button
                        variant={profile.is_active ? 'ghost' : 'secondary'}
                        size="sm"
                        onClick={() => toggleUserActive.mutate({ id: profile.id, is_active: !profile.is_active })}
                      >
                        {profile.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Info */}
        <div className="rounded-xl bg-brand-surface border border-brand-border p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">System Configuration</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[
              { label: 'Base Currency', value: 'USD (+ IQD reference)' },
              { label: 'Commission Rate', value: '10% per deal' },
              { label: 'Below-Min Policy', value: 'Warn + allow save' },
              { label: 'Agent Visibility', value: 'Own customers only' },
              { label: 'Payment Proof', value: 'Optional upload' },
              { label: 'Notification', value: 'In-app alerts' },
              { label: 'Payment Methods', value: 'Card, IBAN, SuperQ, ZainCash, WU' },
              { label: 'Refunds', value: 'Partial + full supported' },
              { label: 'Delete Rights', value: 'Admin only' },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-lg bg-brand-navy">
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className="text-xs font-medium text-slate-300 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Log */}
        <div className="rounded-xl bg-brand-surface border border-brand-border">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-brand-border">
            <Clock size={16} className="text-brand-teal" />
            <h3 className="text-sm font-semibold text-slate-200">Audit Log (Last 50)</h3>
          </div>
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No activity yet</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-brand-navy">
                  <div className="flex-1">
                    <p className="text-xs text-slate-300">
                      <span className={actionColors[log.action] ?? 'text-slate-400'}>
                        {log.action}
                      </span>{' '}
                      <span className="text-slate-500">{log.entity_type}</span>
                      {log.entity_label && (
                        <span className="text-slate-400"> — {log.entity_label}</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {log.user_name ?? 'Unknown'} · {formatDateTime(log.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      <Modal
        open={showNewUser}
        onClose={() => { setShowNewUser(false); setCreateError(null) }}
        title="Add New Team Member"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowNewUser(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} loading={createLoading}>Create User</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            This creates a Supabase Auth account. The user will receive login credentials at their email.
          </p>
          <Input
            label="Full Name *"
            value={newUser.full_name}
            onChange={(e) => setNewUser((p) => ({ ...p, full_name: e.target.value }))}
          />
          <Input
            label="Email *"
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
          />
          <div className="relative">
            <Input
              label="Temporary Password *"
              type={showPassword ? 'text' : 'password'}
              value={newUser.password}
              onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-7 text-slate-500"
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <Select
            label="Role *"
            value={newUser.role}
            onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value as 'admin' | 'agent' | 'finance' }))}
          >
            <option value="agent">Sales Agent</option>
            <option value="finance">Finance</option>
            <option value="admin">Admin</option>
          </Select>
          {createError && <p className="text-xs text-red-400">{createError}</p>}
        </div>
      </Modal>
    </Layout>
  )
}
