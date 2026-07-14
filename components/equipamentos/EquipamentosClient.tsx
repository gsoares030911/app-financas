'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Pencil, Trash2, CheckCircle, XCircle, Zap, Gift, MapPin,
  RotateCcw, ChevronUp, ChevronDown, ChevronsUpDown, Cpu, Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import EquipmentRentalDialog from '@/components/producers/EquipmentRentalDialog'
import PdvDialog from '@/components/equipamentos/PdvDialog'
import MachineDialog from '@/components/equipamentos/MachineDialog'
import type { EquipmentRental, Producer, PdvLocation, Machine, MachineWithStatus, MachineStatus } from '@/lib/types'

export interface RentalWithProducer extends EquipmentRental {
  producers: { id: string; full_name: string } | null
}

type Tab = 'equipamentos' | 'pdv' | 'maquinas'
type EquipFilter = 'todos' | 'ativo' | 'inativo' | 'devolvido'
type PdvFilter = 'todos' | 'ativo' | 'inativo' | 'bonificada' | 'devolvido'
type MachineFilter = 'todos' | 'escritorio' | 'produtor' | 'pdv' | 'devolvida'
type SortDir = 'asc' | 'desc'

type EquipSortCol = 'equipment_code' | 'equipment_name' | 'producer' | 'monthly_amount' | 'billing_day' | 'start_date' | 'end_date' | 'status'
type PdvSortCol = 'name' | 'store_name' | 'phone' | 'monthly_cost' | 'billing_day' | 'status'
type MachineSortCol = 'serial_number' | 'model' | 'operator' | 'received_at' | 'status'

interface Props {
  rentals: RentalWithProducer[]
  producers: Producer[]
  pdvs: PdvLocation[]
  machines: Machine[]
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 ml-1 text-gray-400 inline" />
  return dir === 'asc'
    ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600 inline" />
    : <ChevronDown className="h-3 w-3 ml-1 text-blue-600 inline" />
}

function SortTh({
  children, col, sort, onSort, className = '',
}: {
  children: React.ReactNode
  col: string
  sort: { col: string; dir: SortDir }
  onSort: (col: string) => void
  className?: string
}) {
  return (
    <th
      className={`px-4 py-3 font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center">
        {children}
        <SortIcon active={sort.col === col} dir={sort.dir} />
      </span>
    </th>
  )
}

const MACHINE_STATUS_LABEL: Record<MachineStatus, string> = {
  escritorio: 'No escritório',
  produtor: 'Com Produtor',
  pdv: 'No PDV',
  devolvida: 'Dev. à Operadora',
}

const MACHINE_STATUS_BADGE: Record<MachineStatus, string> = {
  escritorio: 'bg-blue-100 text-blue-700',
  produtor: 'bg-green-100 text-green-700',
  pdv: 'bg-indigo-100 text-indigo-700',
  devolvida: 'bg-red-100 text-red-700',
}

export default function EquipamentosClient({ rentals: initialRentals, producers, pdvs: initialPdvs, machines: initialMachines }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<Tab>('equipamentos')

  // Equipamentos state
  const [searchProducer, setSearchProducer] = useState('')
  const [searchCode, setSearchCode] = useState('')
  const [equipFilter, setEquipFilter] = useState<EquipFilter>('todos')
  const [equipSort, setEquipSort] = useState<{ col: EquipSortCol; dir: SortDir }>({ col: 'equipment_code', dir: 'asc' })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EquipmentRental | null>(null)
  const [generatingCharges, setGeneratingCharges] = useState(false)

  // PDV state
  const [searchPdv, setSearchPdv] = useState('')
  const [pdvFilter, setPdvFilter] = useState<PdvFilter>('todos')
  const [pdvSort, setPdvSort] = useState<{ col: PdvSortCol; dir: SortDir }>({ col: 'name', dir: 'asc' })
  const [pdvDialogOpen, setPdvDialogOpen] = useState(false)
  const [editingPdv, setEditingPdv] = useState<PdvLocation | null>(null)
  const [generatingPdvCharges, setGeneratingPdvCharges] = useState(false)

  // Máquinas state
  const [searchMachine, setSearchMachine] = useState('')
  const [machineFilter, setMachineFilter] = useState<MachineFilter>('todos')
  const [machineSort, setMachineSort] = useState<{ col: MachineSortCol; dir: SortDir }>({ col: 'model', dir: 'asc' })
  const [machineDialogOpen, setMachineDialogOpen] = useState(false)
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null)
  const [selectedMachineIds, setSelectedMachineIds] = useState<Set<string>>(new Set())
  const [devolvendoMachines, setDevolvendoMachines] = useState(false)

  function toggleEquipSort(col: EquipSortCol) {
    setEquipSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }
  function togglePdvSort(col: PdvSortCol) {
    setPdvSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }
  function toggleMachineSort(col: MachineSortCol) {
    setMachineSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  // ── Derive machine status from active assignments ─────────────
  const machinesWithStatus = useMemo((): MachineWithStatus[] => {
    // Build a map: machine_id → { status, name, since }
    const map = new Map<string, { status: MachineStatus; location_name: string | null; location_since: string | null }>()

    for (const r of initialRentals) {
      if (!r.machine_id) continue
      if (r.returned_to_network) {
        if (!map.has(r.machine_id))
          map.set(r.machine_id, { status: 'devolvida', location_name: null, location_since: r.returned_at })
      } else {
        // is_active controla cobrança; localização física depende só de returned_to_network
        map.set(r.machine_id, { status: 'produtor', location_name: r.producers?.full_name ?? null, location_since: r.start_date })
      }
    }

    for (const p of initialPdvs) {
      if (!p.machine_id || map.has(p.machine_id)) continue
      if (p.returned_to_network) {
        map.set(p.machine_id, { status: 'devolvida', location_name: null, location_since: p.returned_at })
      } else {
        map.set(p.machine_id, { status: 'pdv', location_name: p.name, location_since: null })
      }
    }

    return initialMachines.map(m => {
      if (m.returned_to_network) {
        return { ...m, status: 'devolvida' as MachineStatus, location_name: null, location_since: m.returned_at ?? null }
      }
      const assignment = map.get(m.id)
      return {
        ...m,
        status: assignment?.status ?? 'escritorio',
        location_name: assignment?.location_name ?? null,
        location_since: assignment?.location_since ?? null,
      }
    })
  }, [initialMachines, initialRentals, initialPdvs])

  const filteredRentals = useMemo(() => {
    const list = initialRentals.filter(r => {
      const producerName = r.producers?.full_name ?? ''
      const matchProducer = producerName.toLowerCase().includes(searchProducer.toLowerCase())
      const matchCode = (r.equipment_code ?? '').toLowerCase().includes(searchCode.toLowerCase())
      if (!matchProducer || !matchCode) return false
      if (equipFilter === 'ativo') return r.is_active && !r.returned_to_network
      if (equipFilter === 'inativo') return !r.is_active && !r.returned_to_network
      if (equipFilter === 'devolvido') return r.returned_to_network
      return true
    })
    const { col, dir } = equipSort
    list.sort((a, b) => {
      let va: string | number
      let vb: string | number
      if (col === 'producer') { va = a.producers?.full_name ?? ''; vb = b.producers?.full_name ?? '' }
      else if (col === 'status') {
        const rank = (r: RentalWithProducer) => r.returned_to_network ? 2 : r.is_active ? 0 : 1
        va = rank(a); vb = rank(b)
      } else {
        va = (a as unknown as Record<string, string | number>)[col] ?? ''
        vb = (b as unknown as Record<string, string | number>)[col] ?? ''
      }
      return va < vb ? (dir === 'asc' ? -1 : 1) : va > vb ? (dir === 'asc' ? 1 : -1) : 0
    })
    return list
  }, [initialRentals, searchProducer, searchCode, equipFilter, equipSort])

  const filteredPdvs = useMemo(() => {
    const q = searchPdv.toLowerCase()
    const list = initialPdvs.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(q) || p.store_name.toLowerCase().includes(q)
      if (!matchSearch) return false
      if (pdvFilter === 'ativo') return p.is_active && !p.returned_to_network
      if (pdvFilter === 'inativo') return !p.is_active && !p.returned_to_network
      if (pdvFilter === 'bonificada') return p.is_bonificada
      if (pdvFilter === 'devolvido') return p.returned_to_network
      return true
    })
    const { col, dir } = pdvSort
    list.sort((a, b) => {
      let va: string | number
      let vb: string | number
      if (col === 'status') {
        const rank = (p: PdvLocation) => p.returned_to_network ? 2 : p.is_active ? 0 : 1
        va = rank(a); vb = rank(b)
      } else {
        va = (a as unknown as Record<string, string | number>)[col] ?? ''
        vb = (b as unknown as Record<string, string | number>)[col] ?? ''
      }
      return va < vb ? (dir === 'asc' ? -1 : 1) : va > vb ? (dir === 'asc' ? 1 : -1) : 0
    })
    return list
  }, [initialPdvs, searchPdv, pdvFilter, pdvSort])

  const filteredMachines = useMemo(() => {
    const q = searchMachine.toLowerCase()
    const list = machinesWithStatus.filter(m => {
      const matchSearch =
        m.serial_number.toLowerCase().includes(q) ||
        m.model.toLowerCase().includes(q) ||
        m.operator.toLowerCase().includes(q) ||
        (m.location_name ?? '').toLowerCase().includes(q)
      if (!matchSearch) return false
      if (machineFilter !== 'todos' && m.status !== machineFilter) return false
      return true
    })
    const { col, dir } = machineSort
    list.sort((a, b) => {
      let va: string | number
      let vb: string | number
      if (col === 'status') {
        const rank: Record<MachineStatus, number> = { escritorio: 0, produtor: 1, pdv: 2, devolvida: 3 }
        va = rank[a.status]; vb = rank[b.status]
      } else {
        va = (a as unknown as Record<string, string | number>)[col] ?? ''
        vb = (b as unknown as Record<string, string | number>)[col] ?? ''
      }
      return va < vb ? (dir === 'asc' ? -1 : 1) : va > vb ? (dir === 'asc' ? 1 : -1) : 0
    })
    return list
  }, [machinesWithStatus, searchMachine, machineFilter, machineSort])

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
    const active = initialRentals.filter(r => r.is_active && !r.is_bonificada)
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
    if (toGenerate.length === 0) { toast.info(`Todas as cobranças de ${monthLabel} já foram geradas.`); return }
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
    if (toGenerate.length === 0) { toast.info(`Todas as despesas de PDV de ${monthLabel} já foram geradas.`); return }
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

  // ── Máquinas handlers ─────────────────────────────────────────

  function toggleMachineSelection(id: string) {
    setSelectedMachineIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAllMachines() {
    const selectableIds = filteredMachines
      .filter(m => m.status !== 'devolvida')
      .map(m => m.id)
    const allSelected = selectableIds.every(id => selectedMachineIds.has(id))
    if (allSelected) {
      setSelectedMachineIds(new Set())
    } else {
      setSelectedMachineIds(new Set(selectableIds))
    }
  }

  async function handleDevolverSelecionadas() {
    const ids = [...selectedMachineIds]
    if (ids.length === 0) return

    // Conta contratos ativos vinculados para informar o usuário
    const rentaisVinculados = initialRentals.filter(r => r.machine_id && ids.includes(r.machine_id) && !r.returned_to_network)
    const pdvsVinculados = initialPdvs.filter(p => p.machine_id && ids.includes(p.machine_id) && !p.returned_to_network)
    const totalContratos = rentaisVinculados.length + pdvsVinculados.length

    const msg = totalContratos > 0
      ? `Devolver ${ids.length} máquina(s) à operadora?\n\nIsso vai encerrar ${totalContratos} contrato(s) vinculado(s). A cobrança do mês atual é mantida; meses futuros não serão gerados.`
      : `Devolver ${ids.length} máquina(s) à operadora? Esta ação marca as máquinas como saídas do inventário.`
    if (!confirm(msg)) return

    setDevolvendoMachines(true)
    try {
      const today = new Date().toISOString().split('T')[0]

      // Encerra contratos de produtor vinculados
      if (rentaisVinculados.length > 0) {
        const { error } = await supabase
          .from('equipment_rentals')
          .update({ returned_to_network: true, is_active: false, returned_at: today })
          .in('id', rentaisVinculados.map(r => r.id))
        if (error) throw error
      }

      // Encerra PDVs vinculados
      if (pdvsVinculados.length > 0) {
        const { error } = await supabase
          .from('pdv_locations')
          .update({ returned_to_network: true, is_active: false, returned_at: today })
          .in('id', pdvsVinculados.map(p => p.id))
        if (error) throw error
      }

      // Marca as máquinas como devolvidas
      const { error } = await supabase
        .from('machines')
        .update({ returned_to_network: true, returned_at: today })
        .in('id', ids)
      if (error) throw error

      const partes = [`${ids.length} máquina(s) devolvida(s) à operadora`]
      if (totalContratos > 0) partes.push(`${totalContratos} contrato(s) encerrado(s)`)
      toast.success(partes.join(' · ') + '!')
      setSelectedMachineIds(new Set())
      router.refresh()
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Erro ao devolver máquinas')
    } finally {
      setDevolvendoMachines(false)
    }
  }

  async function handleDeleteMachine(m: Machine) {
    if (!confirm(`Excluir máquina "${m.serial_number}" (${m.model})?`)) return
    const { error } = await supabase.from('machines').delete().eq('id', m.id)
    if (error) { toast.error('Erro ao excluir máquina'); return }
    toast.success('Máquina excluída!')
    router.refresh()
  }

  // ── Counts ────────────────────────────────────────────────────
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

  const machineCounts = useMemo(() => ({
    total: machinesWithStatus.length,
    escritorio: machinesWithStatus.filter(m => m.status === 'escritorio').length,
    produtor: machinesWithStatus.filter(m => m.status === 'produtor').length,
    pdv: machinesWithStatus.filter(m => m.status === 'pdv').length,
    devolvida: machinesWithStatus.filter(m => m.status === 'devolvida').length,
  }), [machinesWithStatus])

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab('equipamentos')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'equipamentos' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Equipamentos de Produtor
        </button>
        <button
          onClick={() => setActiveTab('pdv')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'pdv' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <MapPin className="h-3.5 w-3.5" />
          Pontos de Venda
        </button>
        <button
          onClick={() => setActiveTab('maquinas')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'maquinas' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Cpu className="h-3.5 w-3.5" />
          Máquinas
          {machineCounts.escritorio > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
              {machineCounts.escritorio} no escritório
            </span>
          )}
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

          <div className="flex flex-wrap gap-2 text-sm">
            {(
              [
                { key: 'todos',    label: `Todos (${equipCounts.total})` },
                { key: 'ativo',    label: `Ativos (${equipCounts.ativos})`,               activeClass: 'bg-green-600 text-white border-green-600',   inactiveClass: 'text-green-700 border-green-300 hover:bg-green-50' },
                { key: 'inativo',  label: `Inativos (${equipCounts.inativos})`,           activeClass: 'bg-gray-500 text-white border-gray-500',     inactiveClass: 'text-gray-600 border-gray-300 hover:bg-gray-50' },
                { key: 'devolvido',label: `Dev. à Operadora (${equipCounts.devolvidos})`, activeClass: 'bg-red-600 text-white border-red-600',       inactiveClass: 'text-red-700 border-red-300 hover:bg-red-50' },
              ] as { key: EquipFilter; label: string; activeClass?: string; inactiveClass?: string }[]
            ).map(chip => {
              const isActive = equipFilter === chip.key
              return (
                <button key={chip.key} onClick={() => setEquipFilter(chip.key)}
                  className={`px-3 py-1 rounded-full border font-medium transition-colors ${isActive ? (chip.activeClass ?? 'bg-blue-600 text-white border-blue-600') : (chip.inactiveClass ?? 'text-blue-700 border-blue-300 hover:bg-blue-50')}`}
                >
                  {chip.label}
                </button>
              )
            })}
            {filteredRentals.length !== initialRentals.length && (
              <span className="self-center text-xs text-gray-400">mostrando {filteredRentals.length}</span>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <SortTh col="equipment_code" sort={equipSort} onSort={col => toggleEquipSort(col as EquipSortCol)} className="text-left">Código</SortTh>
                  <SortTh col="equipment_name" sort={equipSort} onSort={col => toggleEquipSort(col as EquipSortCol)} className="text-left">Equipamento</SortTh>
                  <SortTh col="producer" sort={equipSort} onSort={col => toggleEquipSort(col as EquipSortCol)} className="text-left">Produtor</SortTh>
                  <SortTh col="monthly_amount" sort={equipSort} onSort={col => toggleEquipSort(col as EquipSortCol)} className="text-right">Valor/Mês</SortTh>
                  <SortTh col="billing_day" sort={equipSort} onSort={col => toggleEquipSort(col as EquipSortCol)} className="text-center">Dia Cob.</SortTh>
                  <SortTh col="start_date" sort={equipSort} onSort={col => toggleEquipSort(col as EquipSortCol)} className="text-left">Início</SortTh>
                  <SortTh col="end_date" sort={equipSort} onSort={col => toggleEquipSort(col as EquipSortCol)} className="text-left">Fim</SortTh>
                  <SortTh col="status" sort={equipSort} onSort={col => toggleEquipSort(col as EquipSortCol)} className="text-center">Status</SortTh>
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

          <div className="flex flex-wrap gap-2 text-sm">
            {(
              [
                { key: 'todos',     label: `Todos (${pdvCounts.total})` },
                { key: 'ativo',     label: `Ativos (${pdvCounts.ativos})`,                 activeClass: 'bg-green-600 text-white border-green-600',   inactiveClass: 'text-green-700 border-green-300 hover:bg-green-50' },
                { key: 'inativo',   label: `Inativos (${pdvCounts.inativos})`,             activeClass: 'bg-gray-500 text-white border-gray-500',     inactiveClass: 'text-gray-600 border-gray-300 hover:bg-gray-50' },
                { key: 'bonificada',label: `Bonificadas (${pdvCounts.bonificadas})`,       activeClass: 'bg-blue-600 text-white border-blue-600',     inactiveClass: 'text-blue-700 border-blue-300 hover:bg-blue-50' },
                { key: 'devolvido', label: `Dev. à Operadora (${pdvCounts.devolvidos})`,   activeClass: 'bg-red-600 text-white border-red-600',       inactiveClass: 'text-red-700 border-red-300 hover:bg-red-50' },
              ] as { key: PdvFilter; label: string; activeClass?: string; inactiveClass?: string }[]
            ).map(chip => {
              const isActive = pdvFilter === chip.key
              return (
                <button key={chip.key} onClick={() => setPdvFilter(chip.key)}
                  className={`px-3 py-1 rounded-full border font-medium transition-colors ${isActive ? (chip.activeClass ?? 'bg-blue-600 text-white border-blue-600') : (chip.inactiveClass ?? 'text-blue-700 border-blue-300 hover:bg-blue-50')}`}
                >
                  {chip.label}
                </button>
              )
            })}
            {filteredPdvs.length !== initialPdvs.length && (
              <span className="self-center text-xs text-gray-400">mostrando {filteredPdvs.length}</span>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <SortTh col="name" sort={pdvSort} onSort={col => togglePdvSort(col as PdvSortCol)} className="text-left">PDV</SortTh>
                  <SortTh col="store_name" sort={pdvSort} onSort={col => togglePdvSort(col as PdvSortCol)} className="text-left">Loja Parceira</SortTh>
                  <SortTh col="phone" sort={pdvSort} onSort={col => togglePdvSort(col as PdvSortCol)} className="text-left">Telefone</SortTh>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Endereço</th>
                  <SortTh col="monthly_cost" sort={pdvSort} onSort={col => togglePdvSort(col as PdvSortCol)} className="text-right">Custo/Mês</SortTh>
                  <SortTh col="billing_day" sort={pdvSort} onSort={col => togglePdvSort(col as PdvSortCol)} className="text-center">Dia Cob.</SortTh>
                  <SortTh col="status" sort={pdvSort} onSort={col => togglePdvSort(col as PdvSortCol)} className="text-center">Status</SortTh>
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

      {/* ── Aba Máquinas ── */}
      {activeTab === 'maquinas' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input className="pl-9" placeholder="Buscar por série, modelo, operadora ou local..." value={searchMachine} onChange={e => setSearchMachine(e.target.value)} />
            </div>
            {selectedMachineIds.size > 0 && (
              <Button
                variant="outline"
                onClick={handleDevolverSelecionadas}
                disabled={devolvendoMachines}
                className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
              >
                <RotateCcw className="h-4 w-4" />
                {devolvendoMachines ? 'Devolvendo...' : `Devolver Selecionadas (${selectedMachineIds.size})`}
              </Button>
            )}
            <Button onClick={() => { setEditingMachine(null); setMachineDialogOpen(true) }} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Máquina
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            {(
              [
                { key: 'todos',     label: `Todas (${machineCounts.total})` },
                { key: 'escritorio',label: `No escritório (${machineCounts.escritorio})`,  activeClass: 'bg-blue-600 text-white border-blue-600',     inactiveClass: 'text-blue-700 border-blue-300 hover:bg-blue-50' },
                { key: 'produtor',  label: `Com Produtor (${machineCounts.produtor})`,     activeClass: 'bg-green-600 text-white border-green-600',   inactiveClass: 'text-green-700 border-green-300 hover:bg-green-50' },
                { key: 'pdv',       label: `No PDV (${machineCounts.pdv})`,               activeClass: 'bg-indigo-600 text-white border-indigo-600', inactiveClass: 'text-indigo-700 border-indigo-300 hover:bg-indigo-50' },
                { key: 'devolvida', label: `Dev. à Operadora (${machineCounts.devolvida})`,activeClass: 'bg-red-600 text-white border-red-600',       inactiveClass: 'text-red-700 border-red-300 hover:bg-red-50' },
              ] as { key: MachineFilter; label: string; activeClass?: string; inactiveClass?: string }[]
            ).map(chip => {
              const isActive = machineFilter === chip.key
              return (
                <button key={chip.key} onClick={() => setMachineFilter(chip.key)}
                  className={`px-3 py-1 rounded-full border font-medium transition-colors ${isActive ? (chip.activeClass ?? 'bg-blue-600 text-white border-blue-600') : (chip.inactiveClass ?? 'text-blue-700 border-blue-300 hover:bg-blue-50')}`}
                >
                  {chip.label}
                </button>
              )
            })}
            {filteredMachines.length !== initialMachines.length && (
              <span className="self-center text-xs text-gray-400">mostrando {filteredMachines.length}</span>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      className="rounded w-4 h-4 accent-blue-600"
                      checked={filteredMachines.filter(m => m.status !== 'devolvida').length > 0 &&
                        filteredMachines.filter(m => m.status !== 'devolvida').every(m => selectedMachineIds.has(m.id))}
                      onChange={toggleSelectAllMachines}
                    />
                  </th>
                  <SortTh col="model" sort={machineSort} onSort={col => toggleMachineSort(col as MachineSortCol)} className="text-left">Modelo</SortTh>
                  <SortTh col="operator" sort={machineSort} onSort={col => toggleMachineSort(col as MachineSortCol)} className="text-left">Operadora</SortTh>
                  <SortTh col="received_at" sort={machineSort} onSort={col => toggleMachineSort(col as MachineSortCol)} className="text-left">Recebida em</SortTh>
                  <SortTh col="status" sort={machineSort} onSort={col => toggleMachineSort(col as MachineSortCol)} className="text-left">Status / Localização</SortTh>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMachines.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    {initialMachines.length === 0
                      ? 'Nenhuma máquina cadastrada. Cadastre as máquinas recebidas da operadora.'
                      : 'Nenhuma máquina encontrada.'}
                  </td></tr>
                )}
                {filteredMachines.map(m => (
                  <tr key={m.id} className={`hover:bg-gray-50 transition-colors ${selectedMachineIds.has(m.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-3">
                      {m.status !== 'devolvida' && (
                        <input
                          type="checkbox"
                          className="rounded w-4 h-4 accent-blue-600"
                          checked={selectedMachineIds.has(m.id)}
                          onChange={() => toggleMachineSelection(m.id)}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{m.model}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-gray-600">
                        <Building2 className="h-3 w-3 text-gray-400" />
                        {m.operator}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {m.received_at ? new Date(m.received_at + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <Badge className={`${MACHINE_STATUS_BADGE[m.status]} border-0 w-fit`}>
                          {MACHINE_STATUS_LABEL[m.status]}
                        </Badge>
                        {m.location_name && (
                          <span className="text-xs text-gray-500">{m.location_name}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingMachine(m); setMachineDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteMachine(m)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
        machines={machinesWithStatus.filter(m =>
          m.status === 'escritorio' || m.id === editing?.machine_id
        )}
      />
      <PdvDialog
        open={pdvDialogOpen}
        onOpenChange={setPdvDialogOpen}
        pdv={editingPdv}
        machines={machinesWithStatus.filter(m =>
          m.status === 'escritorio' || m.id === editingPdv?.machine_id
        )}
      />
      <MachineDialog
        open={machineDialogOpen}
        onOpenChange={setMachineDialogOpen}
        machine={editingMachine}
      />
    </div>
  )
}
