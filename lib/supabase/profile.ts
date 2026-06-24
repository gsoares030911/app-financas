import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

export async function getOrCreateProfile(userId: string): Promise<Profile> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (data) return data as Profile

  const { data: created } = await supabase
    .from('profiles')
    .insert({ id: userId, role: 'admin' })
    .select()
    .single()

  return (created ?? { id: userId, role: 'admin', producer_id: null, created_at: '' }) as Profile
}
