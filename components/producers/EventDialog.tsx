'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { ProducerEvent, EventFormData, EventStatus } from '@/lib/types'
import ProducerSplitSection, { type ProducerSplitItem } from './ProducerSplitSection'
import { Ticket } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  producerId: string
  event: ProducerEvent | null
}

const today = new Date().toISOString().split('T')[0]

const EMPTY: EventFormData = {
  name: '',
  event_date: today,
  gross_revenue: 0,
  platform_fee: 0,
  net_amount: 0,
  status: 'pending',
  notes: '',
}

export default function EventDialog({ open, onOpenChange, producerId, event }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState<EventFormData>(EMPTY)
  const [feePercent, setFeePercent] = useState<string>('')
  const [autoEntry, setAutoEntry] = useState(true)
  const [registerPlatformFee, setRegisterPlatformFee] = useState(true)

  // Rateio entre produtores
  const [producerSplits, setProducerSplits] = useState<ProducerSplitItem[]>([])
  const [autoCreateSplits, setAutoCreateSplits] = useState(true)

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (event) {
      setForm({
        name: event.name,
        event_date: event.event_date,
        gross_revenue: event.gross_revenue,
        platform_fee: event.platform_fee,
        net_amount: event.net_amount,
        status: event.status,
        notes: event.notes ?? '',
      })
      if (event.gross_revenue > 0 && event.platform_fee > 0) {
        const pct = (event.platform_fee / event.gross_revenue) * 100
        setFeePercent(Number.isInteger(pct) ? String(pct) : pct.toFixed(2))
      } else {
        setFeePercent('')
      }
    } else {
      setForm(EMPTY)
      setFeePercent('')
      setAutoEntry(true)
      setRegisterPlatformFee(false)
    }
    setProducerSplits([])
    setAutoCreateSplits(true)
  }, [event, open])

  function set<K extends keyof EventFormData>(field: K, value: EventFormData[K]) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      const gross = field === 'gross_revenue' ? Number(value) : Number(prev.gross_revenue)
      const pct = Number(feePercent)

      if (field === 'gross_revenue' && pct > 0) {
        const fee = Math.round((gross * pct / 100) * 100) / 100
        next.platform_fee = fee
        next.net_amount = Math.max(0, gross - fee)
      } else if (field === 'platform_fee') {
        next.net_amount = Math.max(0, gross - Number(value))
        setFeePercent('')
      } else if (field === 'gross_revenue') {
        next.net_amount = Math.max(0, gross - Number(prev.platform_fee))
      }
      return next
    })
  }

  function handleFeePercent(raw: string) {
    setFeePercent(raw)
    const pct = Number(raw)
    if (!isNaN(pct) && pct >= 0 && pct <= 100) {
      const gross = Number(form.gross_revenue)
      const fee = Math.round((gross * pct / 100) * 100) / 100
      setForm(prev => ({
        ...prev,
        platform_fee: fee,
        net_amount: Math.max(0, gross - fee),
      }))
    }
  }

  const netAmount = Number(form.net_amount)
  const totalOtherPct = producerSplits.reduce((s, x) => s + Number(x.percent || 0), 0)
  const currentPct = Math.max(0, 100 - totalOtherPct)
  const currentAmount = (netAmount * currentPct) / 100
  const hasProducerSplits = producerSplits.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Nome do evento é obrigatório'); return }
    if (totalOtherPct > 100) { toast.error('Total do rateio ultrapassa 100%'); return }

    setLoading(true)
    try {
      const payload = {
        name: form.name.trim(),
        event_date: form.event_date,
        gross_revenue: Number(form.gross_revenue),
        platform_fee: Number(form.platform_fee),
        net_amount: netAmount,
        status: form.status,
        notes: form.notes.trim() || null,
      }

      if (event) {
        const { error } = await supabase.from('events').update(payload).eq('id', event.id)
        if (error) throw error
      } else {
        const { data: newEvent, error } = await supabase
          .from('events')
          .insert({ ...payload, producer_id: producerId })
          .select()
          .single()
        if (error) throw error

        // Lançamento para o produtor desta conta
        if (autoEntry && netAmount > 0) {
          const thisAmount = hasProducerSplits
            ? Math.round((netAmount * currentPct / 100) * 100) / 100
            : netAmount

          if (thisAmount > 0) {
            await supabase.from('account_entries').insert({
              producer_id: producerId,
              event_id: newEvent.id,
              entry_type: 'credito',
              category: 'venda_evento',
              description: `Venda de ingresso — ${payload.name}`,
              amount: thisAmount,
              date: payload.event_date,
            })
          }
        }

        // Lançamentos para produtores no rateio
        if (autoCreateSplits && hasProducerSplits) {
          const splitInserts = producerSplits
            .filter(s => s.producer_id && Number(s.percent) > 0)
            .map(s => ({
              producer_id: s.producer_id,
              event_id: newEvent.id,
              entry_type: 'credito' as const,
              category: 'venda_evento' as const,
              description: `Venda de ingresso — ${payload.name}`,
              amount: Math.round((netAmount * Number(s.percent) / 100) * 100) / 100,
              date: payload.event_date,
            }))
          if (splitInserts.length > 0) {
            const { error } = await supabase.from('account_entries').insert(splitInserts)
            if (error) throw error
          }
        }

        // Fechar dialog e atualizar página ANTES do insert da Bilheteria
        // para que uma falha na tabela platform_entries não bloqueie o fluxo
        toast.success('Evento cadastrado!')
        router.refresh()
        onOpenChange(false)

        // Registrar taxa na Bilheteria Express (não-fatal)
        if (registerPlatformFee && payload.platform_fee > 0) {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { error: pfError } = await supabase.from('platform_entries').insert({
              user_id: user.id,
              entry_type: 'receita',
              category: 'taxa_evento',
              description: `Taxa de evento — ${payload.name}`,
              amount: payload.platform_fee,
              date: payload.event_date,
              event_id: newEvent.id,
              producer_id: producerId,
            })
            if (pfError) {
              toast.warning('Evento salvo! Mas a taxa não foi para a Bilheteria Express. Execute o SQL da tabela platform_entries no Supabase.')
            }
          }
        }
        return
      }
      // Edição de evento
      toast.success('Evento atualizado!')
      router.refresh()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Erro ao salvar evento')
    } finally {
      setLoading(false)
    }
  }

  const feeDisplay = Number(form.platform_fee)
  const grossDisplay = Number(form.gross_revenue)
  const pctDisplay = grossDisplay > 0 && feeDisplay > 0
    ? ((feeDisplay / grossDisplay) * 100).toFixed(2).replace(/\.?0+$/, '')
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Evento *</Label>
            <Input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Ex: Show do João Silva"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data do Evento</Label>
              <Input type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v as EventStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="settled">Liquidado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Split de plataforma */}
          <div className="space-y-3 rounded-lg border border-gray-200 p-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Split de pagamento</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Bruto (R$)</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={form.gross_revenue || ''}
                  onChange={e => set('gross_revenue', Number(e.target.value))}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">% da Plataforma</Label>
                <Input
                  type="number" min="0" max="100" step="0.01"
                  value={feePercent}
                  onChange={e => handleFeePercent(e.target.value)}
                  placeholder="Ex: 10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Taxa (R$)</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={form.platform_fee || ''}
                  onChange={e => set('platform_fee', Number(e.target.value))}
                  placeholder="0,00"
                  className="text-red-600"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Líquido (R$)</Label>
                <div className="relative">
                  <Input
                    type="number" min="0" step="0.01"
                    value={form.net_amount || ''}
                    onChange={e => set('net_amount', Number(e.target.value))}
                    placeholder="0,00"
                    className="font-semibold text-green-700 pr-14"
                  />
                  {pctDisplay && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                      {pctDisplay}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {grossDisplay > 0 && netAmount > 0 && (
              <div className="flex justify-between text-xs text-gray-500 bg-gray-50 rounded px-2.5 py-1.5">
                <span>Plataforma fica: <span className="font-medium text-red-600">R$ {feeDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></span>
                <span>Líquido total: <span className="font-medium text-green-700">R$ {netAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></span>
              </div>
            )}
          </div>

          {/* Rateio entre produtores */}
          {netAmount > 0 && (
            <ProducerSplitSection
              netAmount={netAmount}
              currentProducerId={producerId}
              splits={producerSplits}
              onChange={setProducerSplits}
              autoCreate={autoCreateSplits}
              onAutoCreateChange={setAutoCreateSplits}
            />
          )}

          {/* Aviso do valor que será lançado nesta conta quando há rateio */}
          {hasProducerSplits && netAmount > 0 && currentPct > 0 && (
            <div className="text-sm rounded bg-green-50 border border-green-200 px-3 py-2 text-green-700">
              Será lançado nesta conta:{' '}
              <span className="font-semibold">
                R$ {currentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-green-600 ml-1">({currentPct}%)</span>
            </div>
          )}

          <div className="space-y-2">
            <Label>Observações</Label>
            <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notas opcionais..." />
          </div>

          {!event && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoEntry}
                  onChange={e => setAutoEntry(e.target.checked)}
                  className="rounded"
                />
                Criar lançamento de crédito automático (valor líquido)
              </label>
              {Number(form.platform_fee) > 0 && (
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={registerPlatformFee}
                    onChange={e => setRegisterPlatformFee(e.target.checked)}
                    className="rounded"
                  />
                  <Ticket className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                  Registrar taxa (R$ {Number(form.platform_fee).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) na Bilheteria Express
                </label>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : event ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
