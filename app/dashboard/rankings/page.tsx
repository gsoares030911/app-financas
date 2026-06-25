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
    { data: producers },
    { data: entries },
    { data: events },
    { data: cancelledEvents },
    { data: pendingOrders },
  ] = await Promise.all([
    canAccessProdutores(profile.role)
      ? supabase.from('producers').select('*').order('full_name')
      : Promise.resolve({ data: [] }),
    supabase.from('account_entries').select('producer_id, entry_type, amount'),
    supabase.from('events').select('producer_id, gross_revenue, net_amount, status'),
    supabase.from('events').select('id, name, event_date, producer_id').eq('status', 'cancelado'),
    canSeeOrders
      ? supabase.from('payment_orders').select('*').eq('status', 'pending').order('created_at')
      : Promise.resolve({ data: [] }),
  ])

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
          producers={(producers ?? []).map(p => ({ id: p.id, full_name: p.full_name }))}
          role={profile.role}
          isPenultimateBusinessDay={isPenultimateBusinessDay}
          penultimateDate={penultimateDate}
        />
      )}
      <RankingsClient
        producers={producers ?? []}
        entries={entries ?? []}
        events={events ?? []}
        cancelledEvents={cancelledEvents ?? []}
        cancelledEntries={cancelledEntries ?? []}
      />
    </div>
  )
}
