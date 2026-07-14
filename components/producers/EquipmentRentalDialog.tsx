'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { EquipmentRental, EquipmentRentalFormData, Producer } from '@/lib/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  producerId: string
  rental: EquipmentRental | null
  producers?: Producer[]
}

const today = new Date().toISOString().split('T')[0]

const EMPTY: EquipmentRentalFormData = {
  equipment_name: '',
  monthly_amount: '',
  billing_day: '',
  start_date: today,
  end_date: '',
  is_active: true,
  notes: '',
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

export default function EquipmentRentalDialog({ open, onOpenChange, producerId, rental, producers }: Props) {
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
        equipment_name: rental.equipment_name,
        monthly_amount: rental.monthly_amount,
        billing_day: rental.billing_day,
        start_date: rental.start_date,
        end_date: rental.end_date ?? '',
        is_active: rental.is_active,
        notes: rental.notes ?? '',
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(form.monthly_amount)
    const day = Number(form.billing_day)
    const pid = standalone ? selectedProducerId : producerId

    if (standalone && !pid) { toast.error('Selecione um produtor'); return }
    if (!form.equipment_name.trim()) { toast.error('Nome do equipamento é obrigatório'); return }
    if (!amount || amount <= 0) { toast.error('Valor mensal deve ser maior que zero'); return }
    if (!day || day < 1 || day > 28) { toast.error('Dia de cobrança deve ser entre 1 e 28'); return }

    setLoading(true)
    try {
      const payload = {
        equipment_name: form.equipment_name.trim(),
        monthly_amount: amount,
        billing_day: day,
        start_date: form.start_date,
        end_date: form.end_date || null,
        is_active: form.is_active,
        notes: form.notes.trim() || null,
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

          {standalone && (
            <div className="space-y-2" ref={dropdownRef}>
              <Label>Produtor *</Label>
              <div className="relative">
                <Input
                  value={producerSearch}
                  onChange={e => {
                    setProducerSearch(e.target.value)
                    setSelectedProducerId('')
                    setShowDropdown(true)
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Digite o nome do produtor..."
                  autoComplete="off"
                />
                {showDropdown && filteredProducers.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredProducers.map(p => (
                      <button
                        key={p.id}
                        type="button"
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

          <div className="space-y-2">
            <Label>Nome do Equipamento *</Label>
            <Input
              value={form.equipment_name}
              onChange={e => set('equipment_name', e.target.value)}
              placeholder="Ex: Som P.A. 5000W"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor Mensal (R$) *</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={form.monthly_amount}
                onChange={e => set('monthly_amount', e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Dia de Cobrança (1–28) *</Label>
              <Input
                type="number"
                min="1"
                max="28"
                value={form.billing_day}
                onChange={e => set('billing_day', e.target.value)}
                placeholder="15"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Início do Contrato</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={e => set('start_date', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fim do Contrato (opcional)</Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={e => set('end_date', e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => set('is_active', e.target.checked)}
              className="rounded"
            />
            Contrato ativo (gera cobrança automática no fim do mês)
          </label>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Input
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Notas do contrato..."
            />
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
