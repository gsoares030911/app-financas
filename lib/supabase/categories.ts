import { createClient } from '@/lib/supabase/server'
import { SYSTEM_CATEGORIES } from '@/lib/types'
import type { Category } from '@/lib/types'

async function seedIfEmpty(userId: string): Promise<void> {
  const supabase = await createClient()
  // Upsert garante que novas categorias do sistema sejam adicionadas a usuários existentes
  await supabase.from('categories').upsert(
    SYSTEM_CATEGORIES.map(c => ({ ...c, user_id: userId })),
    { onConflict: 'user_id,slug', ignoreDuplicates: true }
  )
}

export async function getCategories(userId: string, scope: 'producer' | 'platform' = 'producer'): Promise<Category[]> {
  await seedIfEmpty(userId)
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .eq('scope', scope)
    .order('sort_order')
    .order('name')
  return (data ?? []) as Category[]
}

export async function getAllCategories(userId: string): Promise<{ producer: Category[]; platform: Category[] }> {
  await seedIfEmpty(userId)
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order')
    .order('name')
  const all = (data ?? []) as Category[]
  return {
    producer: all.filter(c => c.scope === 'producer'),
    platform: all.filter(c => c.scope === 'platform'),
  }
}
