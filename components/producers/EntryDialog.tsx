'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  CATEGORY_LABELS, CREDIT_CATEGORIES, DEBIT_CATEGORIES, SYSTEM_CATEGORIES,
} from '@/lib/types'
import type {
  AccountEntry, AccountEntryFormData, AccountEntryCategory, EntryType,
  ProducerEvent, EquipmentRental, Category,
} from '@/lib/types'
import ProducerSplitSection, { type ProducerSplitItem } from './ProducerSplitSection'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  producerId: string
  entry: AccountEntry | null
  events: ProducerEvent[]
  rentals: EquipmentRental[]
  categories?: Category[]
}

const today = new Date().toISOString().split('T')[0]

const EMPTY: AccountEntryFormData = {
  entry_type: 'debito',
  category: 'adiantamento',
  description: '',
  amount: '',
  date: today,
  event_id: null,
  equipment_rental_id: null,
  reference_month: null,
}

export default function EntryDialog({ open, onOpenChange, producerId, entry, events, rentals, categories: propCategories }: Props) {
  const allCats = propCategories ?? SYSTEM_CATEGORIES.map(c => ({ ...c, id: c.slug, user_id: '', created_at: '' }))
  const activeCats = allCats.filter(c => c.is_active)
  const dynLabels: Record<string, string> = Object.fromEntries(activeCats.map(c => [c.slug, c.name]))
  const dynCredit = activeCats.filter(c => c.entry_type === 'credito' || c.entry_type === 'ambos').map(c => c.slug)
  const dynDebit  = activeCats.filter(c => c.entry_type === 'debito'  || c.entry_type === 'ambos').map(c => c.slug)
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState<AccountEntryFormData>(EMPTY)
  const [loading, setLoading] = useState(false)

  // Split de plataforma
  const [splitMode, setSplitMode] = useState(false)
  const [splitGross, setSplitGross] = useState('')
  const [splitPercent, setSplitPercent] = useState('')
  const [splitFee, setSplitFee] = useState(0)

  // Rateio entre produtores
  const [producerSplits, setProducerSplits] = useState<ProducerSplitItem[]>([])
  const [autoCreateSplits, setAutoCreateSplits] = useState(true)

  useEffect(() => {
    if (entry) {
      setForm({
        entry_type: entry.entry_type,
        category: entry.category,
        description: entry.description,
        amount: entry.amount,
        date: entry.date,
        event_id: entry.event_id,
        equipment_rental_id: entry.equipment_rental_id,
        reference_month: entry.reference_month,
      })
    } else {
      setForm(EMPTY)
    }
    setSplitMode(false)
    setSplitGross('')
    setSplitPercent('')
    setSplitFee(0)
    setProducerSplits([])
    setAutoCreateSplits(true)
  }, [entry, open])

  function set<K extends keyof AccountEntryFormData>(field: K, value: AccountEntryFormData[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function switchType(type: EntryType) {
    setForm(prev => ({
      ...prev,
      entry_type: type,
      category: type === 'credito' ? 'venda_evento' : 'adiantamento',
    }))
    setSplitMode(false)
    setProducerSplits([])
  }

  function handleSplitGross(raw: string) {
    setSplitGross(raw)
    recalcSplit(raw, splitPercent)
  }

  function handleSplitPercent(raw: string) {
    setSplitPercent(raw)
    recalcSplit(splitGross, raw)
  }

  function recalcSplit(grossRaw: string, pctRaw: string) {
    const gross = Number(grossRaw)
    const pct = Number(pctRaw)
    if (!isNaN(gross) && !isNaN(pct) && gross > 0 && pct >= 0 && pct <= 100) {
      const fee = Math.round((gross * pct / 100) * 100) / 100
      const net = Math.round((gross - fee) * 100) / 100
      setSplitFee(fee)
      setForm(prev => ({ ...prev, amount: net > 0 ? net : '' }))
    } else {
      setSplitFee(0)
      setForm(prev => ({ ...prev, amount: '' }))
    }
  }

  const categories = form.entry_type === 'credito' ? dynCredit : dynDebit
  const isSplitEligible = form.entry_type === 'credito' && form.category === 'venda_evento'
  const netAmount = Number(form.amount) || 0
  const totalOtherPct = producerSplits.reduce((s, x) => s + Number(x.percent || 0), 0)
  const currentPct = Math.max(0, 100 - totalOtherPct)
  const currentAmount = (netAmount * currentPct) / 100
  const hasProducerSplits = producerSplits.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const net = Number(form.amount)
    if (!form.description.trim()) { toast.error('Descrição é obrigatória'); return }
    if (!net || net <= 0) { toast.error('Valor deve ser maior que zero'); return }
    if (totalOtherPct > 100) { toast.error('Total do rateio ultrapassa 100%'); return }

    // Valor desta conta = net * currentPct / 100 se houver rateio, caso contrário net inteiro
    const thisAmount = hasProducerSplits
      ? Math.round((net * currentPct / 100) * 100) / 100
      : net

    if (hasProducerSplits && thisAmount <= 0) {
      toast.error('O produtor desta conta ficaria com R$ 0. Ajuste os percentuais.')
      return
    }

    setLoading(true)
    try {
      const payload = {
        entry_type: form.entry_type,
        category: form.category,
        description: form.description.trim(),
        amount: thisAmount,
        date: form.date,
        event_id: form.event_id || null,
        equipment_rental_id: form.equipment_rental_id || null,
        reference_month: form.reference_month || null,
      }

      if (entry) {
        const { error } = await supabase.from('account_entries').update(payload).eq('id', entry.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('account_entries').insert({ ...payload, producer_id: producerId })
        if (error) throw error
      }

      // Criar lançamentos para produtores no rateio
      if (!entry && autoCreateSplits && hasProducerSplits) {
        const splitInserts = producerSplits
          .filter(s => s.producer_id && Number(s.percent) > 0)
          .map(s => ({
            producer_id: s.producer_id,
            entry_type: 'credito' as const,
            category: form.category,
            description: form.description.trim(),
            amount: Math.round((net * Number(s.percent) / 100) * 100) / 100,
            date: form.date,
            event_id: form.event_id || null,
          }))
        if (splitInserts.length > 0) {
          const { error } = await supabase.from('account_entries').insert(splitInserts)
          if (error) throw error
        }
      }

      toast.success(entry ? 'Lançamento atualizado!' : 'Lançamento adicionado!')
      router.refresh()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Erro ao salvar lançamento')
    } finally {
      setLoading(false)
    }
  }

  const gross = Number(splitGross)
  const net = netAmount

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry ? 'Editar Lançamento' : 'Novo Lançamento'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => switchType('debito')}
              className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                form.entry_type === 'debito'
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Débito (Saída)
            </button>
            <button
              type="button"
              onClick={() => switchType('credito')}
              className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                form.entry_type === 'credito'
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Crédito (Entrada)
            </button>
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={form.category} onValueChange={v => {
              set('category', v as AccountEntryCategory)
              setSplitMode(false)
              setProducerSplits([])
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{dynLabels[cat] ?? cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Toggle split de plataforma */}
          {isSplitEligible && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={splitMode}
                onChange={e => {
                  setSplitMode(e.target.checked)
                  if (!e.target.checked) {
                    setSplitGross('')
                    setSplitPercent('')
                    setSplitFee(0)
                    set('amount', '')
                  }
                }}
                className="rounded"
              />
              Calcular por split (bruto − % plataforma)
            </label>
          )}

          {/* Calculadora de split de plataforma */}
          {isSplitEligible && splitMode && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 space-y-3">
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Split de pagamento</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Valor Bruto (R$)</Label>
                  <CurrencyInput
                    value={splitGross}
                    onValueChange={raw => handleSplitGross(raw)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">% da Plataforma</Label>
                  <Input
                    type="number" min="0" max="100" step="0.01"
                    value={splitPercent}
                    onChange={e => handleSplitPercent(e.target.value)}
                    placeholder="Ex: 10"
                  />
                </div>
              </div>

              {gross > 0 && Number(splitPercent) > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs rounded bg-white border border-blue-100 px-3 py-2">
                    <span className="text-gray-500">Taxa da plataforma</span>
                    <span className="font-medium text-red-600">
                      − R$ {splitFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm rounded bg-white border border-green-200 px-3 py-2">
                    <span className="font-medium text-gray-700">Líquido (base do rateio)</span>
                    <span className="font-semibold text-green-700">
                      R$ {net > 0 ? net.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Seletor de evento */}
          {form.category === 'venda_evento' && events.length > 0 && (
            <div className="space-y-2">
              <Label>Evento (opcional)</Label>
              <Select
                value={form.event_id ?? 'none'}
                onValueChange={v => set('event_id', v === 'none' ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar evento..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem evento específico</SelectItem>
                  {events.map(ev => (
                    <SelectItem key={ev.id} value={ev.id}>{ev.name} — {ev.event_date}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Seletor de equipamento */}
          {form.category === 'aluguel_equipamento' && (
            <>
              {rentals.length > 0 && (
                <div className="space-y-2">
                  <Label>Equipamento (opcional)</Label>
                  <Select
                    value={form.equipment_rental_id ?? 'none'}
                    onValueChange={v => set('equipment_rental_id', v === 'none' ? null : v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecionar equipamento..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem equipamento específico</SelectItem>
                      {rentals.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.equipment_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Mês de Referência</Label>
                <Input
                  type="month"
                  value={form.reference_month ?? ''}
                  onChange={e => set('reference_month', e.target.value || null)}
                />
              </div>
            </>
          )}

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder={CATEGORY_LABELS[form.category]}
              required
            />
          </div>

          {/* Valor e Data */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{splitMode ? 'Valor Líquido (R$)' : 'Valor (R$) *'}</Label>
              <CurrencyInput
                value={form.amount}
                onValueChange={raw => !splitMode && set('amount', raw)}
                readOnly={splitMode}
                className={splitMode ? 'bg-gray-50 font-semibold text-green-700 cursor-not-allowed' : ''}
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

          {/* Rateio entre produtores — disponível para créditos */}
          {isSplitEligible && net > 0 && (
            <ProducerSplitSection
              netAmount={net}
              currentProducerId={producerId}
              splits={producerSplits}
              onChange={setProducerSplits}
              autoCreate={autoCreateSplits}
              onAutoCreateChange={setAutoCreateSplits}
            />
          )}

          {/* Aviso do valor que será lançado nesta conta quando há rateio */}
          {hasProducerSplits && net > 0 && currentPct > 0 && (
            <div className="text-sm rounded bg-green-50 border border-green-200 px-3 py-2 text-green-700">
              Será lançado nesta conta:{' '}
              <span className="font-semibold">
                R$ {currentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-green-600 ml-1">({currentPct}%)</span>
            </div>
          )}

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
