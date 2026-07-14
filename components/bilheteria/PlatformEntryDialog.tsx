'use client'

import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  PLATFORM_CATEGORY_LABELS,
  PLATFORM_REVENUE_CATEGORIES,
  PLATFORM_EXPENSE_CATEGORIES,
} from '@/lib/types'
import type { PlatformEntry, PlatformEntryFormData, PlatformCategory, PlatformEntryType } from '@/lib/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: PlatformEntry | null
  onSaved: () => void
}

const today = new Date().toISOString().split('T')[0]

const EMPTY: PlatformEntryFormData = {
  entry_type: 'receita',
  category: 'taxa_evento',
  description: '',
  amount: '',
  date: today,
  event_id: null,
  producer_id: null,
}

export default function PlatformEntryDialog({ open, onOpenChange, entry, onSaved }: Props) {
  const supabase = createClient()
  const [form, setForm] = useState<PlatformEntryFormData>(EMPTY)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (entry) {
      setForm({
        entry_type: entry.entry_type,
        category: entry.category,
        description: entry.description,
        amount: entry.amount,
        date: entry.date,
        event_id: entry.event_id,
        producer_id: entry.producer_id,
      })
    } else {
      setForm(EMPTY)
    }
  }, [entry, open])

  function set<K extends keyof PlatformEntryFormData>(field: K, value: PlatformEntryFormData[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function switchType(type: PlatformEntryType) {
    setForm(prev => ({
      ...prev,
      entry_type: type,
      category: type === 'receita' ? 'taxa_evento' : 'infraestrutura',
    }))
  }

  const categories = form.entry_type === 'receita'
    ? PLATFORM_REVENUE_CATEGORIES
    : PLATFORM_EXPENSE_CATEGORIES

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(form.amount)
    if (!form.description.trim()) { toast.error('Descrição é obrigatória'); return }
    if (!amount || amount <= 0) { toast.error('Valor deve ser maior que zero'); return }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      const payload = {
        entry_type: form.entry_type,
        category: form.category,
        description: form.description.trim(),
        amount,
        date: form.date,
        event_id: form.event_id || null,
        producer_id: form.producer_id || null,
      }

      if (entry) {
        const { error } = await supabase.from('platform_entries').update(payload).eq('id', entry.id)
        if (error) throw error
        toast.success('Lançamento atualizado!')
      } else {
        const { error } = await supabase.from('platform_entries').insert({ ...payload, user_id: user.id })
        if (error) throw error
        toast.success('Lançamento adicionado!')
      }
      onSaved()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Erro ao salvar lançamento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{entry ? 'Editar Lançamento' : 'Novo Lançamento'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => switchType('receita')}
              className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                form.entry_type === 'receita'
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Receita
            </button>
            <button
              type="button"
              onClick={() => switchType('despesa')}
              className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                form.entry_type === 'despesa'
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Despesa
            </button>
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={form.category} onValueChange={v => set('category', v as PlatformCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{PLATFORM_CATEGORY_LABELS[cat]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder={PLATFORM_CATEGORY_LABELS[form.category]}
              required
            />
          </div>

          {/* Valor e Data */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <CurrencyInput
                value={form.amount}
                onValueChange={raw => set('amount', raw)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : entry ? 'Salvar' : 'Lançar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
