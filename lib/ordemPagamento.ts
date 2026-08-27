import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentOrder, Producer, ProducerEvent, AccountEntry } from '@/lib/types'

export interface OrdemPagamentoData {
  order: PaymentOrder
  producer: Producer
  events: ProducerEvent[]
  entries: AccountEntry[]
  periodDeductions: AccountEntry[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getOrdemPagamentoData(supabase: SupabaseClient<any>, orderId: string): Promise<OrdemPagamentoData | null> {
  const { data: order } = await supabase
    .from('payment_orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (!order) return null
  const o = order as PaymentOrder

  const { data: producer } = await supabase
    .from('producers')
    .select('*')
    .eq('id', o.producer_id)
    .single()

  if (!producer) return null

  const { data: events } = o.event_ids.length > 0
    ? await supabase
        .from('events')
        .select('*')
        .in('id', o.event_ids)
        .order('event_date', { ascending: true })
    : { data: [] }

  const { data: eventEntries } = o.event_ids.length > 0
    ? await supabase
        .from('account_entries')
        .select('*')
        .eq('producer_id', o.producer_id)
        .in('event_id', o.event_ids)
        .order('date', { ascending: true })
    : { data: [] }

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

  let periodDeductions: AccountEntry[] = []
  if ((o.period_from || o.period_to) && o.event_ids.length > 0) {
    let q = supabase
      .from('account_entries')
      .select('*')
      .eq('producer_id', o.producer_id)
      .eq('entry_type', 'debito')
      .not('event_id', 'is', null)
      .not('event_id', 'in', `(${o.event_ids.join(',')})`)
      .order('date', { ascending: true })
    if (o.period_from) q = q.gte('date', o.period_from)
    if (o.period_to)   q = q.lte('date', o.period_to)
    const { data } = await q
    periodDeductions = (data ?? []) as AccountEntry[]
  }

  const entries = [
    ...((eventEntries ?? []) as AccountEntry[]),
    ...generalEntries,
  ].sort((a, b) => a.date.localeCompare(b.date))

  return {
    order: o,
    producer: producer as Producer,
    events: (events ?? []) as ProducerEvent[],
    entries,
    periodDeductions,
  }
}
