import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RankingsClient from '@/components/rankings/RankingsClient'

export default async function RankingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: producers }, { data: entries }, { data: events }, { data: cancelledEvents }] = await Promise.all([
    supabase.from('producers').select('*').order('full_name'),
    supabase.from('account_entries').select('producer_id, entry_type, amount'),
    supabase.from('events').select('producer_id, gross_revenue, net_amount, status'),
    supabase.from('events').select('id, name, event_date, producer_id').eq('status', 'cancelado'),
  ])

  const cancelledEventIds = (cancelledEvents ?? []).map(e => e.id)
  const { data: cancelledEntries } = cancelledEventIds.length > 0
    ? await supabase
        .from('account_entries')
        .select('event_id, producer_id, entry_type, amount')
        .in('event_id', cancelledEventIds)
    : { data: [] }

  return (
    <RankingsClient
      producers={producers ?? []}
      entries={entries ?? []}
      events={events ?? []}
      cancelledEvents={cancelledEvents ?? []}
      cancelledEntries={cancelledEntries ?? []}
    />
  )
}
