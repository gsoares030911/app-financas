import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProducersClient from '@/components/producers/ProducersClient'

const PAGE_SIZE = 20

export default async function ProducersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const q = params.q?.trim() ?? ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('producers')
    .select('*', { count: 'exact' })
    .order('full_name')
    .range(from, to)
  if (q) query = query.ilike('full_name', `%${q}%`)

  const { data: producers, count } = await query
  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const producerIds = (producers ?? []).map((p: any) => p.id)

  const [entriesRes, ordersRes] = producerIds.length > 0
    ? await Promise.all([
        supabase
          .from('account_entries')
          .select('producer_id, event_id, entry_type, amount')
          .in('producer_id', producerIds),
        supabase
          .from('payment_orders')
          .select('producer_id, amount, status, event_ids')
          .in('producer_id', producerIds),
      ])
    : [{ data: [] }, { data: [] }]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allOrders = (ordersRes.data ?? []) as any[]
  const paidOrders = allOrders
    .filter(o => o.status === 'paid')
    .map(o => ({ producer_id: o.producer_id, amount: o.amount }))
  const emittedEventIds = [...new Set(allOrders.flatMap(o => o.event_ids ?? []))]

  return (
    <ProducersClient
      producers={producers ?? []}
      entries={entriesRes.data ?? []}
      paidOrders={paidOrders}
      emittedEventIds={emittedEventIds}
      userId={user.id}
      page={page}
      totalPages={totalPages}
      totalCount={totalCount}
      searchQuery={q}
    />
  )
}
