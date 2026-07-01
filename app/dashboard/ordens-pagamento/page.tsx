import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrdensListClient from '@/components/ordens-pagamento/OrdensListClient'
import type { PaymentOrder, Producer } from '@/lib/types'

export default async function OrdensPagamentoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: orders }, { data: producers }] = await Promise.all([
    supabase
      .from('payment_orders')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('producers')
      .select('id, full_name, bank_name, bank_agency, bank_account')
      .order('full_name'),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ordens de Pagamento</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gerencie os pagamentos aos produtores. Confirme após efetuar o pagamento no banco.
        </p>
      </div>
      <OrdensListClient
        orders={(orders ?? []) as PaymentOrder[]}
        producers={(producers ?? []) as Pick<Producer, 'id' | 'full_name' | 'bank_name' | 'bank_agency' | 'bank_account'>[]}
      />
    </div>
  )
}
