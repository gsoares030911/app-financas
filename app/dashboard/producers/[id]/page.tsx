import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getCategories } from '@/lib/supabase/categories'
import ProducerStatementClient from '@/components/producers/ProducerStatementClient'

export default async function ProducerStatementPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: producer },
    { data: entries },
    { data: events },
    { data: rentals },
    { data: orders },
    categories,
  ] = await Promise.all([
    supabase.from('producers').select('*').eq('id', id).single(),
    supabase.from('account_entries').select('*').eq('producer_id', id).order('date', { ascending: false }),
    supabase.from('events').select('*').eq('producer_id', id).order('event_date', { ascending: false }),
    supabase.from('equipment_rentals').select('*').eq('producer_id', id).order('created_at', { ascending: false }),
    supabase.from('payment_orders').select('amount, status, event_ids').eq('producer_id', id),
    getCategories(user.id),
  ])

  if (!producer) notFound()

  const paidTotal = (orders ?? []).filter(o => o.status === 'paid').reduce((s, o) => s + o.amount, 0)
  // Eventos já cobertos por alguma OP (pendente ou paga) — não devem ser reemitidos
  const emittedEventIds = [...new Set((orders ?? []).flatMap(o => o.event_ids ?? []))]

  return (
    <ProducerStatementClient
      producer={producer}
      entries={entries ?? []}
      events={events ?? []}
      rentals={rentals ?? []}
      categories={categories}
      userId={user.id}
      paidTotal={paidTotal}
      emittedEventIds={emittedEventIds}
    />
  )
}
