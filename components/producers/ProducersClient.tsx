'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, Users, TrendingUp, TrendingDown, ChevronRight, FileText, Loader2, CalendarClock, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import DateRangePicker from '@/components/shared/DateRangePicker'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/format'
import type { Producer, AccountEntry } from '@/lib/types'
import type { DateRange } from 'react-day-picker'
import ProducerForm from './ProducerForm'
import * as XLSX from 'xlsx'

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
  events: { id: string; producer_id: string; event_date: string; billing_from: string | null; status: string }[]
  paidOrders: { producer_id: string; amount: number }[]
  emittedEventIds: string[]
  userId: string
}

type BalanceFilter = 'todos' | 'a_pagar' | 'devendo' | 'zerado'

export default function ProducersClient({ producers, entries, events, paidOrders, emittedEventIds, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('todos')
  const [formOpen, setFormOpen] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [emitting, setEmitting] = useState(false)
  const [importingProducers, setImportingProducers] = useState(false)
  const importProducerRef = useRef<HTMLInputElement>(null)

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
    const q = search.toLowerCase()
    return producersWithBalance.filter(({ producer, balance }) => {
      const matchSearch = !q ||
        producer.full_name.toLowerCase().includes(q) ||
        producer.email?.toLowerCase().includes(q) ||
        producer.phone?.includes(q)
      if (!matchSearch) return false
      if (balanceFilter === 'a_pagar') return balance > 0
      if (balanceFilter === 'devendo') return balance < 0
      if (balanceFilter === 'zerado') return balance === 0
      return true
    })
  }, [producersWithBalance, search, balanceFilter])

  const totalToReceive = producersWithBalance.filter(p => p.balance > 0).reduce((s, p) => s + p.balance, 0)
  const totalOwed = producersWithBalance.filter(p => p.balance < 0).reduce((s, p) => s + Math.abs(p.balance), 0)

  function ymd(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }

  // ───── Visão por período (emissão de OP em lote) ─────
  // Só eventos PENDENTES com data no período, somando saldo (créditos − débitos) dos
  // lançamentos vinculados — mesma regra do botão "Emitir OP" da tela do produtor.
  const periodPayables = useMemo((): PeriodPayable[] => {
    if (!periodActive) return []
    const fromStr = ymd(dateRange!.from!)
    const toStr = dateRange!.to ? ymd(dateRange!.to) : fromStr
    return producers
      .map(producer => {
        const eventIds = events
          .filter(ev => {
            if (ev.producer_id !== producer.id || ev.status !== 'pending') return false
            if (emittedSet.has(ev.id)) return false // já está em uma OP existente
            const dateKey = ev.billing_from ?? ev.event_date
            return dateKey >= fromStr && dateKey <= toStr
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

  async function handleImportProducersFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (importProducerRef.current) importProducerRef.current.value = ''
    if (!file) return

    setImportingProducers(true)
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      type Row = { nome?: string; email?: string; telefone?: string; pix?: string; banco?: string; agencia?: string; conta?: string; observacoes?: string }
      const rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: null })

      const parsed = rows
        .map(r => ({ name: String(r.nome ?? '').trim(), email: String(r.email ?? '').trim() || null, phone: String(r.telefone ?? '').trim() || null, pix_key: String(r.pix ?? '').trim() || null, bank_name: String(r.banco ?? '').trim() || null, bank_agency: String(r.agencia ?? '').trim() || null, bank_account: String(r.conta ?? '').trim() || null, notes: String(r.observacoes ?? '').trim() || null }))
        .filter(r => r.name)

      if (parsed.length === 0) {
        toast.error('Nenhum produtor encontrado. Verifique se a coluna "nome" existe.')
        return
      }

      const { data: existing } = await supabase
        .from('producers')
        .select('full_name')
        .in('full_name', parsed.map(p => p.name))
      const existingSet = new Set((existing ?? []).map(e => e.full_name.toLowerCase()))

      const toInsert = parsed.filter(p => !existingSet.has(p.name.toLowerCase()))
      const skipped = parsed.length - toInsert.length

      if (toInsert.length === 0) {
        toast.info(`Todos os ${parsed.length} produtores já estão cadastrados.`)
        return
      }

      const msg = skipped > 0
        ? `Importar ${toInsert.length} produtor(es) novo(s)? (${skipped} já cadastrado(s) serão ignorados)`
        : `Importar ${toInsert.length} produtor(es)?`
      if (!confirm(msg)) return

      const inserts = toInsert.map(p => ({
        user_id: userId,
        full_name: p.name,
        email: p.email,
        phone: p.phone,
        pix_key: p.pix_key,
        bank_name: p.bank_name,
        bank_agency: p.bank_agency,
        bank_account: p.bank_account,
        notes: p.notes,
      }))

      const { error } = await supabase.from('producers').insert(inserts)
      if (error) throw error

      toast.success(`${toInsert.length} produtor(es) importado(s)!${skipped > 0 ? ` (${skipped} ignorado(s))` : ''}`)
      router.refresh()
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Erro ao importar Excel')
    } finally {
      setImportingProducers(false)
    }
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
        <div className="flex gap-2">
          <input
            ref={importProducerRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImportProducersFile}
          />
          <Button variant="outline" onClick={() => importProducerRef.current?.click()} disabled={importingProducers} className="gap-2">
            <Upload className="h-4 w-4" />
            {importingProducers ? 'Importando...' : 'Importar Excel'}
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Produtor
          </Button>
        </div>
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

      {!periodActive && (
        <div className="flex flex-wrap gap-2 text-sm">
          {(
            [
              { key: 'todos',    label: `Todos (${producersWithBalance.length})` },
              { key: 'a_pagar', label: `A pagar (${producersWithBalance.filter(p => p.balance > 0).length})`,  activeClass: 'bg-green-600 text-white border-green-600',  inactiveClass: 'text-green-700 border-green-300 hover:bg-green-50' },
              { key: 'devendo',  label: `Devendo (${producersWithBalance.filter(p => p.balance < 0).length})`, activeClass: 'bg-red-600 text-white border-red-600',      inactiveClass: 'text-red-700 border-red-300 hover:bg-red-50' },
              { key: 'zerado',   label: `Zerado (${producersWithBalance.filter(p => p.balance === 0).length})`,activeClass: 'bg-gray-500 text-white border-gray-500',    inactiveClass: 'text-gray-600 border-gray-300 hover:bg-gray-50' },
            ] as { key: BalanceFilter; label: string; activeClass?: string; inactiveClass?: string }[]
          ).map(chip => {
            const isActive = balanceFilter === chip.key
            return (
              <button key={chip.key} onClick={() => setBalanceFilter(chip.key)}
                className={`px-3 py-1 rounded-full border font-medium transition-colors ${isActive ? (chip.activeClass ?? 'bg-blue-600 text-white border-blue-600') : (chip.inactiveClass ?? 'text-blue-700 border-blue-300 hover:bg-blue-50')}`}
              >
                {chip.label}
              </button>
            )
          })}
        </div>
      )}

      {periodActive ? (
        // ───── Tabela por período (com seleção para o lote) ─────
        filteredPeriod.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <CalendarClock className="h-12 w-12 mx-auto text-gray-300" />
            <p className="text-gray-500 font-medium">Nenhum produtor com evento a pagar neste período</p>
            <p className="text-sm text-gray-400">Ajuste o período ou limpe o filtro para ver todos</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      className="rounded w-4 h-4 accent-blue-600"
                      checked={filteredPeriod.every(p => !excluded.has(p.producer.id))}
                      onChange={() => {
                        const allChecked = filteredPeriod.every(p => !excluded.has(p.producer.id))
                        setExcluded(allChecked
                          ? new Set(filteredPeriod.map(p => p.producer.id))
                          : new Set()
                        )
                      }}
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Nome</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">E-mail</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Telefone</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Eventos</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">A pagar</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPeriod.map(({ producer, eventIds, payable }) => {
                  const checked = !excluded.has(producer.id)
                  return (
                    <tr key={producer.id} className={`transition-colors hover:bg-gray-50 ${!checked ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleExclude(producer.id)}
                          className="rounded w-4 h-4 accent-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <Link href={`/dashboard/producers/${producer.id}`} className="hover:underline hover:text-blue-700">
                          {producer.full_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{producer.email ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{producer.phone ?? '—'}</td>
                      <td className="px-4 py-3 text-center text-gray-500">
                        {eventIds.length}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-700">
                        {formatCurrency(payable)}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/producers/${producer.id}`}>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        // ───── Tabela acumulada ─────
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
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Nome</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">E-mail</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Telefone</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">PIX</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Saldo</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBalance.map(({ producer, balance }) => (
                  <tr key={producer.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link href={`/dashboard/producers/${producer.id}`} className="hover:underline hover:text-blue-700 block">
                        {producer.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{producer.email ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{producer.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{producer.pix_key ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        balance >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {balance >= 0 ? 'A pagar' : 'Devendo'}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${balance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {formatCurrency(Math.abs(balance))}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/producers/${producer.id}`}>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      <ProducerForm open={formOpen} onOpenChange={setFormOpen} producer={null} />
    </div>
  )
}
