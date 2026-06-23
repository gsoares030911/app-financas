import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RankingsClient from '@/components/rankings/RankingsClient'

export default async function RankingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: producers }, { data: entries }, { data: events }] = await Promise.all([
    supabase.from('producers').select('*').order('full_name'),
    supabase.from('account_entries').select('producer_id, entry_type, amount'),
    supabase.from('events').select('producer_id, gross_revenue, net_amount, status'),
  ])

  return (
    <RankingsClient
      producers={producers ?? []}
      entries={entries ?? []}
      events={events ?? []}
    />
  )
}
