import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateProfile } from '@/lib/supabase/profile'
import { getAllCategories } from '@/lib/supabase/categories'
import CategoriasClient from '@/components/configuracoes/CategoriasClient'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(user.id)
  if (profile.role !== 'admin') redirect('/dashboard')

  const [{ producer: producerCats, platform: platformCats }, { data: recurring }] = await Promise.all([
    getAllCategories(user.id),
    supabase.from('recurring_expenses').select('*').eq('user_id', user.id).order('created_at'),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500 mt-1">Categorias de lançamentos e despesas recorrentes da Bilheteria Express</p>
      </div>
      <CategoriasClient
        producerCategories={producerCats}
        platformCategories={platformCats}
        recurringExpenses={recurring ?? []}
        userId={user.id}
      />
    </div>
  )
}
