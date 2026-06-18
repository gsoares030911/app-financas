'use client'

import { useEffect, useState } from 'react'
import { Transaction, TransactionFormData, CATEGORIES, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '@/lib/types'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSave: (data: TransactionFormData) => Promise<void>
  editingTransaction: Transaction | null
}

const today = new Date().toISOString().split('T')[0]

const defaultForm: TransactionFormData = {
  description: '',
  amount: 0,
  date: today,
  type: 'despesa',
  category: 'Outros',
}

export default function TransactionDialog({ open, onOpenChange, onSave, editingTransaction }: Props) {
  const [form, setForm] = useState<TransactionFormData>(defaultForm)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (editingTransaction) {
      setForm({
        description: editingTransaction.description,
        amount: editingTransaction.amount,
        date: editingTransaction.date,
        type: editingTransaction.type,
        category: editingTransaction.category,
      })
    } else {
      setForm(defaultForm)
    }
  }, [editingTransaction, open])

  const availableCategories = form.type === 'receita' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  function handleTypeChange(type: 'receita' | 'despesa') {
    const cats = type === 'receita' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    setForm((prev) => ({
      ...prev,
      type,
      category: cats.includes(prev.category as never) ? prev.category : cats[0],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description.trim()) return
    if (form.amount <= 0) return
    setLoading(true)
    await onSave(form)
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingTransaction ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleTypeChange('despesa')}
              className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                form.type === 'despesa'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('receita')}
              className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                form.type === 'receita'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              Receita
            </button>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Ex: Supermercado, Salário..."
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              required
            />
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={form.amount || ''}
              onChange={(e) => setForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
              required
            />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((p) => ({ ...p, category: v as never }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : editingTransaction ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
