import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BilheteriaClient from '@/components/bilheteria/BilheteriaClient'
import type { PlatformEntry } from '@/lib/types'

export default async function BilheteriaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const allEntries: PlatformEntry[] = []
  const pageSize = 1000
  let from = 0
  while (true) {
    const { data } = await supabase
      .from('platform_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .range(from, from + pageSize - 1)
    if (!data || data.length === 0) break
    allEntries.push(...(data as PlatformEntry[]))
    if (data.length < pageSize) break
    from += pageSize
  }
  const entries = allEntries

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
