import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateProfile } from '@/lib/supabase/profile'
import ProducersClient from '@/components/producers/ProducersClient'

const PAGE_SIZE = 20

type BalanceFilter = 'todos' | 'a_pagar' | 'devendo' | 'zerado'

export default async function ProducersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; filter?: string }>
}) {
  const params = await searchParams
  const page    = Math.max(1, parseInt(params.page ?? '1', 10))
  const q       = params.q?.trim() ?? ''
  const rawFilter = params.filter ?? ''
  const activeFilter: BalanceFilter =
    rawFilter === 'a_pagar' || rawFilter === 'devendo' || rawFilter === 'zerado'
      ? rawFilter
      : 'todos'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(user.id, user.email ?? undefined)
  if (profile.role === 'producer') {
    if (profile.producer_id) redirect(`/dashboard/producers/${profile.producer_id}`)
    redirect('/dashboard/producers/sem-vinculo')
  }

  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  // ─── Totais globais (cards + contadores dos chips) ────────────────────────
  // Esta chamada funciona corretamente e é independente do filtro ativo.
  const globalsRes = await supabase.rpc('get_global_producer_balances')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globals           = (globalsRes as any).data?.[0]
  const globalTotalToReceive = Number(globals?.total_to_receive  ?? 0)
  const globalTotalOwed      = Number(globals?.total_owed        ?? 0)
  const globalCountToReceive = Number(globals?.count_to_receive  ?? 0)
  const globalCountOwed      = Number(globals?.count_owed        ?? 0)
  const globalCountZero      = Number(globals?.count_zero        ?? 0)
  const globalTotalCount     = globalCountToReceive + globalCountOwed + globalCountZero

  // ─── Busca de produtores ─────────────────────────────────────────────────
  // Sem filtro → tabela producers (rápido, sem cálculo de saldo).
  // Com filtro → view producers_with_balance (PostgREST aplica o WHERE no banco,
  //   retorna só as linhas que passam no filtro, sem limitação da RPC multi-linha).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let producersQuery: any

  if (activeFilter === 'todos') {
    producersQuery = supabase
      .from('producers')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('full_name')
      .range(from, to)
    if (q) producersQuery = producersQuery.ilike('full_name', `%${q}%`)
  } else {
    producersQuery = supabase
      .from('producers_with_balance')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('full_name')
      .range(from, to)
    if (activeFilter === 'a_pagar') producersQuery = producersQuery.gt('balance', 0)
    if (activeFilter === 'devendo') producersQuery = producersQuery.lt('balance', 0)
    if (activeFilter === 'zerado')  producersQuery = producersQuery.eq('balance', 0)
    if (q) producersQuery = producersQuery.ilike('full_name', `%${q}%`)
  }

  const { data: producersData, count } = await producersQuery
  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const producers  = (producersData ?? []) as any[]
  const producerIds = producers.map(p => p.id)

  // ─── Dados por produtor (account_entries + payment_orders) ───────────────
  // Buscados apenas para os produtores da página atual (máx. PAGE_SIZE = 20).
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
  const allOrders      = (ordersRes.data ?? []) as any[]
  const paidOrders     = allOrders
    .filter(o => o.status === 'paid')
    .map(o => ({ producer_id: o.producer_id, amount: o.amount }))
  const emittedEventIds = [...new Set(allOrders.flatMap(o => o.event_ids ?? []))]

  return (
    <ProducersClient
      producers={producers}
      entries={entriesRes.data ?? []}
      paidOrders={paidOrders}
      emittedEventIds={emittedEventIds}
      userId={user.id}
      page={page}
      totalPages={totalPages}
      totalCount={totalCount}
      globalTotalCount={globalTotalCount}
      searchQuery={q}
      activeFilter={activeFilter}
      globalTotalToReceive={globalTotalToReceive}
      globalTotalOwed={globalTotalOwed}
      globalCountToReceive={globalCountToReceive}
      globalCountOwed={globalCountOwed}
      globalCountZero={globalCountZero}
    />
  )
}
