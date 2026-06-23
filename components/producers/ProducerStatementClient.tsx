'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Edit2, Trash2, Mail, Phone, Building2, Hash,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { CATEGORY_LABELS } from '@/lib/types'
import type { Producer, AccountEntry, ProducerEvent, EquipmentRental } from '@/lib/types'
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
}

const CATEGORY_BADGE: Record<string, string> = {
  venda_evento: 'bg-green-100 text-green-700',
  adiantamento: 'bg-orange-100 text-orange-700',
  anuncio: 'bg-purple-100 text-purple-700',
  emprestimo: 'bg-yellow-100 text-yellow-700',
  aluguel_equipamento: 'bg-blue-100 text-blue-700',
  pagamento: 'bg-teal-100 text-teal-700',
  outros: 'bg-gray-100 text-gray-700',
}

export default function ProducerStatementClient({ producer: initialProducer, entries, events, rentals }: Props) {
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

  const totalCredits = entries.filter(e => e.entry_type === 'credito').reduce((s, e) => s + e.amount, 0)
  const totalDebits = entries.filter(e => e.entry_type === 'debito').reduce((s, e) => s + e.amount, 0)
  const balance = totalCredits - totalDebits

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
        return true
      })
      .slice()
      .reverse()
  }, [allWithBalance, filterType, filterCategory])

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
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500 mb-1">
                {balance >= 0 ? 'A Pagar ao Produtor' : 'Produtor Deve'}
              </p>
              <p className={`text-3xl font-bold ${balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(Math.abs(balance))}
              </p>
              <div className="flex justify-center gap-8 mt-4 text-xs text-gray-500">
                <div className="text-center">
                  <p className="text-green-600 font-semibold text-sm">{formatCurrency(totalCredits)}</p>
                  <p>Créditos</p>
                </div>
                <div className="text-center">
                  <p className="text-red-600 font-semibold text-sm">{formatCurrency(totalDebits)}</p>
                  <p>Débitos</p>
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
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="extrato">
        <TabsList>
          <TabsTrigger value="extrato">Extrato ({entries.length})</TabsTrigger>
          <TabsTrigger value="eventos">Eventos ({events.length})</TabsTrigger>
          <TabsTrigger value="equipamentos">Equipamentos ({rentals.length})</TabsTrigger>
        </TabsList>

        {/* ── Extrato ── */}
        <TabsContent value="extrato" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="credito">Créditos</SelectItem>
                  <SelectItem value="debito">Débitos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
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
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-400 py-10 text-sm">
                        Nenhum lançamento encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayEntries.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                          {formatDate(e.date)}
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">
                          {e.description}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_BADGE[e.category] ?? 'bg-gray-100 text-gray-700'}`}>
                            {CATEGORY_LABELS[e.category]}
                          </span>
                        </TableCell>
                        <TableCell className={`text-right font-semibold text-sm whitespace-nowrap ${e.entry_type === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
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
          <div className="flex justify-end">
            <Button onClick={() => { setEditEvent(null); setEventOpen(true) }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Evento
            </Button>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Taxa</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-400 py-10 text-sm">
                        Nenhum evento cadastrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    events.map(ev => (
                      <TableRow key={ev.id}>
                        <TableCell className="font-medium text-sm">{ev.name}</TableCell>
                        <TableCell className="text-sm text-gray-500 whitespace-nowrap">{formatDate(ev.event_date)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(ev.gross_revenue)}</TableCell>
                        <TableCell className="text-right text-sm text-red-500">{formatCurrency(ev.platform_fee)}</TableCell>
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
                    ))
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
                    <TableHead>Equipamento</TableHead>
                    <TableHead className="text-right">Mensal</TableHead>
                    <TableHead>Dia</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim</TableHead>
                    <TableHead>Status</TableHead>
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
                    rentals.map(r => (
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
