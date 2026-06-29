import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ImportWizard from '@/components/bilheteria/ImportWizard'
import type { Producer } from '@/lib/types'

export default async function ImportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: producers } = await supabase
    .from('producers')
    .select('*')
    .eq('user_id', user.id)
    .order('full_name')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Consultar Período</h1>
        <p className="text-sm text-gray-500 mt-1">Selecione o período para buscar os pagamentos e registrar os eventos</p>
      </div>
      <ImportWizard initialProducers={(producers ?? []) as Producer[]} />
    </div>
  )
}
