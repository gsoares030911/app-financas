'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Pencil, Trash2, CheckCircle, XCircle, Zap, Gift, MapPin, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import EquipmentRentalDialog from '@/components/producers/EquipmentRentalDialog'
import PdvDialog from '@/components/equipamentos/PdvDialog'
import type { EquipmentRental, Producer, PdvLocation } from '@/lib/types'

export interface RentalWithProducer extends EquipmentRental {
  producers: { id: string; full_name: string } | null
}

type Tab = 'equipamentos' | 'pdv'
type EquipFilter = 'todos' | 'ativo' | 'inativo' | 'devolvido'
type PdvFilter = 'todos' | 'ativo' | 'inativo' | 'bonificada' | 'devolvido'

interface Props {
  rentals: RentalWithProducer[]
  producers: Producer[]
  pdvs: PdvLocation[]
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function EquipamentosClient({ rentals: initialRentals, producers, pdvs: initialPdvs }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<Tab>('equipamentos')

  // Equipamentos state
  const [searchProducer, setSearchProducer] = useState('')
  const [searchCode, setSearchCode] = useState('')
  const [equipFilter, setEquipFilter] = useState<EquipFilter>('todos')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EquipmentRental | null>(null)
  const [generatingCharges, setGeneratingCharges] = useState(false)

  // PDV state
  const [searchPdv, setSearchPdv] = useState('')
  const [pdvFilter, setPdvFilter] = useState<PdvFilter>('todos')
  const [pdvDialogOpen, setPdvDialogOpen] = useState(false)
  const [editingPdv, setEditingPdv] = useState<PdvLocation | null>(null)
  const [generatingPdvCharges, setGeneratingPdvCharges] = useState(false)

  const filteredRentals = useMemo(() => {
    return initialRentals.filter(r => {
      const producerName = r.producers?.full_name ?? ''
      const matchProducer = producerName.toLowerCase().includes(searchProducer.toLowerCase())
      const matchCode = (r.equipment_code ?? '').toLowerCase().includes(searchCode.toLowerCase())
      if (!matchProducer || !matchCode) return false
      if (equipFilter === 'ativo') return r.is_active && !r.returned_to_network
      if (equipFilter === 'inativo') return !r.is_active && !r.returned_to_network
      if (equipFilter === 'devolvido') return r.returned_to_network
      return true
    })
  }, [initialRentals, searchProducer, searchCode, equipFilter])

  const filteredPdvs = useMemo(() => {
    const q = searchPdv.toLowerCase()
    return initialPdvs.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(q) || p.store_name.toLowerCase().includes(q)
      if (!matchSearch) return false
      if (pdvFilter === 'ativo') return p.is_active && !p.returned_to_network
      if (pdvFilter === 'inativo') return !p.is_active && !p.returned_to_network
      if (pdvFilter === 'bonificada') return p.is_bonificada
      if (pdvFilter === 'devolvido') return p.returned_to_network
      return true
    })
  }, [initialPdvs, searchPdv, pdvFilter])

  // ── Equipamentos handlers ──────────────────────────────────────

  async function handleDeleteRental(r: RentalWithProducer) {
    if (!confirm(`Excluir equipamento "${r.equipment_name}" (${r.equipment_code ?? ''})?`)) return
    const { error: entryErr } = await supabase
      .from('account_entries').delete().eq('equipment_rental_id', r.id)
    if (entryErr) { toast.error('Erro ao remover lançamentos'); return }
    const { error } = await supabase.from('equipment_rentals').delete().eq('id', r.id)
    if (error) { toast.error('Erro ao excluir equipamento'); return }
    toast.success('Equipamento excluído!')
    router.refresh()
  }

  async function gerarCobrancasEquip() {
    const active = initialRentals.filter(r => r.is_active)
    if (active.length === 0) { toast.info('Nenhum contrato ativo.'); return }

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const refMonth = `${year}-${String(month).padStart(2, '0')}`
    const monthLabel = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

    const { data: existing } = await supabase
      .from('account_entries').select('equipment_rental_id')
      .in('equipment_rental_id', active.map(r => r.id))
      .eq('reference_month', refMonth)

    const alreadyBilled = new Set((existing ?? []).map(e => e.equipment_rental_id))
    const toGenerate = active.filter(r => !alreadyBilled.has(r.id))

    if (toGenerate.length === 0) {
      toast.info(`Todas as cobranças de ${monthLabel} já foram geradas.`); return
    }
    if (!confirm(`Gerar ${toGenerate.length} cobrança(s) de aluguel para ${monthLabel}?`)) return

    setGeneratingCharges(true)
    try {
      const daysInMonth = new Date(year, month, 0).getDate()
      const entries = toGenerate.map(r => {
        const day = String(Math.min(r.billing_day, daysInMonth)).padStart(2, '0')
        return {
          producer_id: r.producer_id,
          equipment_rental_id: r.id,
          entry_type: 'debito' as const,
          category: 'aluguel_equipamento',
          description: `Aluguel — ${r.equipment_name} (${monthLabel}) · ${r.producers?.full_name ?? ''}`,
          amount: r.monthly_amount,
          date: `${refMonth}-${day}`,
          reference_month: refMonth,
        }
      })
      const { error } = await supabase.from('account_entries').insert(entries)
      if (error) throw error
      toast.success(`${toGenerate.length} cobrança(s) gerada(s)!`)
      router.refresh()
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Erro ao gerar cobranças')
    } finally {
      setGeneratingCharges(false)
    }
  }

  // ── PDV handlers ──────────────────────────────────────────────

  async function handleDeletePdv(p: PdvLocation) {
    if (!confirm(`Excluir PDV "${p.name}" — ${p.store_name}?`)) return
    const { error: entryErr } = await supabase
      .from('platform_entries').delete().eq('pdv_location_id', p.id)
    if (entryErr) { toast.error('Erro ao remover lançamentos'); return }
    const { error } = await supabase.from('pdv_locations').delete().eq('id', p.id)
    if (error) { toast.error('Erro ao excluir PDV'); return }
    toast.success('PDV excluído!')
    router.refresh()
  }

  async function gerarCobrancasPdv() {
    const active = initialPdvs.filter(p => p.is_active && !p.is_bonificada && p.monthly_cost > 0)
    if (active.length === 0) { toast.info('Nenhum PDV com custo ativo.'); return }

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const refMonth = `${year}-${String(month).padStart(2, '0')}`
    const monthLabel = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

    const { data: existing } = await supabase
      .from('platform_entries').select('pdv_location_id')
      .in('pdv_location_id', active.map(p => p.id))
      .eq('reference_month', refMonth)

    const alreadyBilled = new Set((existing ?? []).map(e => e.pdv_location_id))
    const toGenerate = active.filter(p => !alreadyBilled.has(p.id))

    if (toGenerate.length === 0) {
      toast.info(`Todas as despesas de PDV de ${monthLabel} já foram geradas.`); return
    }
    if (!confirm(`Gerar ${toGenerate.length} despesa(s) de PDV para ${monthLabel}?`)) return

    setGeneratingPdvCharges(true)
    try {
      const daysInMonth = new Date(year, month, 0).getDate()
      const entries = toGenerate.map(p => {
        const day = String(Math.min(p.billing_day, daysInMonth)).padStart(2, '0')
        return {
          entry_type: 'despesa' as const,
          category: 'aluguel_pdv',
          description: `Aluguel PDV — ${p.name} · ${p.store_name} (${monthLabel})`,
          amount: p.monthly_cost,
          date: `${refMonth}-${day}`,
          pdv_location_id: p.id,
          reference_month: refMonth,
          event_id: null,
          producer_id: null,
        }
      })
      const { error } = await supabase.from('platform_entries').insert(entries)
      if (error) throw error
      toast.success(`${toGenerate.length} despesa(s) de PDV gerada(s)!`)
      router.refresh()
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Erro ao gerar despesas PDV')
    } finally {
      setGeneratingPdvCharges(false)
    }
  }

  // ── Counts (always from full list, not filtered) ──────────────
  const equipCounts = useMemo(() => ({
    total: initialRentals.length,
    ativos: initialRentals.filter(r => r.is_active && !r.returned_to_network).length,
    inativos: initialRentals.filter(r => !r.is_active && !r.returned_to_network).length,
    devolvidos: initialRentals.filter(r => r.returned_to_network).length,
  }), [initialRentals])

  const pdvCounts = useMemo(() => ({
    total: initialPdvs.length,
    ativos: initialPdvs.filter(p => p.is_active && !p.returned_to_network).length,
    inativos: initialPdvs.filter(p => !p.is_active && !p.returned_to_network).length,
    bonificadas: initialPdvs.filter(p => p.is_bonificada).length,
    devolvidos: initialPdvs.filter(p => p.returned_to_network).length,
  }), [initialPdvs])

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab('equipamentos')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'equipamentos'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Equipamentos de Produtor
        </button>
        <button
          onClick={() => setActiveTab('pdv')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'pdv'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <MapPin className="h-3.5 w-3.5" />
          Pontos de Venda
        </button>
      </div>

      {/* ── Aba Equipamentos ── */}
      {activeTab === 'equipamentos' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input className="pl-9" placeholder="Buscar por produtor..." value={searchProducer} onChange={e => setSearchProducer(e.target.value)} />
            </div>
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input className="pl-9" placeholder="Código (EQ-001)" value={searchCode} onChange={e => setSearchCode(e.target.value)} />
            </div>
            <Button variant="outline" onClick={gerarCobrancasEquip} disabled={generatingCharges} className="gap-2">
              <Zap className="h-4 w-4" />
              {generatingCharges ? 'Gerando...' : 'Gerar cobranças do mês'}
            </Button>
            <Button onClick={() => { setEditing(null); setDialogOpen(true) }} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Equipamento
            </Button>
          </div>

          {/* Filter chips — Equipamentos */}
          <div className="flex flex-wrap gap-2 text-sm">
            {(
              [
                { key: 'todos',    label: `Todos (${equipCounts.total})` },
                { key: 'ativo',    label: `Ativos (${equipCounts.ativos})`,                 activeClass: 'bg-green-600 text-white border-green-600',   inactiveClass: 'text-green-700 border-green-300 hover:bg-green-50' },
                { key: 'inativo',  label: `Inativos (${equipCounts.inativos})`,             activeClass: 'bg-gray-500 text-white border-gray-500',     inactiveClass: 'text-gray-600 border-gray-300 hover:bg-gray-50' },
                { key: 'devolvido',label: `Dev. à Operadora (${equipCounts.devolvidos})`,   activeClass: 'bg-red-600 text-white border-red-600',       inactiveClass: 'text-red-700 border-red-300 hover:bg-red-50' },
              ] as { key: EquipFilter; label: string; activeClass?: string; inactiveClass?: string }[]
            ).map(chip => {
              const isActive = equipFilter === chip.key
              return (
                <button
                  key={chip.key}
                  onClick={() => setEquipFilter(chip.key)}
                  className={`px-3 py-1 rounded-full border font-medium transition-colors ${
                    isActive
                      ? (chip.activeClass ?? 'bg-blue-600 text-white border-blue-600')
                      : (chip.inactiveClass ?? 'text-blue-700 border-blue-300 hover:bg-blue-50')
                  }`}
                >
                  {chip.label}
                </button>
              )
            })}
            {filteredRentals.length !== initialRentals.length && (
              <span className="self-center text-xs text-gray-400">
                mostrando {filteredRentals.length}
              </span>
            )}
          </div>

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
                {filteredRentals.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Nenhum equipamento encontrado.</td></tr>
                )}
                {filteredRentals.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.equipment_code ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.equipment_name}</td>
                    <td className="px-4 py-3 text-gray-600">{r.producers?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(r.monthly_amount)}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{r.billing_day}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(r.start_date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 text-gray-500">{r.end_date ? new Date(r.end_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {r.returned_to_network
                        ? <Badge className="bg-red-100 text-red-700 border-0 gap-1"><RotateCcw className="h-3 w-3" />Dev. à Operadora</Badge>
                        : r.is_active
                          ? <Badge className="bg-green-100 text-green-700 border-0 gap-1"><CheckCircle className="h-3 w-3" />Ativo</Badge>
                          : <Badge className="bg-gray-100 text-gray-500 border-0 gap-1"><XCircle className="h-3 w-3" />Inativo</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(r); setDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteRental(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Aba Pontos de Venda ── */}
      {activeTab === 'pdv' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input className="pl-9" placeholder="Buscar por PDV ou loja..." value={searchPdv} onChange={e => setSearchPdv(e.target.value)} />
            </div>
            <Button variant="outline" onClick={gerarCobrancasPdv} disabled={generatingPdvCharges} className="gap-2">
              <Zap className="h-4 w-4" />
              {generatingPdvCharges ? 'Gerando...' : 'Gerar despesas do mês'}
            </Button>
            <Button onClick={() => { setEditingPdv(null); setPdvDialogOpen(true) }} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo PDV
            </Button>
          </div>

          {/* Filter chips — PDVs */}
          <div className="flex flex-wrap gap-2 text-sm">
            {(
              [
                { key: 'todos',     label: `Todos (${pdvCounts.total})` },
                { key: 'ativo',     label: `Ativos (${pdvCounts.ativos})`,                  activeClass: 'bg-green-600 text-white border-green-600',   inactiveClass: 'text-green-700 border-green-300 hover:bg-green-50' },
                { key: 'inativo',   label: `Inativos (${pdvCounts.inativos})`,              activeClass: 'bg-gray-500 text-white border-gray-500',     inactiveClass: 'text-gray-600 border-gray-300 hover:bg-gray-50' },
                { key: 'bonificada',label: `Bonificadas (${pdvCounts.bonificadas})`,        activeClass: 'bg-blue-600 text-white border-blue-600',     inactiveClass: 'text-blue-700 border-blue-300 hover:bg-blue-50' },
                { key: 'devolvido', label: `Dev. à Operadora (${pdvCounts.devolvidos})`,    activeClass: 'bg-red-600 text-white border-red-600',       inactiveClass: 'text-red-700 border-red-300 hover:bg-red-50' },
              ] as { key: PdvFilter; label: string; activeClass?: string; inactiveClass?: string }[]
            ).map(chip => {
              const isActive = pdvFilter === chip.key
              return (
                <button
                  key={chip.key}
                  onClick={() => setPdvFilter(chip.key)}
                  className={`px-3 py-1 rounded-full border font-medium transition-colors ${
                    isActive
                      ? (chip.activeClass ?? 'bg-blue-600 text-white border-blue-600')
                      : (chip.inactiveClass ?? 'text-blue-700 border-blue-300 hover:bg-blue-50')
                  }`}
                >
                  {chip.label}
                </button>
              )
            })}
            {filteredPdvs.length !== initialPdvs.length && (
              <span className="self-center text-xs text-gray-400">
                mostrando {filteredPdvs.length}
              </span>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">PDV</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Loja Parceira</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Telefone</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Endereço</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Custo/Mês</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Dia Cob.</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPdvs.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Nenhum ponto de venda cadastrado.</td></tr>
                )}
                {filteredPdvs.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.store_name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{p.address ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {p.is_bonificada
                        ? <span className="flex items-center justify-end gap-1 text-blue-600"><Gift className="h-3.5 w-3.5" />Bonificada</span>
                        : <span className="font-medium">{fmt(p.monthly_cost)}</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{p.is_bonificada ? '—' : p.billing_day}</td>
                    <td className="px-4 py-3 text-center">
                      {p.returned_to_network
                        ? <Badge className="bg-red-100 text-red-700 border-0 gap-1"><RotateCcw className="h-3 w-3" />Dev. à Operadora</Badge>
                        : p.is_active
                          ? <Badge className="bg-green-100 text-green-700 border-0 gap-1"><CheckCircle className="h-3 w-3" />Ativo</Badge>
                          : <Badge className="bg-gray-100 text-gray-500 border-0 gap-1"><XCircle className="h-3 w-3" />Inativo</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingPdv(p); setPdvDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeletePdv(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EquipmentRentalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        producerId=""
        rental={editing}
        producers={producers}
      />
      <PdvDialog
        open={pdvDialogOpen}
        onOpenChange={setPdvDialogOpen}
        pdv={editingPdv}
      />
    </div>
  )
}
