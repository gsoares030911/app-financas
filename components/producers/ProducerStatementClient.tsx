'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Edit2, Trash2, Mail, Phone, Building2, Hash,
  ChevronUp, ChevronDown, ChevronsUpDown, FileText,
} from 'lucide-react'
import DateRangePicker from '@/components/shared/DateRangePicker'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { CATEGORY_LABELS, CATEGORY_COLORS, SYSTEM_CATEGORIES } from '@/lib/types'
import type { Producer, AccountEntry, ProducerEvent, EquipmentRental, Category } from '@/lib/types'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import EntryDialog from './EntryDialog'
import EventDialog from './EventDialog'
import EquipmentRentalDialog from './EquipmentRentalDialog'
import ProducerForm from './ProducerForm'

interface Props {
  producer: Producer
  entries: AccountEntry[]
  events: ProducerEvent[]
  rentals: EquipmentRental[]
  categories?: Category[]
  userId: string
}


export default function ProducerStatementClient({ producer: initialProducer, entries, events, rentals, categories: propCategories, userId }: Props) {
  const systemCats = SYSTEM_CATEGORIES.map(c => ({ ...c, id: c.slug, user_id: '', created_at: '' }))
  const cats = (propCategories && propCategories.length > 0) ? propCategories : systemCats
  const catLabels: Record<string, string> = Object.fromEntries(cats.map(c => [c.slug, c.name]))
  const catBadge: Record<string, string> = Object.fromEntries(cats.map(c => [c.slug, CATEGORY_COLORS[c.color] ?? CATEGORY_COLORS.gray]))
  const router = useRouter()
  const supabase = createClient()

  const [producer, setProducer] = useState(initialProducer)
  const [entryOpen, setEntryOpen] = useState(false)
  const [eventOpen, setEventOpen] = useState(false)
  const [rentalOpen, setRentalOpen] = useState(false)
  const [editingProducer, setEditingProducer] = useState(false)
  const [editEntry, setEditEntry] = useState<AccountEntry | null>(null)
  const [editEvent, setEditEvent] = useState<ProducerEvent | null>(null)
  const [editRental, setEditRental] = useState<EquipmentRental | null>(null)
  const [filterType, setFilterType] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set())

  function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
    if (!active) return <ChevronsUpDown className="h-3 w-3 ml-1 text-gray-400" />
    return dir === 'asc'
      ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" />
      : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />
  }

  type EventSortCol = 'name' | 'event_date' | 'gross_revenue' | 'platform_fee' | 'net_amount' | 'status'
  const [eventSort, setEventSort] = useState<{ col: EventSortCol; dir: 'asc' | 'desc' }>({ col: 'event_date', dir: 'desc' })
  function toggleEventSort(col: EventSortCol) {
    setEventSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  type ExtratSortCol = 'date' | 'description' | 'category' | 'amount' | 'balance'
  const [extratSort, setExtratSort] = useState<{ col: ExtratSortCol; dir: 'asc' | 'desc' }>({ col: 'date', dir: 'desc' })
  function toggleExtratSort(col: ExtratSortCol) {
    setExtratSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  type EquipSortCol = 'equipment_name' | 'monthly_amount' | 'billing_day' | 'start_date' | 'end_date' | 'is_active'
  const [equipSort, setEquipSort] = useState<{ col: EquipSortCol; dir: 'asc' | 'desc' }>({ col: 'start_date', dir: 'desc' })
  function toggleEquipSort(col: EquipSortCol) {
    setEquipSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  const cardEntries = useMemo(() => {
    if (!dateRange?.from) return entries
    return entries.filter(e => {
      const d = new Date(e.date + 'T12:00:00')
      if (dateRange.to) return d >= dateRange.from! && d <= dateRange.to
      return d >= dateRange.from!
    })
  }, [entries, dateRange])

  const totalCredits = cardEntries.filter(e => e.entry_type === 'credito').reduce((s, e) => s + e.amount, 0)
  const totalDebits  = cardEntries.filter(e => e.entry_type === 'debito').reduce((s, e) => s + e.amount, 0)
  const totalBonus   = cardEntries.filter(e => e.category === 'bonificacao' && e.entry_type === 'credito').reduce((s, e) => s + e.amount, 0)
  const balance = totalCredits - totalDebits

  const salesChartData = useMemo(() => {
    const salesEntries = cardEntries.filter(e => e.entry_type === 'credito' && e.category === 'venda_evento')
    const byDate = new Map<string, number>()
    for (const e of salesEntries) {
      byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.amount)
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({
        label: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        total,
      }))
  }, [cardEntries])

  // Compute running balance on all entries, then filter for display
  const allWithBalance = useMemo(() => {
    const sorted = [...entries].sort((a, b) =>
      a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at)
    )
    let running = 0
    return sorted.map(e => {
      running += e.entry_type === 'credito' ? e.amount : -e.amount
      return { ...e, runningBalance: running }
    })
  }, [entries])

  const displayEntries = useMemo(() => {
    return allWithBalance
      .filter(e => {
        if (filterType !== 'all' && e.entry_type !== filterType) return false
        if (filterCategory !== 'all' && e.category !== filterCategory) return false
        if (dateRange?.from) {
          const d = new Date(e.date + 'T12:00:00')
          if (dateRange.to) { if (!(d >= dateRange.from && d <= dateRange.to)) return false }
          else { if (d < dateRange.from) return false }
        }
        return true
      })
      .slice()
      .reverse()
  }, [allWithBalance, filterType, filterCategory, dateRange])

  const sortedDisplayEntries = useMemo(() => {
    return [...displayEntries].sort((a, b) => {
      const { col, dir } = extratSort
      let cmp = 0
      if (col === 'date') cmp = a.date.localeCompare(b.date)
      else if (col === 'description') cmp = a.description.localeCompare(b.description)
      else if (col === 'category') cmp = a.category.localeCompare(b.category)
      else if (col === 'amount') cmp = a.amount - b.amount
      else if (col === 'balance') cmp = a.runningBalance - b.runningBalance
      return dir === 'asc' ? cmp : -cmp
    })
  }, [displayEntries, extratSort])

  const bonusPerEvent = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of entries) {
      if (e.category === 'bonificacao' && e.entry_type === 'credito' && e.event_id) {
        map.set(e.event_id, (map.get(e.event_id) ?? 0) + e.amount)
      }
    }
    return map
  }, [entries])

  const sortedEvents = useMemo(() => {
    return [...events]
      .filter(ev => {
        if (!dateRange?.from) return true
        const d = new Date(ev.event_date + 'T12:00:00')
        if (dateRange.to) return d >= dateRange.from && d <= dateRange.to
        return d >= dateRange.from
      })
      .sort((a, b) => {
        const { col, dir } = eventSort
        let cmp = 0
        if (col === 'name') cmp = a.name.localeCompare(b.name)
        else if (col === 'event_date') cmp = a.event_date.localeCompare(b.event_date)
        else if (col === 'gross_revenue') cmp = a.gross_revenue - b.gross_revenue
        else if (col === 'platform_fee') cmp = a.platform_fee - b.platform_fee
        else if (col === 'net_amount') cmp = a.net_amount - b.net_amount
        else if (col === 'status') cmp = a.status.localeCompare(b.status)
        return dir === 'asc' ? cmp : -cmp
      })
  }, [events, eventSort, dateRange])

  const sortedRentals = useMemo(() => {
    return [...rentals].sort((a, b) => {
      const { col, dir } = equipSort
      let cmp = 0
      if (col === 'equipment_name') cmp = a.equipment_name.localeCompare(b.equipment_name)
      else if (col === 'monthly_amount') cmp = a.monthly_amount - b.monthly_amount
      else if (col === 'billing_day') cmp = a.billing_day - b.billing_day
      else if (col === 'start_date') cmp = a.start_date.localeCompare(b.start_date)
      else if (col === 'end_date') cmp = (a.end_date ?? '').localeCompare(b.end_date ?? '')
      else if (col === 'is_active') cmp = Number(b.is_active) - Number(a.is_active)
      return dir === 'asc' ? cmp : -cmp
    })
  }, [rentals, equipSort])

  async function deleteEntry(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    const { error } = await supabase.from('account_entries').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir')
    else { toast.success('Lançamento excluído'); router.refresh() }
  }

  async function deleteEvent(id: string) {
    if (!confirm('Excluir este evento?')) return
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir')
    else { toast.success('Evento excluído'); router.refresh() }
  }

  async function deleteRental(id: string) {
    if (!confirm('Excluir este aluguel?')) return
    const { error } = await supabase.from('equipment_rentals').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir')
    else { toast.success('Aluguel excluído'); router.refresh() }
  }

  async function emitirOP(eventIds: string[], periodFrom?: string, periodTo?: string) {
    const ids = eventIds.filter(Boolean)
    if (ids.length === 0 && !periodFrom) {
      toast.error('Selecione eventos ou um período para emitir a OP')
      return
    }

    // Calcular saldo dos lançamentos vinculados
    const relevantEntries = entries.filter(e => e.event_id && ids.includes(e.event_id))
    const credits = relevantEntries.filter(e => e.entry_type === 'credito').reduce((s, e) => s + Number(e.amount), 0)
    const debits  = relevantEntries.filter(e => e.entry_type === 'debito').reduce((s, e) => s + Number(e.amount), 0)
    const amount  = Math.max(credits - debits, 0)

    // Próximo número da OP
    const year = new Date().getFullYear()
    const { count } = await supabase
      .from('payment_orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .like('order_number', `OP-${year}-%`)
    const nextNum = String((count ?? 0) + 1).padStart(3, '0')
    const orderNumber = `OP-${year}-${nextNum}`

    const { data: order, error } = await supabase
      .from('payment_orders')
      .insert({
        user_id: userId,
        producer_id: producer.id,
        order_number: orderNumber,
        amount,
        status: 'pending',
        event_ids: ids,
        period_from: periodFrom ?? null,
        period_to: periodTo ?? null,
      })
      .select()
      .single()

    if (error || !order) { toast.error('Erro ao criar ordem de pagamento'); return }

    toast.success(`Ordem ${orderNumber} criada`)
    router.push(`/dashboard/ordens-pagamento/${order.id}`)
  }

  async function bulkSettle(status: 'settled' | 'pending') {
    const ids = [...selectedEventIds]
    if (ids.length === 0) return
    const label = status === 'settled' ? 'Liquidado' : 'Pendente'
    if (!confirm(`Alterar ${ids.length} evento(s) para "${label}"?`)) return
    const { error } = await supabase.from('events').update({ status }).in('id', ids)
    if (error) toast.error('Erro ao atualizar status')
    else {
      toast.success(`${ids.length} evento(s) marcados como ${label}`)
      setSelectedEventIds(new Set())
      router.refresh()
    }
  }

  function toggleSelectEvent(id: string) {
    setSelectedEventIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedEventIds.size === sortedEvents.length && sortedEvents.length > 0) {
      setSelectedEventIds(new Set())
    } else {
      setSelectedEventIds(new Set(sortedEvents.map(e => e.id)))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/producers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{producer.full_name}</h1>
          <p className="text-sm text-gray-500">Conta Corrente</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditingProducer(true)}>
          <Edit2 className="h-3.5 w-3.5 mr-1.5" />
          Editar
        </Button>
      </div>

      {/* Balance + Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className={`${balance >= 0 ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
          <CardContent className="pt-4">
            <div className="flex justify-center gap-2 mb-3 flex-wrap">
              <DateRangePicker value={dateRange} onChange={setDateRange} />
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                onClick={() => {
                  const pendingIds = events
                    .filter(ev => ev.status === 'pending' && (() => {
                      if (!dateRange?.from) return true
                      const d = new Date(ev.event_date + 'T12:00:00')
                      if (dateRange.to) return d >= dateRange.from && d <= dateRange.to
                      return d >= dateRange.from
                    })())
                    .map(ev => ev.id)
                  emitirOP(
                    pendingIds,
                    dateRange?.from?.toISOString().split('T')[0],
                    dateRange?.to?.toISOString().split('T')[0],
                  )
                }}
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                Emitir OP
              </Button>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-gray-400 mb-0.5">
                {dateRange?.from ? 'Período selecionado' : 'Acumulado total'}
              </p>
              <p className="text-sm font-medium text-gray-500 mb-1">
                {balance >= 0 ? 'A Pagar ao Produtor' : 'Produtor Deve'}
              </p>
              <p className={`text-3xl font-bold ${balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(Math.abs(balance))}
              </p>
              <div className="flex justify-center gap-6 mt-4 text-xs text-gray-500">
                <div className="text-center">
                  <p className="text-green-600 font-semibold text-sm">{formatCurrency(totalCredits)}</p>
                  <p>Valor Bruto</p>
                </div>
                <div className="text-center">
                  <p className="text-red-600 font-semibold text-sm">{formatCurrency(totalDebits)}</p>
                  <p>Desconto de venda</p>
                </div>
                <div className="text-center">
                  <p className="text-blue-600 font-semibold text-sm">{formatCurrency(totalBonus)}</p>
                  <p>BV</p>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {producer.email && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="truncate">{producer.email}</span>
                </div>
              )}
              {producer.phone && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                  <span>{producer.phone}</span>
                </div>
              )}
              {producer.pix_key && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Hash className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="truncate">PIX: {producer.pix_key}</span>
                </div>
              )}
              {producer.bank_name && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="truncate">
                    {producer.bank_name}
                    {producer.bank_agency && ` · Ag ${producer.bank_agency}`}
                    {producer.bank_account && ` · CC ${producer.bank_account}`}
                  </span>
                </div>
              )}
              {!producer.email && !producer.phone && !producer.pix_key && !producer.bank_name && (
                <p className="text-gray-400 italic text-xs sm:col-span-2">Nenhum contato ou dado bancário cadastrado</p>
              )}
              {producer.notes && (
                <p className="sm:col-span-2 text-gray-500 italic text-xs bg-gray-50 p-2 rounded">
                  {producer.notes}
                </p>
              )}
            </div>

            {salesChartData.length > 1 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2">Evolução de vendas {dateRange?.from ? '— período selecionado' : '— acumulado'}</p>
                <ResponsiveContainer width="100%" height={100}>
                  <AreaChart data={salesChartData} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                    <YAxis hide />
                    <Tooltip
                      formatter={(v) => [formatCurrency(Number(v)), 'Vendas']}
                      contentStyle={{ fontSize: 11 }}
                    />
                    <Area type="monotone" dataKey="total" stroke="#22c55e" strokeWidth={1.5} fill="url(#salesGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="extrato">
        <TabsList>
          <TabsTrigger value="extrato">Extrato ({sortedDisplayEntries.length})</TabsTrigger>
          <TabsTrigger value="eventos">Eventos ({sortedEvents.length})</TabsTrigger>
          <TabsTrigger value="equipamentos">Equipamentos ({rentals.length})</TabsTrigger>
        </TabsList>

        {/* ── Extrato ── */}
        <TabsContent value="extrato" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <Select value={filterType} onValueChange={v => v && setFilterType(v)}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="credito">Créditos</SelectItem>
                  <SelectItem value="debito">Débitos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={v => v && setFilterCategory(v)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {cats.filter(c => c.is_active).map(c => ({ k: c.slug, v: c.name })).map(({ k, v }) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}

                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => { setEditEntry(null); setEntryOpen(true) }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Lançamento
            </Button>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {(
                      [
                        { col: 'date', label: 'Data', align: 'left' },
                        { col: 'description', label: 'Descrição', align: 'left' },
                        { col: 'category', label: 'Categoria', align: 'left' },
                        { col: 'amount', label: 'Valor', align: 'right' },
                        { col: 'balance', label: 'Saldo', align: 'right' },
                      ] as { col: ExtratSortCol; label: string; align: 'left' | 'right' }[]
                    ).map(({ col, label, align }) => (
                      <TableHead
                        key={col}
                        className={`cursor-pointer select-none hover:bg-gray-100 transition-colors ${align === 'right' ? 'text-right' : ''}`}
                        onClick={() => toggleExtratSort(col)}
                      >
                        <span className={`inline-flex items-center gap-0.5 ${align === 'right' ? 'justify-end w-full' : ''}`}>
                          {label}
                          <SortIcon active={extratSort.col === col} dir={extratSort.dir} />
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDisplayEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-400 py-10 text-sm">
                        Nenhum lançamento encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedDisplayEntries.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                          {formatDate(e.date)}
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">
                          {e.description}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catBadge[e.category] ?? 'bg-gray-100 text-gray-700'}`}>
                            {catLabels[e.category]}
                          </span>
                        </TableCell>
                        <TableCell className={`text-right font-semibold text-sm whitespace-nowrap ${
                          e.category === 'bonificacao' ? 'text-blue-600' : e.entry_type === 'credito' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {e.entry_type === 'credito' ? '+' : '−'}{formatCurrency(e.amount)}
                        </TableCell>
                        <TableCell className={`text-right text-sm whitespace-nowrap font-medium ${e.runningBalance >= 0 ? 'text-gray-700' : 'text-red-600'}`}>
                          {formatCurrency(e.runningBalance)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditEntry(e); setEntryOpen(true) }}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deleteEntry(e.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ── Eventos ── */}
        <TabsContent value="eventos" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Button onClick={() => { setEditEvent(null); setEventOpen(true) }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Evento
            </Button>
          </div>

          {/* Barra de ação em massa */}
          {selectedEventIds.size > 0 && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <span className="text-sm font-medium text-blue-700">
                {selectedEventIds.size} evento{selectedEventIds.size !== 1 ? 's' : ''} selecionado{selectedEventIds.size !== 1 ? 's' : ''}
              </span>
              <div className="flex gap-2 ml-auto flex-wrap">
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => emitirOP([...selectedEventIds])}
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Emitir OP
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkSettle('pending')} className="text-gray-600 border-gray-300">
                  Marcar Pendente
                </Button>
                <Button size="sm" onClick={() => bulkSettle('settled')} className="bg-green-600 hover:bg-green-700 text-white">
                  Liquidar selecionados
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedEventIds(new Set())} className="text-gray-400">
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={sortedEvents.length > 0 && selectedEventIds.size === sortedEvents.length}
                        onChange={toggleSelectAll}
                      />
                    </TableHead>
                    {([
                      { col: 'name',          label: 'Evento',  align: 'left'  },
                      { col: 'event_date',    label: 'Data',    align: 'left'  },
                      { col: 'gross_revenue', label: 'Bruto',   align: 'right' },
                      { col: 'platform_fee',  label: 'Taxa',    align: 'right' },
                    ] as { col: EventSortCol; label: string; align: 'left' | 'right' }[]).map(({ col, label, align }) => (
                      <TableHead key={col}
                        className={`cursor-pointer select-none hover:bg-gray-100 transition-colors ${align === 'right' ? 'text-right' : ''}`}
                        onClick={() => toggleEventSort(col)}
                      >
                        <span className={`inline-flex items-center gap-0.5 ${align === 'right' ? 'justify-end w-full' : ''}`}>
                          {label}<SortIcon active={eventSort.col === col} dir={eventSort.dir} />
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="text-right text-orange-600 font-medium cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => toggleEventSort('net_amount')}>
                      <span className="inline-flex items-center gap-0.5 justify-end w-full">
                        Desconto<SortIcon active={false} dir="asc" />
                      </span>
                    </TableHead>
                    <TableHead className="text-right text-blue-600 font-medium">BV</TableHead>
                    {([
                      { col: 'net_amount', label: 'Líquido', align: 'right' },
                      { col: 'status',     label: 'Status',  align: 'left'  },
                    ] as { col: EventSortCol; label: string; align: 'left' | 'right' }[]).map(({ col, label, align }) => (
                      <TableHead key={col}
                        className={`cursor-pointer select-none hover:bg-gray-100 transition-colors ${align === 'right' ? 'text-right' : ''}`}
                        onClick={() => toggleEventSort(col)}
                      >
                        <span className={`inline-flex items-center gap-0.5 ${align === 'right' ? 'justify-end w-full' : ''}`}>
                          {label}<SortIcon active={eventSort.col === col} dir={eventSort.dir} />
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-gray-400 py-10 text-sm">
                        Nenhum evento cadastrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedEvents.map(ev => {
                      const bv = bonusPerEvent.get(ev.id) ?? 0
                      const desconto = ev.gross_revenue - ev.net_amount
                      const isSelected = selectedEventIds.has(ev.id)
                      return (
                      <TableRow key={ev.id} className={isSelected ? 'bg-blue-50/50' : ''}>
                        <TableCell>
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={isSelected}
                            onChange={() => toggleSelectEvent(ev.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm">{ev.name}</TableCell>
                        <TableCell className="text-sm text-gray-500 whitespace-nowrap">{formatDate(ev.event_date)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(ev.gross_revenue)}</TableCell>
                        <TableCell className="text-right text-sm text-red-500">{formatCurrency(ev.platform_fee)}</TableCell>
                        <TableCell className="text-right text-sm text-orange-600">
                          {desconto > 0 ? formatCurrency(desconto) : '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm text-blue-600">
                          {bv > 0 ? formatCurrency(bv) : '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold text-green-600">{formatCurrency(ev.net_amount)}</TableCell>
                        <TableCell>
                          <Badge variant={ev.status === 'settled' ? 'default' : 'secondary'}>
                            {ev.status === 'settled' ? 'Liquidado' : 'Pendente'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditEvent(ev); setEventOpen(true) }}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deleteEvent(ev.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ── Equipamentos ── */}
        <TabsContent value="equipamentos" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditRental(null); setRentalOpen(true) }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Equipamento
            </Button>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {(
                      [
                        { col: 'equipment_name', label: 'Equipamento', align: 'left' },
                        { col: 'monthly_amount', label: 'Mensal', align: 'right' },
                        { col: 'billing_day', label: 'Dia', align: 'left' },
                        { col: 'start_date', label: 'Início', align: 'left' },
                        { col: 'end_date', label: 'Fim', align: 'left' },
                        { col: 'is_active', label: 'Status', align: 'left' },
                      ] as { col: EquipSortCol; label: string; align: 'left' | 'right' }[]
                    ).map(({ col, label, align }) => (
                      <TableHead
                        key={col}
                        className={`cursor-pointer select-none hover:bg-gray-100 transition-colors ${align === 'right' ? 'text-right' : ''}`}
                        onClick={() => toggleEquipSort(col)}
                      >
                        <span className={`inline-flex items-center gap-0.5 ${align === 'right' ? 'justify-end w-full' : ''}`}>
                          {label}
                          <SortIcon active={equipSort.col === col} dir={equipSort.dir} />
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rentals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-400 py-10 text-sm">
                        Nenhum equipamento cadastrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedRentals.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm">{r.equipment_name}</TableCell>
                        <TableCell className="text-right text-sm font-semibold">{formatCurrency(r.monthly_amount)}</TableCell>
                        <TableCell className="text-sm text-gray-500">Dia {r.billing_day}</TableCell>
                        <TableCell className="text-sm text-gray-500 whitespace-nowrap">{formatDate(r.start_date)}</TableCell>
                        <TableCell className="text-sm text-gray-500 whitespace-nowrap">{r.end_date ? formatDate(r.end_date) : '—'}</TableCell>
                        <TableCell>
                          <Badge variant={r.is_active ? 'default' : 'secondary'}>
                            {r.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditRental(r); setRentalOpen(true) }}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deleteRental(r.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <EntryDialog
        open={entryOpen}
        onOpenChange={(v) => { setEntryOpen(v); if (!v) setEditEntry(null) }}
        producerId={producer.id}
        entry={editEntry}
        events={events}
        rentals={rentals}
        categories={cats}
      />
      <EventDialog
        open={eventOpen}
        onOpenChange={(v) => { setEventOpen(v); if (!v) setEditEvent(null) }}
        producerId={producer.id}
        event={editEvent}
      />
      <EquipmentRentalDialog
        open={rentalOpen}
        onOpenChange={(v) => { setRentalOpen(v); if (!v) setEditRental(null) }}
        producerId={producer.id}
        rental={editRental}
      />
      <ProducerForm
        open={editingProducer}
        onOpenChange={setEditingProducer}
        producer={producer}
        onUpdate={(updated) => { setProducer(updated); router.refresh() }}
      />
    </div>
  )
}
