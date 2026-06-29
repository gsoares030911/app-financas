'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/profile'
import { isSuperAdmin } from '@/lib/utils/auth'
import type { UserRole } from '@/lib/types'

export async function createUser(email: string, password: string, role: UserRole) {
  const supabase = await createClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { error: 'Não autenticado' }

  const profile = await getOrCreateProfile(caller.id, caller.email ?? undefined)
  if (!isSuperAdmin(profile.role)) return { error: 'Apenas o Super Admin pode criar usuários' }

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
  if (!isSuperAdmin(profile.role)) return { error: 'Apenas o Super Admin pode alterar roles' }

  const admin = createAdminClient()
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
  if (!isSuperAdmin(profile.role)) return { error: 'Apenas o Super Admin pode excluir usuários' }

  const admin = createAdminClient()

  // Exclui o perfil explicitamente antes para evitar conflito de FK
  await admin.from('profiles').delete().eq('id', targetUserId)

  const { error } = await admin.auth.admin.deleteUser(targetUserId)
  if (error) return { error: error.message || 'Erro ao excluir usuário' }
  return { success: true }
}
