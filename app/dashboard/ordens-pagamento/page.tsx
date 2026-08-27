import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrdensListClient from '@/components/ordens-pagamento/OrdensListClient'
import { getCnabConfig } from '@/app/actions/cnabConfig'
import type { PaymentOrder, Producer } from '@/lib/types'

export default async function OrdensPagamentoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: orders }, { data: producers }, cnabConfig] = await Promise.all([
    supabase
      .from('payment_orders')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('producers')
      .select('id, full_name, email, cpf_cnpj, bank_name, bank_agency, bank_account, pix_key')
      .order('full_name'),
    getCnabConfig(),
  ])

  const pendingOps = (orders ?? []).filter(o => o.status === 'pending')
  const pendingTotal = pendingOps.reduce((s, o) => s + Number(o.amount), 0)

  // Offset de negativos: apenas produtores SEM OP pendente que têm saldo negativo
  // NO PERÍODO atual (period_from/period_to das OPs). Evita carregar dívidas de períodos anteriores.
  const periodFrom = pendingOps.map(o => o.period_from).filter(Boolean).sort()[0] ?? null
  const periodTo   = pendingOps.map(o => o.period_to).filter(Boolean).sort().reverse()[0] ?? null

  let negativeOffset = 0
  if (periodFrom && periodTo) {
    const opProducerIds = new Set(pendingOps.map(o => o.producer_id))
    const { data: periodEntries } = await supabase
      .from('account_entries')
      .select('producer_id, entry_type, amount')
      .gte('date', periodFrom)
      .lte('date', periodTo)

    const nets = new Map<string, number>()
    for (const e of (periodEntries ?? [])) {
      if (opProducerIds.has(e.producer_id)) continue
      const delta = e.entry_type === 'credito' ? Number(e.amount) : -Number(e.amount)
      nets.set(e.producer_id, (nets.get(e.producer_id) ?? 0) + delta)
    }
    for (const net of nets.values()) {
      if (net < 0) negativeOffset += net
    }
  }

  const netPeriodTotal = pendingTotal + negativeOffset

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ordens de Pagamento</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gerencie os pagamentos aos produtores. Confirme após efetuar o pagamento no banco.
        </p>
      </div>
      <OrdensListClient
        orders={(orders ?? []) as PaymentOrder[]}
        producers={(producers ?? []) as Pick<Producer, 'id' | 'full_name' | 'email' | 'cpf_cnpj' | 'bank_name' | 'bank_agency' | 'bank_account' | 'pix_key'>[]}
        cnabConfig={cnabConfig}
        netPeriodTotal={netPeriodTotal}
      />
    </div>
  )
}
