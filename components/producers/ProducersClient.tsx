'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, Users, TrendingUp, TrendingDown, ChevronRight, FileText, Loader2, CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import DateRangePicker from '@/components/shared/DateRangePicker'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/format'
import type { Producer, AccountEntry } from '@/lib/types'
import type { DateRange } from 'react-day-picker'
import ProducerForm from './ProducerForm'

interface ProducerWithBalance {
  producer: Producer
  balance: number
}

interface PeriodPayable {
  producer: Producer
  eventIds: string[]
  payable: number
}

interface Props {
  producers: Producer[]
  entries: Pick<AccountEntry, 'producer_id' | 'event_id' | 'entry_type' | 'amount'>[]
  events: { id: string; producer_id: string; event_date: string; status: string }[]
  paidOrders: { producer_id: string; amount: number }[]
  emittedEventIds: string[]
  userId: string
}

export default function ProducersClient({ producers, entries, events, paidOrders, emittedEventIds, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [emitting, setEmitting] = useState(false)

  const periodActive = !!dateRange?.from
  // Eventos já cobertos por alguma OP existente — não entram no lote
  const emittedSet = useMemo(() => new Set(emittedEventIds), [emittedEventIds])

  // ───── Visão acumulada (comportamento original, inalterado) ─────
  const producersWithBalance = useMemo((): ProducerWithBalance[] => {
    return producers.map(producer => {
      const pe = entries.filter(e => e.producer_id === producer.id)
      const credits = pe.filter(e => e.entry_type === 'credito').reduce((s, e) => s + e.amount, 0)
      const debits = pe.filter(e => e.entry_type === 'debito').reduce((s, e) => s + e.amount, 0)
      const paid = paidOrders.filter(o => o.producer_id === producer.id).reduce((s, o) => s + o.amount, 0)
      return { producer, balance: credits - debits - paid }
    })
  }, [producers, entries, paidOrders])

  const filteredBalance = useMemo(() => {
    if (!search.trim()) return producersWithBalance
    const q = search.toLowerCase()
    return producersWithBalance.filter(({ producer }) =>
      producer.full_name.toLowerCase().includes(q) ||
      producer.email?.toLowerCase().includes(q) ||
      producer.phone?.includes(q)
    )
  }, [producersWithBalance, search])

  const totalToReceive = producersWithBalance.filter(p => p.balance > 0).reduce((s, p) => s + p.balance, 0)
  const totalOwed = producersWithBalance.filter(p => p.balance < 0).reduce((s, p) => s + Math.abs(p.balance), 0)

  // ───── Visão por período (emissão de OP em lote) ─────
  // Só eventos PENDENTES com data no período, somando saldo (créditos − débitos) dos
  // lançamentos vinculados — mesma regra do botão "Emitir OP" da tela do produtor.
  const periodPayables = useMemo((): PeriodPayable[] => {
    if (!periodActive) return []
    const from = dateRange!.from!
    const to = dateRange!.to ?? from
    return producers
      .map(producer => {
        const eventIds = events
          .filter(ev => {
            if (ev.producer_id !== producer.id || ev.status !== 'pending') return false
            if (emittedSet.has(ev.id)) return false // já está em uma OP existente
            const d = new Date(ev.event_date + 'T12:00:00')
            return d >= from && d <= to
          })
          .map(ev => ev.id)
        if (eventIds.length === 0) return { producer, eventIds, payable: 0 }
        const ids = new Set(eventIds)
        const rel = entries.filter(e => e.event_id && ids.has(e.event_id))
        const credits = rel.filter(e => e.entry_type === 'credito').reduce((s, e) => s + e.amount, 0)
        const debits = rel.filter(e => e.entry_type === 'debito').reduce((s, e) => s + e.amount, 0)
        return { producer, eventIds, payable: Math.max(credits - debits, 0) }
      })
      .filter(p => p.payable > 0)
  }, [periodActive, dateRange, producers, events, entries, emittedSet])

  const filteredPeriod = useMemo(() => {
    if (!search.trim()) return periodPayables
    const q = search.toLowerCase()
    return periodPayables.filter(({ producer }) =>
      producer.full_name.toLowerCase().includes(q) ||
      producer.email?.toLowerCase().includes(q) ||
      producer.phone?.includes(q)
    )
  }, [periodPayables, search])

  const toEmit = filteredPeriod.filter(p => !excluded.has(p.producer.id))
  const totalToEmit = toEmit.reduce((s, p) => s + p.payable, 0)

  // Resumo do período (independente da busca) para os cards do topo
  const periodTotal = periodPayables.reduce((s, p) => s + p.payable, 0)
  const periodEventCount = periodPayables.reduce((s, p) => s + p.eventIds.length, 0)

  function toggleExclude(id: string) {
    setExcluded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function emitirLote() {
    if (toEmit.length === 0) { toast.error('Nenhum produtor selecionado'); return }
    if (!confirm(`Emitir ${toEmit.length} ordem(ns) de pagamento — total ${formatCurrency(totalToEmit)}?`)) return

    setEmitting(true)
    try {
      const year = new Date().getFullYear()
      const { count } = await supabase
        .from('payment_orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .like('order_number', `OP-${year}-%`)

      let n = count ?? 0
      const from = dateRange!.from!.toISOString().split('T')[0]
      const to = (dateRange!.to ?? dateRange!.from!).toISOString().split('T')[0]

      const rows = toEmit.map(p => {
        n += 1
        return {
          user_id: userId,
          producer_id: p.producer.id,
          order_number: `OP-${year}-${String(n).padStart(3, '0')}`,
          amount: p.payable,
          status: 'pending' as const,
          event_ids: p.eventIds,
          period_from: from,
          period_to: to,
        }
      })

      const { error } = await supabase.from('payment_orders').insert(rows)
      if (error) { toast.error('Erro ao emitir OPs: ' + error.message); return }

      toast.success(`${rows.length} ordem${rows.length !== 1 ? 's' : ''} de pagamento emitida${rows.length !== 1 ? 's' : ''}`)
      router.push('/dashboard/ordens-pagamento')
    } finally {
      setEmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produtores Culturais</h1>
          <p className="text-gray-500 text-sm mt-1">
            {producers.length} produtor{producers.length !== 1 ? 'es' : ''} cadastrado{producers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Produtor
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{periodActive ? 'Produtores a pagar' : 'Produtores'}</p>
                <p className="text-2xl font-bold text-gray-900">{periodActive ? periodPayables.length : producers.length}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-full">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{periodActive ? 'A Pagar no período' : 'A Pagar'}</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(periodActive ? periodTotal : totalToReceive)}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-full">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              {periodActive ? (
                <>
                  <div>
                    <p className="text-sm text-gray-500">Eventos pendentes</p>
                    <p className="text-2xl font-bold text-blue-600">{periodEventCount}</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-full">
                    <CalendarClock className="h-5 w-5 text-blue-600" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-gray-500">Devendo</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(totalOwed)}</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-full">
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Emissão de OP em lote por período */}
      <Card className={periodActive ? 'border-blue-200 bg-blue-50/40' : ''}>
        <CardContent className="py-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CalendarClock className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Emitir OP em lote</span>
            </div>
            <DateRangePicker value={dateRange} onChange={r => { setDateRange(r); setExcluded(new Set()) }} />
            {periodActive && (
              <>
                <span className="text-sm text-gray-500">
                  {filteredPeriod.length === 0
                    ? 'Nenhum produtor com saldo a pagar no período'
                    : <>{toEmit.length} de {filteredPeriod.length} produtor{filteredPeriod.length !== 1 ? 'es' : ''} · <strong className="text-green-700">{formatCurrency(totalToEmit)}</strong></>}
                </span>
                <Button
                  onClick={emitirLote}
                  disabled={emitting || toEmit.length === 0}
                  className="lg:ml-auto bg-green-600 hover:bg-green-700"
                  size="sm"
                >
                  {emitting
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Emitindo…</>
                    : <><FileText className="h-4 w-4 mr-2" /> Emitir {toEmit.length} OP{toEmit.length !== 1 ? 's' : ''}</>}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por nome, email ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {periodActive ? (
        // ───── Lista filtrada por período (com seleção para o lote) ─────
        filteredPeriod.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <CalendarClock className="h-12 w-12 mx-auto text-gray-300" />
            <p className="text-gray-500 font-medium">Nenhum produtor com evento a pagar neste período</p>
            <p className="text-sm text-gray-400">Ajuste o período ou limpe o filtro para ver todos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPeriod.map(({ producer, eventIds, payable }) => {
              const checked = !excluded.has(producer.id)
              return (
                <Card key={producer.id} className={`h-full transition-shadow ${checked ? 'border-green-200' : 'opacity-60'}`}>
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleExclude(producer.id)}
                        className="mt-1 h-4 w-4 rounded shrink-0"
                        aria-label={`Incluir ${producer.full_name} no lote`}
                      />
                      <div className="flex-1 min-w-0">
                        <Link href={`/dashboard/producers/${producer.id}`} className="font-semibold text-gray-900 truncate hover:underline block">
                          {producer.full_name}
                        </Link>
                        {producer.email && (
                          <p className="text-sm text-gray-500 truncate mt-0.5">{producer.email}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {eventIds.length} evento{eventIds.length !== 1 ? 's' : ''} pendente{eventIds.length !== 1 ? 's' : ''} no período
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t flex items-center justify-between">
                      <span className="text-xs text-gray-400">A pagar no período</span>
                      <span className="text-sm font-bold text-green-600">{formatCurrency(payable)}</span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )
      ) : (
        // ───── Lista acumulada (original, inalterada) ─────
        filteredBalance.length === 0 ? (
          <div className="text-center py-16">
            {producers.length === 0 ? (
              <div className="space-y-2">
                <Users className="h-12 w-12 mx-auto text-gray-300" />
                <p className="text-gray-500 font-medium">Nenhum produtor cadastrado</p>
                <p className="text-sm text-gray-400">Clique em "Novo Produtor" para começar</p>
              </div>
            ) : (
              <p className="text-gray-400">Nenhum resultado para "{search}"</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBalance.map(({ producer, balance }) => (
              <Link key={producer.id} href={`/dashboard/producers/${producer.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{producer.full_name}</p>
                        {producer.email && (
                          <p className="text-sm text-gray-500 truncate mt-0.5">{producer.email}</p>
                        )}
                        {producer.phone && (
                          <p className="text-sm text-gray-500">{producer.phone}</p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                    </div>
                    <div className="mt-4 pt-4 border-t flex items-center justify-between">
                      <span className="text-xs text-gray-400">Saldo</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(Math.abs(balance))}
                        </span>
                        <Badge
                          variant={balance >= 0 ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {balance >= 0 ? 'A pagar' : 'Devendo'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )
      )}

      <ProducerForm open={formOpen} onOpenChange={setFormOpen} producer={null} />
    </div>
  )
}
