import { createClient } from '@/lib/supabase/server'
import { SUPER_ADMIN_EMAIL } from '@/lib/utils/auth'
import type { Profile } from '@/lib/types'

export async function getOrCreateProfile(userId: string, email?: string): Promise<Profile> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (data) {
    const updates: Record<string, unknown> = {}
    if (email && data.email !== email) updates.email = email
    if (email === SUPER_ADMIN_EMAIL && data.role !== 'super_admin') updates.role = 'super_admin'

    if (Object.keys(updates).length > 0) {
      await supabase.from('profiles').update(updates).eq('id', userId)
      return { ...data, ...updates } as Profile
    }
    return data as Profile
  }

  const role = email === SUPER_ADMIN_EMAIL ? 'super_admin' : 'admin'
  const { data: created } = await supabase
    .from('profiles')
    .insert({ id: userId, role, email: email ?? null })
    .select()
    .single()

  return (created ?? { id: userId, role, email: email ?? null, producer_id: null, created_at: '' }) as Profile
}
