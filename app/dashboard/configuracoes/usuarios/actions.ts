'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/profile'
import { isAdmin } from '@/lib/utils/auth'
import type { UserRole } from '@/lib/types'

export async function createUser(email: string, password: string, role: UserRole) {
  const supabase = await createClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { error: 'Não autenticado' }

  const profile = await getOrCreateProfile(caller.id, caller.email ?? undefined)
  if (!isAdmin(profile.role)) return { error: 'Apenas administradores podem criar usuários' }
  if (role === 'super_admin') return { error: 'Não é possível criar um novo Super Admin' }

  const admin = createAdminClient()

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) return { error: error.message }
  if (!data.user) return { error: 'Erro ao criar usuário' }

  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id: data.user.id, role, email })

  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id)
    return { error: 'Usuário criado mas perfil falhou: ' + profileError.message }
  }

  return { success: true, userId: data.user.id }
}

export async function updateUserRole(targetUserId: string, newRole: UserRole) {
  const supabase = await createClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { error: 'Não autenticado' }

  const profile = await getOrCreateProfile(caller.id, caller.email ?? undefined)
  if (!isAdmin(profile.role)) return { error: 'Apenas administradores podem alterar perfis' }

  const admin = createAdminClient()

  // Proteção server-side: o Super Admin nunca pode ter o perfil alterado,
  // independente do que a UI permitir.
  const { data: target } = await admin.from('profiles').select('role').eq('id', targetUserId).single()
  if (target?.role === 'super_admin') return { error: 'O perfil do Super Admin não pode ser alterado' }
  if (newRole === 'super_admin') return { error: 'Não é possível promover um usuário a Super Admin' }

  const { error } = await admin
    .from('profiles')
    .update({ role: newRole })
    .eq('id', targetUserId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteUser(targetUserId: string) {
  const supabase = await createClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { error: 'Não autenticado' }

  const profile = await getOrCreateProfile(caller.id, caller.email ?? undefined)
  if (!isAdmin(profile.role)) return { error: 'Apenas administradores podem excluir usuários' }
  if (targetUserId === caller.id) return { error: 'Você não pode excluir a si mesmo' }

  const admin = createAdminClient()

  // Proteção server-side: o Super Admin nunca pode ser excluído,
  // independente do que a UI permitir.
  const { data: target } = await admin.from('profiles').select('role').eq('id', targetUserId).single()
  if (target?.role === 'super_admin') return { error: 'O Super Admin não pode ser excluído' }

  // Exclui o perfil explicitamente antes para evitar conflito de FK
  await admin.from('profiles').delete().eq('id', targetUserId)

  const { error } = await admin.auth.admin.deleteUser(targetUserId)
  if (error) return { error: error.message || 'Erro ao excluir usuário' }
  return { success: true }
}
