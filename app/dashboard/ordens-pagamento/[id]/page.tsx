import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import OrdemPagamento from '@/components/producers/OrdemPagamento'
import type { PaymentOrder, Producer, ProducerEvent, AccountEntry } from '@/lib/types'

export default async function OrdemPagamentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: order } = await supabase
    .from('payment_orders')
    .select('*')
    .eq('id', id)
    .single()

  if (!order) notFound()

  const o = order as PaymentOrder

  const { data: producer } = await supabase
    .from('producers')
    .select('*')
    .eq('id', o.producer_id)
    .single()

  if (!producer) notFound()

  // Eventos da OP
  const { data: events } = o.event_ids.length > 0
    ? await supabase
        .from('events')
        .select('*')
        .in('id', o.event_ids)
        .order('event_date', { ascending: true })
    : { data: [] }

  // Lançamentos vinculados a esses eventos
  const { data: eventEntries } = o.event_ids.length > 0
    ? await supabase
        .from('account_entries')
        .select('*')
        .eq('producer_id', o.producer_id)
        .in('event_id', o.event_ids)
        .order('date', { ascending: true })
    : { data: [] }

  // Lançamentos gerais do período (sem event_id), se houver período
  let generalEntries: AccountEntry[] = []
  if (o.period_from || o.period_to) {
    let q = supabase
      .from('account_entries')
      .select('*')
      .eq('producer_id', o.producer_id)
      .is('event_id', null)
      .order('date', { ascending: true })
    if (o.period_from) q = q.gte('date', o.period_from)
    if (o.period_to)   q = q.lte('date', o.period_to)
    const { data } = await q
    generalEntries = (data ?? []) as AccountEntry[]
  }

  const allEntries = [
    ...((eventEntries ?? []) as AccountEntry[]),
    ...generalEntries,
  ].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <OrdemPagamento
      order={o}
      producer={producer as Producer}
      events={(events ?? []) as ProducerEvent[]}
      entries={allEntries}
    />
  )
}
