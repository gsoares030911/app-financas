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
    { data: allMachines },
    { data: allRentalLinks },
    { data: allPdvLinks },
  ] = await Promise.all([
    supabase.from('producers').select('*').eq('id', id).single(),
    supabase.from('account_entries').select('*').eq('producer_id', id).order('date', { ascending: false }),
    supabase.from('events').select('*').eq('producer_id', id).order('event_date', { ascending: false }),
    supabase.from('equipment_rentals').select('*').eq('producer_id', id).order('created_at', { ascending: false }),
    supabase.from('payment_orders').select('amount, status, event_ids').eq('producer_id', id),
    getCategories(user.id),
    supabase.from('machines').select('*').order('model'),
    supabase.from('equipment_rentals').select('machine_id, returned_to_network').not('machine_id', 'is', null),
    supabase.from('pdv_locations').select('machine_id, returned_to_network').not('machine_id', 'is', null),
  ])

  if (!producer) notFound()

  // Máquinas disponíveis pro seletor do modal de aluguel: livres (sem vínculo
  // ativo em outro produtor/PDV e não devolvidas) + as já vinculadas a este
  // produtor (pra continuar aparecendo ao editar um contrato existente).
  const takenElsewhere = new Set([
    ...(allRentalLinks ?? []).filter(r => r.machine_id && !r.returned_to_network).map(r => r.machine_id as string),
    ...(allPdvLinks ?? []).filter(p => p.machine_id && !p.returned_to_network).map(p => p.machine_id as string),
  ])
  const ownMachineIds = new Set((rentals ?? []).map(r => r.machine_id).filter((v): v is string => !!v))
  const availableMachines = (allMachines ?? []).filter(m =>
    !m.returned_to_network && (!takenElsewhere.has(m.id) || ownMachineIds.has(m.id))
  )

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
      machines={availableMachines}
      categories={categories}
      userId={user.id}
      paidOrders={paidOrders}
      emittedEventIds={emittedEventIds}
      isReadOnly={isReadOnly}
    />
  )
}
