'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/format'
import { toast } from 'sonner'
import { Eye, CheckCircle, Loader2, FileText, Trash2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ExportarCNABModal from './ExportarCNABModal'
import type { PaymentOrder, Producer } from '@/lib/types'

type ProducerBankInfo = Pick<Producer, 'id' | 'full_name' | 'bank_name' | 'bank_agency' | 'bank_account' | 'pix_key'>

interface Props {
  orders: PaymentOrder[]
  producers: ProducerBankInfo[]
}

type TabStatus = 'pending' | 'paid'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })
}

export default function OrdensListClient({ orders: initialOrders, producers }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [orders, setOrders] = useState<PaymentOrder[]>(initialOrders)
  const [tab, setTab] = useState<TabStatus>('pending')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showCNAB, setShowCNAB] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const producerMap = new Map(producers.map(p => [p.id, p.full_name]))

  const filtered = orders.filter(o => o.status === tab)
  const pendingOrders = orders.filter(o => o.status === 'pending')
  const pendingCount = pendingOrders.length
  const paidCount    = orders.filter(o => o.status === 'paid').length

  // Selecção — apenas na aba pendentes
  const allPendingIds = pendingOrders.map(o => o.id)
  const allSelected = allPendingIds.length > 0 && allPendingIds.every(id => selected.has(id))
  const someSelected = allPendingIds.some(id => selected.has(id))

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allPendingIds))
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedOrders = pendingOrders.filter(o => selected.has(o.id))

  async function deleteOrder(order: PaymentOrder) {
    if (order.status === 'paid') { toast.error('Ordens já pagas não podem ser excluídas'); return }
    if (!confirm(
      `Excluir a ordem ${order.order_number}?\n\n` +
      `Os ${order.event_ids.length} evento(s) voltarão ao status Pendente e nenhum lançamento será criado.`
    )) return

    setDeleting(order.id)

    if (order.event_ids.length > 0) {
      const { error } = await supabase
        .from('events')
        .update({ status: 'pending' })
        .in('id', order.event_ids)
      if (error) { toast.error('Erro ao reverter eventos: ' + error.message); setDeleting(null); return }
    }

    const { error } = await supabase
      .from('payment_orders')
      .delete()
      .eq('id', order.id)
      .eq('status', 'pending')

    setDeleting(null)
    if (error) { toast.error('Erro ao excluir: ' + error.message); return }

    setOrders(prev => prev.filter(o => o.id !== order.id))
    setSelected(prev => { const n = new Set(prev); n.delete(order.id); return n })
    toast.success(`${order.order_number} excluída — eventos revertidos para Pendente`)
  }

  async function confirmPayment(order: PaymentOrder) {
    if (!confirm(
      `Confirmar pagamento da ${order.order_number} — ${formatCurrency(Number(order.amount))}?\n\nEsta ação irá:\n• Liquidar ${order.event_ids.length} evento(s)\n• Marcar a ordem como paga (o saldo do produtor é reduzido automaticamente)`
    )) return

    setConfirming(order.id)

    if (order.event_ids.length > 0) {
      const { error } = await supabase
        .from('events')
        .update({ status: 'settled' })
        .in('id', order.event_ids)
      if (error) { toast.error('Erro ao liquidar eventos'); setConfirming(null); return }
    }

    // NÃO criar account_entries aqui: o saldo do produtor já é calculado como
    // créditos − débitos − soma das payment_orders com status='paid' (ver
    // ProducerStatementClient/ProducersClient). Criar um débito extra aqui
    // descontava o valor pago DUAS VEZES, deixando o produtor erroneamente
    // "Devendo" após o pagamento.

    const now = new Date().toISOString()
    const { error } = await supabase
      .from('payment_orders')
      .update({ status: 'paid', paid_at: now })
      .eq('id', order.id)

    setConfirming(null)
    if (error) { toast.error('Erro ao atualizar ordem'); return }

    setOrders(prev => prev.map(o =>
      o.id === order.id ? { ...o, status: 'paid', paid_at: now } : o
    ))
    setSelected(prev => { const n = new Set(prev); n.delete(order.id); return n })
    toast.success(`${order.order_number} confirmada — eventos liquidados`)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {showCNAB && (
        <ExportarCNABModal
          orders={selectedOrders}
          producers={producers}
          onClose={() => setShowCNAB(false)}
        />
      )}

      {/* Tabs + botão CNAB */}
      <div className="flex items-center justify-between border-b">
        <div className="flex gap-1">
          {([
            { key: 'pending' as TabStatus, label: 'Pendentes', count: pendingCount },
            { key: 'paid'    as TabStatus, label: 'Pagas',     count: paidCount    },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-2 ${
                tab === t.key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                tab === t.key
                  ? t.key === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {tab === 'pending' && selectedOrders.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCNAB(true)}
            className="mb-px text-xs flex items-center gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CNAB 240 — Itaú
            <span className="ml-0.5 bg-blue-100 text-blue-700 font-bold rounded-full px-1.5 py-px text-xs">
              {selectedOrders.length}
            </span>
          </Button>
        )}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">
              {tab === 'pending' ? 'Nenhuma ordem pendente' : 'Nenhuma ordem paga'}
            </p>
            <p className="text-sm mt-1">
              {tab === 'pending'
                ? 'Emita uma ordem de pagamento na página do produtor'
                : 'As ordens confirmadas aparecerão aqui'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  {tab === 'pending' && (
                    <th className="pl-4 pr-2 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                        onChange={toggleAll}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                        title="Selecionar todas"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Nº da OP</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Produtor</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Emitida em</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Eventos</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Valor</th>
                  {tab === 'paid' && (
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Paga em</th>
                  )}
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(order => {
                  const isChecked = selected.has(order.id)
                  return (
                    <tr
                      key={order.id}
                      className={`transition-colors ${isChecked ? 'bg-blue-50 hover:bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      {tab === 'pending' && (
                        <td className="pl-4 pr-2 py-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleOne(order.id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs">
                          {order.order_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {producerMap.get(order.producer_id) ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {fmtDate(order.created_at)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                          {order.event_ids.length} evento{order.event_ids.length !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700 whitespace-nowrap">
                        {formatCurrency(Number(order.amount))}
                      </td>
                      {tab === 'paid' && (
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {order.paid_at ? fmtDate(order.paid_at.split('T')[0]) : '—'}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/dashboard/ordens-pagamento/${order.id}`}>
                            <Button size="sm" variant="outline" className="h-7 text-xs">
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Ver
                            </Button>
                          </Link>
                          {tab === 'pending' && (
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                              disabled={confirming === order.id}
                              onClick={() => confirmPayment(order)}
                            >
                              {confirming === order.id
                                ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                : <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              }
                              Confirmar Pagamento
                            </Button>
                          )}
                          {tab === 'paid' && (
                            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                              <CheckCircle className="h-3.5 w-3.5" /> Paga
                            </span>
                          )}
                          {order.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                              disabled={deleting === order.id}
                              onClick={() => deleteOrder(order)}
                              title="Excluir ordem"
                            >
                              {deleting === order.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />
                              }
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {tab === 'pending' && filtered.length > 0 && (
                <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                  <tr>
                    <td className="pl-4 pr-2 py-2.5" />
                    <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-gray-500">
                      {selectedOrders.length > 0
                        ? `${selectedOrders.length} selecionada${selectedOrders.length > 1 ? 's' : ''} · Total seleção:`
                        : 'Total pendente'}
                    </td>
                    <td className="px-4 py-2.5 text-center" />
                    <td className="px-4 py-2.5 text-right font-bold text-green-700">
                      {selectedOrders.length > 0
                        ? formatCurrency(selectedOrders.reduce((s, o) => s + Number(o.amount), 0))
                        : formatCurrency(filtered.reduce((s, o) => s + Number(o.amount), 0))
                      }
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
