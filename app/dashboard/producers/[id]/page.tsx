import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getCategories } from '@/lib/supabase/categories'
import { getOrCreateProfile } from '@/lib/supabase/profile'
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

  const profile = await getOrCreateProfile(user.id, user.email ?? undefined)
  // Produtor só acessa a própria página
  if (profile.role === 'producer' && profile.producer_id !== id) {
    if (profile.producer_id) redirect(`/dashboard/producers/${profile.producer_id}`)
    redirect('/dashboard/producers/sem-vinculo')
  }
  const isReadOnly = profile.role === 'producer'

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

  // Passa as OPs pagas individualmente para o cliente poder filtrar por período
  const paidOrders = (orders ?? [])
    .filter(o => o.status === 'paid')
    .map(o => ({ amount: o.amount, event_ids: o.event_ids ?? [] }))
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
      paidOrders={paidOrders}
      emittedEventIds={emittedEventIds}
      isReadOnly={isReadOnly}
    />
  )
}
