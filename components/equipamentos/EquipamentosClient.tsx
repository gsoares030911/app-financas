'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Pencil, Trash2, CheckCircle, XCircle, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import EquipmentRentalDialog from '@/components/producers/EquipmentRentalDialog'
import type { EquipmentRental, Producer } from '@/lib/types'

export interface RentalWithProducer extends EquipmentRental {
  producers: { id: string; full_name: string } | null
}

interface Props {
  rentals: RentalWithProducer[]
  producers: Producer[]
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function EquipamentosClient({ rentals: initialRentals, producers }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [searchProducer, setSearchProducer] = useState('')
  const [searchCode, setSearchCode] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EquipmentRental | null>(null)
  const [generatingCharges, setGeneratingCharges] = useState(false)

  const filtered = useMemo(() => {
    return initialRentals.filter(r => {
      const producerName = r.producers?.full_name ?? ''
      const matchProducer = producerName.toLowerCase().includes(searchProducer.toLowerCase())
      const matchCode = (r.equipment_code ?? '').toLowerCase().includes(searchCode.toLowerCase())
      return matchProducer && matchCode
    })
  }, [initialRentals, searchProducer, searchCode])

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(r: RentalWithProducer) {
    setEditing(r)
    setDialogOpen(true)
  }

  async function handleDelete(r: RentalWithProducer) {
    if (!confirm(`Excluir equipamento "${r.equipment_name}" (${r.equipment_code ?? ''})?`)) return
    const { error: entryErr } = await supabase
      .from('account_entries')
      .delete()
      .eq('equipment_rental_id', r.id)
    if (entryErr) { toast.error('Erro ao remover lançamentos'); return }
    const { error } = await supabase.from('equipment_rentals').delete().eq('id', r.id)
    if (error) { toast.error('Erro ao excluir equipamento'); return }
    toast.success('Equipamento excluído!')
    router.refresh()
  }

  async function gerarCobrancasMes() {
    const activeRentals = initialRentals.filter(r => r.is_active)
    if (activeRentals.length === 0) { toast.info('Nenhum contrato ativo.'); return }

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const refMonth = `${year}-${String(month).padStart(2, '0')}`
    const monthLabel = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

    const rentalIds = activeRentals.map(r => r.id)
    const { data: existing } = await supabase
      .from('account_entries')
      .select('equipment_rental_id')
      .in('equipment_rental_id', rentalIds)
      .eq('reference_month', refMonth)

    const alreadyBilled = new Set((existing ?? []).map(e => e.equipment_rental_id))
    const toGenerate = activeRentals.filter(r => !alreadyBilled.has(r.id))

    if (toGenerate.length === 0) {
      toast.info(`Todas as cobranças de ${monthLabel} já foram geradas.`)
      return
    }

    if (!confirm(`Gerar ${toGenerate.length} cobrança(s) de aluguel para ${monthLabel}?`)) return

    setGeneratingCharges(true)
    try {
      const daysInMonth = new Date(year, month, 0).getDate()
      const entries = toGenerate.map(r => {
        const day = String(Math.min(r.billing_day, daysInMonth)).padStart(2, '0')
        const producerName = r.producers?.full_name ?? 'Produtor'
        return {
          producer_id: r.producer_id,
          equipment_rental_id: r.id,
          entry_type: 'debito' as const,
          category: 'aluguel_equipamento',
          description: `Aluguel — ${r.equipment_name} (${monthLabel}) · ${producerName}`,
          amount: r.monthly_amount,
          date: `${refMonth}-${day}`,
          reference_month: refMonth,
        }
      })

      const { error } = await supabase.from('account_entries').insert(entries)
      if (error) throw error
      toast.success(`${toGenerate.length} cobrança(s) gerada(s) para ${monthLabel}!`)
      router.refresh()
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Erro ao gerar cobranças')
    } finally {
      setGeneratingCharges(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Buscar por produtor..."
            value={searchProducer}
            onChange={e => setSearchProducer(e.target.value)}
          />
        </div>
        <div className="relative w-full sm:w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Código (EQ-001)"
            value={searchCode}
            onChange={e => setSearchCode(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={gerarCobrancasMes} disabled={generatingCharges} className="gap-2">
          <Zap className="h-4 w-4" />
          {generatingCharges ? 'Gerando...' : 'Gerar cobranças do mês'}
        </Button>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Equipamento
        </Button>
      </div>

      {/* Summary badges */}
      <div className="flex gap-3 text-sm text-gray-500">
        <span>{filtered.length} contrato(s)</span>
        <span>·</span>
        <span className="text-green-600">{filtered.filter(r => r.is_active).length} ativo(s)</span>
        <span>·</span>
        <span>{filtered.filter(r => !r.is_active).length} inativo(s)</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Código</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Equipamento</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Produtor</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Valor/Mês</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Dia Cob.</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Início</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fim</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                  Nenhum equipamento encontrado.
                </td>
              </tr>
            )}
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {r.equipment_code ?? '—'}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{r.equipment_name}</td>
                <td className="px-4 py-3 text-gray-600">
                  {r.producers?.full_name ?? '—'}
                </td>
                <td className="px-4 py-3 text-right font-medium">{fmt(r.monthly_amount)}</td>
                <td className="px-4 py-3 text-center text-gray-600">{r.billing_day}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(r.start_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {r.end_date
                    ? new Date(r.end_date + 'T12:00:00').toLocaleDateString('pt-BR')
                    : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  {r.is_active
                    ? <Badge className="bg-green-100 text-green-700 border-0 gap-1"><CheckCircle className="h-3 w-3" />Ativo</Badge>
                    : <Badge className="bg-gray-100 text-gray-500 border-0 gap-1"><XCircle className="h-3 w-3" />Inativo</Badge>
                  }
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(r)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EquipmentRentalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        producerId=""
        rental={editing}
        producers={producers}
      />
    </div>
  )
}
