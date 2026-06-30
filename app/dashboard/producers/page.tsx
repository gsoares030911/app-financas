import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProducersClient from '@/components/producers/ProducersClient'

// Busca paginada (Supabase devolve no máximo 1000 linhas por requisição)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll(supabase: any, table: string, columns: string, apply?: (q: any) => any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any[] = []
  const pageSize = 1000
  let from = 0
  while (true) {
    let q = supabase.from(table).select(columns).range(from, from + pageSize - 1)
    if (apply) q = apply(q)
    const { data } = await q
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return out
}

export default async function ProducersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [producers, entries, events, { data: paidOrders }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetchAll(supabase, 'producers', '*', (q: any) => q.order('full_name')),
    fetchAll(supabase, 'account_entries', 'producer_id, event_id, entry_type, amount'),
    fetchAll(supabase, 'events', 'id, producer_id, event_date, status'),
    supabase.from('payment_orders').select('producer_id, amount').eq('status', 'paid'),
  ])

  return (
    <ProducersClient
      producers={producers ?? []}
      entries={entries ?? []}
      events={events ?? []}
      paidOrders={paidOrders ?? []}
      userId={user.id}
    />
  )
}
