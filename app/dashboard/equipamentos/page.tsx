import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EquipamentosClient from '@/components/equipamentos/EquipamentosClient'
import type { Producer, PdvLocation, Machine } from '@/lib/types'
import type { RentalWithProducer } from '@/components/equipamentos/EquipamentosClient'

export default async function EquipamentosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: rentals }, { data: producers }, { data: pdvs }, { data: machines }] = await Promise.all([
    supabase
      .from('equipment_rentals')
      .select('*, producers(id, full_name)')
      .order('equipment_code', { ascending: true }),
    supabase
      .from('producers')
      .select('*')
      .order('full_name'),
    supabase
      .from('pdv_locations')
      .select('*')
      .order('name', { ascending: true }),
    supabase
      .from('machines')
      .select('*')
      .order('serial_number', { ascending: true }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Equipamentos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Contratos de aluguel por produtor e pontos de venda físicos — cobranças geradas automaticamente no último dia do mês
        </p>
      </div>
      <EquipamentosClient
        rentals={(rentals ?? []) as RentalWithProducer[]}
        producers={(producers ?? []) as Producer[]}
        pdvs={(pdvs ?? []) as PdvLocation[]}
        machines={(machines ?? []) as Machine[]}
      />
    </div>
  )
}
