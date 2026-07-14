'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { EquipmentRental, EquipmentRentalFormData, Producer, Machine } from '@/lib/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  producerId: string
  rental: EquipmentRental | null
  producers?: Producer[]
  machines?: Machine[]
}

const today = new Date().toISOString().split('T')[0]

const EMPTY: EquipmentRentalFormData = {
  monthly_amount: '',
  billing_day: '',
  start_date: today,
  end_date: '',
  is_active: true,
  is_bonificada: false,
  returned_to_network: false,
  returned_at: '',
  notes: '',
  machine_id: '',
}

async function nextCode(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await supabase
    .from('equipment_rentals')
    .select('equipment_code')
    .like('equipment_code', 'EQ-%')
    .order('equipment_code', { ascending: false })
    .limit(1)
  const last = (data?.[0]?.equipment_code as string | null) ?? null
  if (!last) return 'EQ-001'
  const n = parseInt(last.slice(3), 10)
  return `EQ-${String(n + 1).padStart(3, '0')}`
}

export default function EquipmentRentalDialog({ open, onOpenChange, producerId, rental, producers, machines }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState<EquipmentRentalFormData>(EMPTY)
  const [loading, setLoading] = useState(false)
  const standalone = !!producers

  const [selectedProducerId, setSelectedProducerId] = useState(producerId)
  const [producerSearch, setProducerSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filteredProducers = producers
    ? producers.filter(p => p.full_name.toLowerCase().includes(producerSearch.toLowerCase())).slice(0, 10)
    : []

  useEffect(() => {
    if (rental) {
      setForm({
        monthly_amount: rental.monthly_amount,
        billing_day: rental.billing_day,
        start_date: rental.start_date,
        end_date: rental.end_date ?? '',
        is_active: rental.is_active,
        is_bonificada: rental.is_bonificada,
        returned_to_network: rental.returned_to_network,
        returned_at: rental.returned_at ?? '',
        notes: rental.notes ?? '',
        machine_id: rental.machine_id ?? '',
      })
      if (standalone && producers) {
        const p = producers.find(x => x.id === rental.producer_id)
        setSelectedProducerId(rental.producer_id)
        setProducerSearch(p?.full_name ?? '')
      }
    } else {
      setForm(EMPTY)
      if (standalone) {
        setSelectedProducerId('')
        setProducerSearch('')
      }
    }
  }, [rental, open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function set<K extends keyof EquipmentRentalFormData>(field: K, value: EquipmentRentalFormData[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function selectProducer(p: Producer) {
    setSelectedProducerId(p.id)
    setProducerSearch(p.full_name)
    setShowDropdown(false)
  }

  function handleBonificada(checked: boolean) {
    setForm(prev => ({
      ...prev,
      is_bonificada: checked,
      monthly_amount: checked ? 0 : '',
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const pid = standalone ? selectedProducerId : producerId
    if (standalone && !pid) { toast.error('Selecione um produtor'); return }
    if (!form.machine_id) { toast.error('Selecione uma máquina'); return }

    const amount = form.is_bonificada ? 0 : Number(form.monthly_amount)
    const day = form.is_bonificada ? 1 : Number(form.billing_day)

    if (!form.is_bonificada && (!amount || amount <= 0)) { toast.error('Valor mensal deve ser maior que zero'); return }
    if (!form.is_bonificada && (!day || day < 1 || day > 28)) { toast.error('Dia de cobrança deve ser entre 1 e 28'); return }

    const selectedMachine = machines?.find(m => m.id === form.machine_id)
    const equipmentName = selectedMachine
      ? `${selectedMachine.model} (${selectedMachine.serial_number})`
      : 'Equipamento'

    setLoading(true)
    try {
      const payload = {
        equipment_name: equipmentName,
        monthly_amount: amount,
        billing_day: day,
        start_date: form.start_date,
        end_date: form.end_date || null,
        is_active: form.returned_to_network ? false : form.is_active,
        is_bonificada: form.is_bonificada,
        returned_to_network: form.returned_to_network,
        returned_at: form.returned_at || null,
        notes: form.notes.trim() || null,
        machine_id: form.machine_id || null,
      }
      if (rental) {
        const { error } = await supabase.from('equipment_rentals').update(payload).eq('id', rental.id)
        if (error) throw error
        toast.success('Aluguel atualizado!')
      } else {
        const code = await nextCode(supabase)
        const { error } = await supabase.from('equipment_rentals').insert({
          ...payload, producer_id: pid, equipment_code: code,
        })
        if (error) throw error
        toast.success(`Equipamento cadastrado! Código: ${code}`)
      }
      router.refresh()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Erro ao salvar aluguel')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{rental ? 'Editar Equipamento' : 'Novo Aluguel de Equipamento'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Produtor (standalone) */}
          {standalone && (
            <div className="space-y-2" ref={dropdownRef}>
              <Label>Produtor *</Label>
              <div className="relative">
                <Input
                  value={producerSearch}
                  onChange={e => { setProducerSearch(e.target.value); setSelectedProducerId(''); setShowDropdown(true) }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Digite o nome do produtor..."
                  autoComplete="off"
                />
                {showDropdown && filteredProducers.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredProducers.map(p => (
                      <button key={p.id} type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors"
                        onClick={() => selectProducer(p)}
                      >
                        {p.full_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Máquina */}
          <div className="space-y-2">
            <Label>Máquina *</Label>
            <select
              value={form.machine_id}
              onChange={e => set('machine_id', e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              required
            >
              <option value="">— Selecione uma máquina —</option>
              {(machines ?? []).map(m => (
                <option key={m.id} value={m.id}>
                  {m.serial_number} — {m.model} ({m.operator})
                </option>
              ))}
            </select>
            {(!machines || machines.length === 0) && (
              <p className="text-xs text-amber-600">Cadastre máquinas na aba Máquinas primeiro.</p>
            )}
          </div>

          {/* Bonificada */}
          <label className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-300 cursor-pointer select-none hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={form.is_bonificada}
              onChange={e => handleBonificada(e.target.checked)}
              className="rounded w-4 h-4 accent-blue-600"
            />
            <div>
              <p className="text-sm font-medium text-gray-800">Locação bonificada</p>
              <p className="text-xs text-gray-500">O produtor não paga pelo equipamento — custo zerado, sem cobrança automática</p>
            </div>
          </label>

          {!form.is_bonificada && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor Mensal (R$) *</Label>
                <CurrencyInput
                  value={form.monthly_amount}
                  onValueChange={raw => set('monthly_amount', raw)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Dia de Cobrança (1–28) *</Label>
                <Input
                  type="number" min="1" max="28"
                  value={form.billing_day}
                  onChange={e => set('billing_day', e.target.value)}
                  placeholder="15" required
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Início do Contrato</Label>
              <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fim do Contrato (opcional)</Label>
              <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => set('is_active', e.target.checked)}
              className="rounded"
              disabled={form.returned_to_network}
            />
            Contrato ativo (gera cobrança automática no fim do mês)
          </label>

          {/* Devolvida à Operadora */}
          <div className="space-y-2 pt-1 border-t">
            <label className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-red-200 cursor-pointer select-none hover:bg-red-50 transition-colors">
              <input
                type="checkbox"
                checked={form.returned_to_network}
                onChange={e => {
                  const checked = e.target.checked
                  setForm(prev => ({
                    ...prev,
                    returned_to_network: checked,
                    is_active: checked ? false : prev.is_active,
                    returned_at: checked ? (prev.returned_at || new Date().toISOString().split('T')[0]) : '',
                  }))
                }}
                className="rounded w-4 h-4 accent-red-600"
              />
              <div>
                <p className="text-sm font-medium text-red-700">Máquina devolvida à Operadora</p>
                <p className="text-xs text-red-400">O equipamento saiu do nosso inventário — desativa automaticamente</p>
              </div>
            </label>
            {form.returned_to_network && (
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Data de devolução</Label>
                <Input type="date" value={form.returned_at} onChange={e => set('returned_at', e.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notas do contrato..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : rental ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
