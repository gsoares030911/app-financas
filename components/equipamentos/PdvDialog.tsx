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
import type { PdvLocation, PdvLocationFormData, Machine } from '@/lib/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  pdv: PdvLocation | null
  machines?: Machine[]
}

const today = new Date().toISOString().split('T')[0]

const EMPTY: PdvLocationFormData = {
  name: '',
  store_name: '',
  address: '',
  phone: '',
  monthly_cost: '',
  billing_day: '1',
  is_bonificada: false,
  is_active: true,
  returned_to_network: false,
  returned_at: '',
  notes: '',
  machine_id: '',
}

export default function PdvDialog({ open, onOpenChange, pdv, machines }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState<PdvLocationFormData>(EMPTY)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (pdv) {
      setForm({
        name: pdv.name,
        store_name: pdv.store_name,
        address: pdv.address ?? '',
        phone: pdv.phone ?? '',
        monthly_cost: pdv.monthly_cost,
        billing_day: pdv.billing_day,
        is_bonificada: pdv.is_bonificada,
        is_active: pdv.is_active,
        returned_to_network: pdv.returned_to_network,
        returned_at: pdv.returned_at ?? '',
        notes: pdv.notes ?? '',
        machine_id: pdv.machine_id ?? '',
      })
    } else {
      setForm(EMPTY)
    }
  }, [pdv, open])

  function set<K extends keyof PdvLocationFormData>(field: K, value: PdvLocationFormData[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleBonificada(checked: boolean) {
    setForm(prev => ({
      ...prev,
      is_bonificada: checked,
      monthly_cost: checked ? 0 : '',
    }))
  }

  function handleReturnedToNetwork(checked: boolean) {
    setForm(prev => ({
      ...prev,
      returned_to_network: checked,
      is_active: checked ? false : prev.is_active,
      returned_at: checked ? (prev.returned_at || new Date().toISOString().split('T')[0]) : '',
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Nome do PDV é obrigatório'); return }
    if (!form.store_name.trim()) { toast.error('Nome da loja é obrigatório'); return }

    const cost = form.is_bonificada ? 0 : Number(form.monthly_cost)
    const day = Number(form.billing_day)

    if (!form.is_bonificada && (!cost || cost < 0)) {
      toast.error('Informe o custo mensal'); return
    }
    if (!day || day < 1 || day > 28) {
      toast.error('Dia de cobrança deve ser entre 1 e 28'); return
    }

    setLoading(true)
    try {
      const payload = {
        name: form.name.trim(),
        store_name: form.store_name.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        monthly_cost: cost,
        billing_day: day,
        is_bonificada: form.is_bonificada,
        is_active: form.returned_to_network ? false : form.is_active,
        returned_to_network: form.returned_to_network,
        returned_at: form.returned_at || null,
        notes: form.notes.trim() || null,
        machine_id: form.machine_id || null,
      }

      if (pdv) {
        const { error } = await supabase.from('pdv_locations').update(payload).eq('id', pdv.id)
        if (error) throw error
        toast.success('PDV atualizado!')
      } else {
        const { error } = await supabase.from('pdv_locations').insert(payload)
        if (error) throw error
        toast.success('PDV cadastrado!')
      }
      router.refresh()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Erro ao salvar PDV')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pdv ? 'Editar Ponto de Venda' : 'Novo Ponto de Venda'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nome do PDV *</Label>
              <Input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Ex: PDV Iguatemi"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Loja Parceira *</Label>
              <Input
                value={form.store_name}
                onChange={e => set('store_name', e.target.value)}
                placeholder="Ex: Livraria Cultura"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Endereço</Label>
            <Input
              value={form.address}
              onChange={e => set('address', e.target.value)}
              placeholder="Ex: Av. Brigadeiro Faria Lima, 2232 — Loja 42"
            />
          </div>

          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="Ex: (11) 99999-9999"
              type="tel"
            />
          </div>

          {/* Bonificada toggle */}
          <label className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-300 cursor-pointer select-none hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={form.is_bonificada}
              onChange={e => handleBonificada(e.target.checked)}
              className="rounded w-4 h-4 accent-blue-600"
            />
            <div>
              <p className="text-sm font-medium text-gray-800">Locação bonificada</p>
              <p className="text-xs text-gray-500">A loja não cobra pelo espaço — custo zerado automaticamente</p>
            </div>
          </label>

          {!form.is_bonificada && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Custo Mensal (R$) *</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.monthly_cost}
                  onChange={e => set('monthly_cost', e.target.value)}
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
                  placeholder="1"
                  required
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)}
                className="rounded"
                disabled={form.returned_to_network}
              />
              PDV ativo
            </label>
          </div>

          {/* Devolvida à Rede */}
          <div className="space-y-2 pt-1 border-t">
            <label className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-red-200 cursor-pointer select-none hover:bg-red-50 transition-colors">
              <input
                type="checkbox"
                checked={form.returned_to_network}
                onChange={e => handleReturnedToNetwork(e.target.checked)}
                className="rounded w-4 h-4 accent-red-600"
              />
              <div>
                <p className="text-sm font-medium text-red-700">Máquina devolvida à Operadora</p>
                <p className="text-xs text-red-400">O equipamento não está mais em nosso poder — desativa automaticamente</p>
              </div>
            </label>
            {form.returned_to_network && (
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Data de devolução</Label>
                <Input
                  type="date"
                  value={form.returned_at}
                  onChange={e => set('returned_at', e.target.value)}
                />
              </div>
            )}
          </div>

          {machines && machines.length > 0 && (
            <div className="space-y-2">
              <Label>Máquina (opcional)</Label>
              <select
                value={form.machine_id}
                onChange={e => set('machine_id', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Sem máquina vinculada —</option>
                {machines.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.serial_number} — {m.model} ({m.operator})
                  </option>
                ))}
              </select>
            </div>
          )}

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
              {loading ? 'Salvando...' : pdv ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
