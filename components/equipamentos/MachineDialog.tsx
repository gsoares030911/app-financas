'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Machine, MachineFormData } from '@/lib/types'

const OPERATORS = ['Cielo', 'Stone', 'Rede', 'PagSeguro', 'GetNet', 'Mercado Pago', 'SafraPay', 'Bin']

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  machine: Machine | null
}

const EMPTY: MachineFormData = {
  serial_number: '',
  model: '',
  operator: '',
  received_at: '',
  notes: '',
}

export default function MachineDialog({ open, onOpenChange, machine }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState<MachineFormData>(EMPTY)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (machine) {
      setForm({
        serial_number: machine.serial_number,
        model: machine.model,
        operator: machine.operator,
        received_at: machine.received_at ?? '',
        notes: machine.notes ?? '',
      })
    } else {
      setForm(EMPTY)
    }
  }, [machine, open])

  function set<K extends keyof MachineFormData>(field: K, value: MachineFormData[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.serial_number.trim()) { toast.error('Nº de série é obrigatório'); return }
    if (!form.model.trim()) { toast.error('Modelo é obrigatório'); return }
    if (!form.operator.trim()) { toast.error('Operadora é obrigatória'); return }

    setLoading(true)
    try {
      const payload = {
        serial_number: form.serial_number.trim().toUpperCase(),
        model: form.model.trim(),
        operator: form.operator.trim(),
        received_at: form.received_at || null,
        notes: form.notes.trim() || null,
      }
      if (machine) {
        const { error } = await supabase.from('machines').update(payload).eq('id', machine.id)
        if (error) throw error
        toast.success('Máquina atualizada!')
      } else {
        const { error } = await supabase.from('machines').insert(payload)
        if (error) throw error
        toast.success('Máquina cadastrada!')
      }
      router.refresh()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Erro ao salvar máquina')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{machine ? 'Editar Máquina' : 'Nova Máquina'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="space-y-2">
            <Label>Nº de Série *</Label>
            <Input
              value={form.serial_number}
              onChange={e => set('serial_number', e.target.value)}
              placeholder="Ex: SN-001234"
              autoComplete="off"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Modelo *</Label>
              <Input
                value={form.model}
                onChange={e => set('model', e.target.value)}
                placeholder="Ex: POS V3"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Operadora *</Label>
              <Input
                list="operators-list"
                value={form.operator}
                onChange={e => set('operator', e.target.value)}
                placeholder="Ex: Cielo"
                required
              />
              <datalist id="operators-list">
                {OPERATORS.map(op => <option key={op} value={op} />)}
              </datalist>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Data de recebimento</Label>
            <Input
              type="date"
              value={form.received_at}
              onChange={e => set('received_at', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Input
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Notas adicionais..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : machine ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
