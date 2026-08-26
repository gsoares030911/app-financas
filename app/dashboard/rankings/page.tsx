import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateProfile } from '@/lib/supabase/profile'
import { isAdmin, canAccessProdutores } from '@/lib/utils/auth'
import RankingsClient from '@/components/rankings/RankingsClient'
import PendingOrdersAlert from '@/components/rankings/PendingOrdersAlert'
import type { PaymentOrder } from '@/lib/types'

function getPenultimateBusinessDay(year: number, month: number): Date {
  // month é 1-indexed (1=Jan ... 12=Dec)
  // Começa do último dia do mês e conta 2 dias úteis para trás
  let d = new Date(year, month, 0) // último dia do mês
  let count = 0
  while (count < 2) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) count++ // pula sábado(6) e domingo(0)
    if (count < 2) d.setDate(d.getDate() - 1)
  }
  return d
}

export default async function RankingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(user.id, user.email ?? undefined)

  // Calcula penúltimo dia útil do mês atual (horário de Brasília)
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

  const penultimate = getPenultimateBusinessDay(year, month)
  const penultimateStr = `${penultimate.getFullYear()}-${String(penultimate.getMonth()+1).padStart(2,'0')}-${String(penultimate.getDate()).padStart(2,'0')}`
  const isPenultimateBusinessDay = todayStr === penultimateStr
  const penultimateDate = penultimate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

  const canSeeOrders = isAdmin(profile.role) || profile.role === 'financeiro_bilheteria'
  const canSeeDashboard = isAdmin(profile.role) || profile.role === 'financeiro_produtor' || profile.role === 'financeiro_bilheteria'

  if (!canSeeDashboard) redirect('/dashboard/producers')

  const [
    producersRes,
    { data: cancelledEvents },
    { data: pendingOrders },
    globalsRes,
    topDebtorsRes,
    topSellersRes,
    totalRevenueRes,
  ] = await Promise.all([
    canAccessProdutores(profile.role)
      ? supabase.from('producers').select('id, full_name', { count: 'exact' }).order('full_name').limit(1000)
      : Promise.resolve({ data: [], count: 0 }),
    supabase.from('events').select('id, name, event_date, producer_id').eq('status', 'cancelado').is('recovery_applied_at', null),
    canSeeOrders
      ? supabase.from('payment_orders').select('*').eq('status', 'pending').order('created_at')
      : Promise.resolve({ data: [] }),
    supabase.rpc('get_global_producer_balances'),
    supabase.rpc('get_top_debtors', { p_limit: 10 }),
    supabase.rpc('get_top_sellers', { p_limit: 10 }),
    supabase.rpc('get_total_revenue'),
  ])

  const producers = (producersRes.data ?? []) as { id: string; full_name: string }[]
  const totalProducerCount = producersRes.count ?? producers.length

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globals = (globalsRes as any).data?.[0]
  const globalTotalToReceive = Number(globals?.total_to_receive ?? 0)
  const globalTotalOwed      = Number(globals?.total_owed      ?? 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topDebtors = ((topDebtorsRes as any).data ?? []) as { producer_id: string; full_name: string; balance: number }[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topSellers = ((topSellersRes as any).data ?? []) as { producer_id: string; full_name: string; total_revenue: number }[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalTotalRevenue = Number((totalRevenueRes as any).data ?? 0)

  const cancelledEventIds = (cancelledEvents ?? []).map(e => e.id)
  const { data: cancelledEntries } = cancelledEventIds.length > 0
    ? await supabase
        .from('account_entries')
        .select('event_id, producer_id, entry_type, amount')
        .in('event_id', cancelledEventIds)
    : { data: [] }

  return (
    <div className="space-y-6">
      {canSeeOrders && (
        <PendingOrdersAlert
          pendingOrders={(pendingOrders ?? []) as PaymentOrder[]}
          producers={producers.map(p => ({ id: p.id, full_name: p.full_name }))}
          role={profile.role}
          isPenultimateBusinessDay={isPenultimateBusinessDay}
          penultimateDate={penultimateDate}
        />
      )}
      <RankingsClient
        producers={producers}
        cancelledEvents={cancelledEvents ?? []}
        cancelledEntries={cancelledEntries ?? []}
        totalProducerCount={totalProducerCount}
        globalTotalToReceive={globalTotalToReceive}
        globalTotalOwed={globalTotalOwed}
        globalTotalRevenue={globalTotalRevenue}
        topDebtors={topDebtors}
        topSellers={topSellers}
      />
    </div>
  )
}
