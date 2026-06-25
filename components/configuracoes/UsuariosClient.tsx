'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ShieldCheck, Shield, User, Loader2, Plus, X, Trash2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SUPER_ADMIN_EMAIL, ROLE_CONFIG, canManageUsers } from '@/lib/utils/auth'
import { createUser, updateUserRole, deleteUser } from '@/app/dashboard/configuracoes/usuarios/actions'
import type { Profile, UserRole } from '@/lib/types'

const ROLE_ICONS: Record<UserRole, React.ElementType> = {
  super_admin:           ShieldCheck,
  admin:                 Shield,
  financeiro_bilheteria: Shield,
  financeiro_produtor:   Shield,
  producer:              User,
}

const ASSIGNABLE_ROLES: UserRole[] = [
  'admin',
  'financeiro_bilheteria',
  'financeiro_produtor',
  'producer',
]

interface Props {
  profiles: Profile[]
  currentUserId: string
  currentRole: UserRole
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function UsuariosClient({ profiles: initial, currentUserId, currentRole }: Props) {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>(initial)
  const [loading, setLoading] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const canManage = canManageUsers(currentRole)

  const [form, setForm] = useState({ email: '', password: '', role: 'admin' as UserRole })
  const [showPassword, setShowPassword] = useState(false)

  async function handleCreate() {
    if (!form.email.trim()) { toast.error('E-mail obrigatório'); return }
    if (!form.password || form.password.length < 6) { toast.error('Senha mínima de 6 caracteres'); return }

    setSubmitting(true)
    const result = await createUser(form.email.trim(), form.password, form.role)
    setSubmitting(false)

    if (result.error) { toast.error(result.error); return }

    toast.success(`Usuário ${form.email} criado com sucesso!`)
    setForm({ email: '', password: '', role: 'admin' })
    setShowForm(false)
    router.refresh()
  }

  async function handleChangeRole(profile: Profile, newRole: UserRole) {
    if (!canManage) return
    if (profile.email === SUPER_ADMIN_EMAIL) { toast.error('O Super Admin não pode ter o perfil alterado'); return }
    if (profile.id === currentUserId) {
      if (!confirm('Você está alterando o seu próprio perfil. Tem certeza?')) return
    }

    setLoading(profile.id)
    const result = await updateUserRole(profile.id, newRole)
    setLoading(null)

    if (result.error) { toast.error(result.error); return }
    setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, role: newRole } : p))
    toast.success('Perfil atualizado')
  }

  async function handleDelete(profile: Profile) {
    if (!canManage) return
    if (profile.email === SUPER_ADMIN_EMAIL) { toast.error('O Super Admin não pode ser excluído'); return }
    if (profile.id === currentUserId) { toast.error('Você não pode excluir a si mesmo'); return }
    if (!confirm(`Excluir o usuário ${profile.email ?? profile.id}?\n\nEsta ação é irreversível.`)) return

    setLoading(profile.id + '_del')
    const result = await deleteUser(profile.id)
    setLoading(null)

    if (result.error) { toast.error(result.error); return }
    setProfiles(prev => prev.filter(p => p.id !== profile.id))
    toast.success('Usuário excluído')
  }

  return (
    <div className="space-y-4">
      {/* Formulário novo usuário */}
      {canManage && (
        <div className="bg-white rounded-xl border overflow-hidden">
          {!showForm ? (
            <div className="p-4">
              <Button onClick={() => setShowForm(true)} size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                Cadastrar Usuário
              </Button>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-gray-800">Novo Usuário</h3>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="text-xs text-gray-500 mb-1 block">E-mail</label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="usuario@email.com"
                    className="h-9 text-sm"
                    autoFocus
                  />
                </div>

                <div className="relative">
                  <label className="text-xs text-gray-500 mb-1 block">Senha inicial</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                      className="h-9 text-sm pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Perfil</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {ASSIGNABLE_ROLES.map(r => (
                      <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
                  Criar Usuário
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabela de usuários */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Usuário</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Perfil</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Desde</th>
                {canManage && (
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Ações</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {profiles.map(profile => {
                const cfg = ROLE_CONFIG[profile.role] ?? ROLE_CONFIG.producer
                const Icon = ROLE_ICONS[profile.role] ?? User
                const isMe = profile.id === currentUserId
                const isProtected = profile.email === SUPER_ADMIN_EMAIL
                const isLoadingThis = loading === profile.id
                const isDeletingThis = loading === profile.id + '_del'

                return (
                  <tr key={profile.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-gray-500">
                            {(profile.email ?? '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm leading-tight">
                            {profile.email ?? <span className="text-gray-400 italic text-xs">sem e-mail registrado</span>}
                          </p>
                          {isMe && <span className="text-xs text-blue-500 font-medium">Você</span>}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {canManage && !isProtected ? (
                        <select
                          value={profile.role}
                          disabled={isLoadingThis}
                          onChange={e => handleChangeRole(profile, e.target.value as UserRole)}
                          className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer ${cfg.bg} ${cfg.color}`}
                        >
                          {ASSIGNABLE_ROLES.map(r => (
                            <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {profile.created_at ? fmtDate(profile.created_at) : '—'}
                    </td>

                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          {isProtected || isMe ? (
                            <span className="text-xs text-gray-300">—</span>
                          ) : isDeletingThis ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                          ) : (
                            <button
                              onClick={() => handleDelete(profile)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Excluir usuário"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t bg-gray-50">
              <tr>
                <td colSpan={canManage ? 4 : 3} className="px-4 py-2.5 text-xs text-gray-400">
                  {profiles.length} usuário{profiles.length !== 1 ? 's' : ''} cadastrado{profiles.length !== 1 ? 's' : ''}
                  {!canManage && ' · Apenas o Super Admin pode gerenciar usuários'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
