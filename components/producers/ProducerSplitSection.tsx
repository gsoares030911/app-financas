'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Building2, Hash, AlertTriangle } from 'lucide-react'
import type { Producer } from '@/lib/types'

export interface ProducerSplitItem {
  uid: string
  producer_id: string
  percent: string
}

interface Props {
  netAmount: number
  currentProducerId: string
  splits: ProducerSplitItem[]
  onChange: (splits: ProducerSplitItem[]) => void
  autoCreate: boolean
  onAutoCreateChange: (v: boolean) => void
}

export default function ProducerSplitSection({
  netAmount,
  currentProducerId,
  splits,
  onChange,
  autoCreate,
  onAutoCreateChange,
}: Props) {
  const [producers, setProducers] = useState<Producer[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('producers')
      .select('*')
      .neq('id', currentProducerId)
      .order('full_name')
      .then(({ data }) => setProducers(data ?? []))
  }, [currentProducerId]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalOtherPct = splits.reduce((s, x) => s + Number(x.percent || 0), 0)
  const currentPct = Math.max(0, 100 - totalOtherPct)
  const currentAmount = (netAmount * currentPct) / 100
  const overLimit = totalOtherPct > 100

  function add() {
    onChange([...splits, { uid: crypto.randomUUID(), producer_id: '', percent: '' }])
  }

  function update(uid: string, field: 'producer_id' | 'percent', value: string) {
    onChange(splits.map(s => s.uid === uid ? { ...s, [field]: value } : s))
  }

  function remove(uid: string) {
    onChange(splits.filter(s => s.uid !== uid))
  }

  function getProducer(id: string) {
    return producers.find(p => p.id === id)
  }

  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  const fmtPct = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')

  return (
    <div className="space-y-3 rounded-lg border border-purple-100 bg-purple-50/30 p-3">
      <p className="text-xs font-medium text-purple-600 uppercase tracking-wide">
        Rateio entre produtores
      </p>

      {splits.map(split => {
        const pct = Number(split.percent || 0)
        const amount = (netAmount * pct) / 100
        const p = split.producer_id ? getProducer(split.producer_id) : null

        return (
          <div key={split.uid} className="rounded-md border border-purple-100 bg-white p-3 space-y-2">
            {/* Linha: produtor + % + lixeira */}
            <div className="flex items-center gap-2">
              <Select
                value={split.producer_id || 'none'}
                onValueChange={v => update(split.uid, 'producer_id', v === 'none' ? '' : (v ?? ''))}
              >
                <SelectTrigger className="flex-1 text-sm">
                  <SelectValue placeholder="Selecionar produtor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>Selecionar produtor...</SelectItem>
                  {producers.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative w-24 flex-shrink-0">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={split.percent}
                  onChange={e => update(split.uid, 'percent', e.target.value)}
                  placeholder="0"
                  className="pr-6 text-right"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">%</span>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                onClick={() => remove(split.uid)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Valor calculado */}
            {pct > 0 && netAmount > 0 && (
              <div className="text-sm font-semibold text-purple-700 px-1">
                = R$ {fmt(amount)}
              </div>
            )}

            {/* Dados bancários do produtor selecionado */}
            {p && (
              <div className="text-xs text-gray-500 space-y-1 px-1 pt-1 border-t border-gray-100">
                {p.pix_key ? (
                  <div className="flex items-center gap-1.5">
                    <Hash className="h-3 w-3 text-gray-400 flex-shrink-0" />
                    <span className="truncate">PIX: <span className="font-medium text-gray-700">{p.pix_key}</span></span>
                  </div>
                ) : null}
                {p.bank_name ? (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3 w-3 text-gray-400 flex-shrink-0" />
                    <span className="truncate">
                      <span className="font-medium text-gray-700">{p.bank_name}</span>
                      {p.bank_agency && <span> · Ag {p.bank_agency}</span>}
                      {p.bank_account && <span> · CC {p.bank_account}</span>}
                    </span>
                  </div>
                ) : null}
                {!p.pix_key && !p.bank_name && (
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                    <span>Sem dados bancários cadastrados</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Resumo: produtor atual */}
      {splits.length > 0 && (
        <div className={`flex justify-between text-xs rounded px-2.5 py-2 ${
          overLimit
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-white border border-purple-100 text-gray-600'
        }`}>
          <span>Produtor desta conta fica com</span>
          <span className={`font-semibold ${overLimit ? 'text-red-700' : 'text-green-700'}`}>
            {fmtPct(currentPct)}%
            {netAmount > 0 && !overLimit && ` = R$ ${fmt(currentAmount)}`}
            {overLimit && ' ← percentual inválido'}
          </span>
        </div>
      )}

      {overLimit && (
        <p className="text-xs text-red-600 px-1 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Total dos outros produtores ultrapassa 100%.
        </p>
      )}

      <Button type="button" variant="outline" size="sm" onClick={add} className="w-full text-purple-700 border-purple-200 hover:bg-purple-50">
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Adicionar produtor no rateio
      </Button>

      {splits.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoCreate}
            onChange={e => onAutoCreateChange(e.target.checked)}
            className="rounded"
          />
          Criar lançamento automático nas contas de cada produtor rateado
        </label>
      )}
    </div>
  )
}
