import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BilheteriaClient from '@/components/bilheteria/BilheteriaClient'
import type { PlatformEntry } from '@/lib/types'

export default async function BilheteriaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: entries } = await supabase
    .from('platform_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bilheteria Express</h1>
        <p className="text-sm text-gray-500 mt-1">Financeiro da plataforma — receitas e despesas operacionais</p>
      </div>
      <BilheteriaClient initialEntries={(entries ?? []) as PlatformEntry[]} />
    </div>
  )
}
