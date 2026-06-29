import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProducersClient from '@/components/producers/ProducersClient'

export default async function ProducersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: producers }, { data: entries }, { data: paidOrders }] = await Promise.all([
    supabase.from('producers').select('*').order('full_name'),
    supabase.from('account_entries').select('producer_id, entry_type, amount'),
    supabase.from('payment_orders').select('producer_id, amount').eq('status', 'paid'),
  ])

  return (
    <ProducersClient
      producers={producers ?? []}
      entries={entries ?? []}
      paidOrders={paidOrders ?? []}
    />
  )
}
