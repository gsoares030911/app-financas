import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getCategories } from '@/lib/supabase/categories'
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

  const [
    { data: producer },
    { data: entries },
    { data: events },
    { data: rentals },
    categories,
  ] = await Promise.all([
    supabase.from('producers').select('*').eq('id', id).single(),
    supabase.from('account_entries').select('*').eq('producer_id', id).order('date', { ascending: false }),
    supabase.from('events').select('*').eq('producer_id', id).order('event_date', { ascending: false }),
    supabase.from('equipment_rentals').select('*').eq('producer_id', id).order('created_at', { ascending: false }),
    getCategories(user.id),
  ])

  if (!producer) notFound()

  return (
    <ProducerStatementClient
      producer={producer}
      entries={entries ?? []}
      events={events ?? []}
      rentals={rentals ?? []}
      categories={categories}
    />
  )
}
