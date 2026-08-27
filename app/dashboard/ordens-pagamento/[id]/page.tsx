import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import OrdemPagamento from '@/components/producers/OrdemPagamento'
import { getOrdemPagamentoData } from '@/lib/ordemPagamento'

export default async function OrdemPagamentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const data = await getOrdemPagamentoData(supabase, id)
  if (!data) notFound()

  return (
    <OrdemPagamento
      order={data.order}
      producer={data.producer}
      events={data.events}
      entries={data.entries}
      periodDeductions={data.periodDeductions}
    />
  )
}
