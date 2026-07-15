'use client'

import Link from 'next/link'
import { ArrowLeft, Printer, CheckCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils/format'
import { CATEGORY_LABELS } from '@/lib/types'
import type { PaymentOrder, Producer, ProducerEvent, AccountEntry } from '@/lib/types'

interface Props {
  order: PaymentOrder
  producer: Producer
  events: ProducerEvent[]
  entries: AccountEntry[]
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export default function OrdemPagamento({ order, producer, events, entries }: Props) {
  const totalCredits = entries.filter(e => e.entry_type === 'credito').reduce((s, e) => s + Number(e.amount), 0)
  const totalDebits  = entries.filter(e => e.entry_type === 'debito').reduce((s, e) => s + Number(e.amount), 0)
  const totalAPagar  = Number(order.amount)

  const debitsByEvent = entries.reduce<Record<string, number>>((acc, e) => {
    if (e.entry_type === 'debito' && e.event_id) {
      acc[e.event_id] = (acc[e.event_id] ?? 0) + Number(e.amount)
    }
    return acc
  }, {})

  const emittedAt = fmtDate(order.created_at.split('T')[0])
  const paidAt    = order.paid_at ? fmtDate(order.paid_at.split('T')[0]) : null

  return (
    <div>
      {/* Barra de ações — não imprime */}
      <div className="flex items-center gap-3 mb-6 print:hidden">
        <Link href="/dashboard/ordens-pagamento">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 flex items-center gap-3">
          <span className="text-sm text-gray-500">Ordem de Pagamento</span>
          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded text-sm">
            {order.order_number}
          </span>
          {order.status === 'paid' ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
              <CheckCircle className="h-3.5 w-3.5" /> Paga em {paidAt}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 px-2.5 py-1 rounded-full">
              <Clock className="h-3.5 w-3.5" /> Aguardando pagamento
            </span>
          )}
        </div>
        <Button onClick={() => window.print()} size="sm" variant="outline">
          <Printer className="h-4 w-4 mr-1.5" />
          Imprimir / PDF
        </Button>
        {order.status === 'pending' && (
          <Link href="/dashboard/ordens-pagamento">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
              <CheckCircle className="h-4 w-4 mr-1.5" />
              Confirmar Pagamento
            </Button>
          </Link>
        )}
      </div>

      {/* Documento */}
      <div className="bg-white border rounded-xl p-8 max-w-3xl mx-auto print:border-none print:rounded-none print:p-0 print:max-w-none print:mx-0">

        {/* Cabeçalho */}
        <div className="mb-8">
          <div className="flex items-center justify-between pb-5 border-b-2 border-gray-900">
            {/* Logo */}
            <img
              src="/logo-bilheteria-express.png"
              alt="Bilheteria Express"
              className="h-16 w-auto object-contain"
            />

            {/* Título + número + data */}
            <div className="text-right">
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-400 mb-1">
                Conta Corrente de Produtor Cultural
              </p>
              <h1 className="text-2xl font-black tracking-tight text-gray-900 uppercase">
                Ordem de Pagamento
              </h1>
              <div className="mt-2 flex items-center justify-end gap-3">
                <span className="font-mono font-bold text-lg bg-gray-900 text-white px-3 py-1 rounded-lg tracking-wider">
                  {order.order_number}
                </span>
                <span className="text-sm text-gray-500">
                  Emissão: <span className="font-semibold text-gray-700">{emittedAt}</span>
                </span>
              </div>
              {order.period_from && (
                <p className="text-xs text-gray-400 mt-1">
                  Período: {fmtDate(order.period_from)}{order.period_to ? ` a ${fmtDate(order.period_to)}` : ''}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Produtor */}
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Produtor</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
            <div>
              <span className="text-gray-500">Nome:</span>{' '}
              <span className="font-semibold text-gray-900">{producer.full_name}</span>
            </div>
            {producer.pix_key && (
              <div><span className="text-gray-500">PIX:</span>{' '}<span className="font-medium">{producer.pix_key}</span></div>
            )}
            {producer.bank_name && (
              <div><span className="text-gray-500">Banco:</span>{' '}<span className="font-medium">{producer.bank_name}</span></div>
            )}
            {producer.bank_agency && (
              <div>
                <span className="text-gray-500">Ag / Conta:</span>{' '}
                <span className="font-medium">{producer.bank_agency}{producer.bank_account ? ` / ${producer.bank_account}` : ''}</span>
              </div>
            )}
            {producer.email && (
              <div><span className="text-gray-500">E-mail:</span>{' '}<span className="font-medium">{producer.email}</span></div>
            )}
            {producer.phone && (
              <div><span className="text-gray-500">Telefone:</span>{' '}<span className="font-medium">{producer.phone}</span></div>
            )}
          </div>
        </div>

        {/* Eventos */}
        {events.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Eventos ({events.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border rounded-lg overflow-hidden min-w-[640px]">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Evento</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-gray-600">Data</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Bruto</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Despesas</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Líquido</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {events.map(ev => (
                    <tr key={ev.id}>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{ev.name}</td>
                      <td className="px-4 py-2.5 text-center text-gray-500 whitespace-nowrap">{fmtDate(ev.event_date)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{formatCurrency(ev.gross_revenue)}</td>
                      <td className="px-4 py-2.5 text-right text-red-600">−{formatCurrency(debitsByEvent[ev.id] ?? 0)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-green-700">{formatCurrency(ev.net_amount)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          ev.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {ev.status === 'pending' ? 'Pendente' : 'Liquidado'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Conta Corrente */}
        {entries.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Conta Corrente</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border rounded-lg overflow-hidden min-w-[560px]">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Data</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Descrição</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Categoria</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.map(e => (
                    <tr key={e.id}>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(e.date)}</td>
                      <td className="px-4 py-2.5 text-gray-800">{e.description}</td>
                      <td className="px-4 py-2.5 text-gray-500">{CATEGORY_LABELS[e.category] ?? e.category}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold whitespace-nowrap ${
                        e.entry_type === 'credito' ? 'text-green-700' : 'text-red-600'
                      }`}>
                        {e.entry_type === 'credito' ? '+' : '−'} {formatCurrency(Number(e.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <td colSpan={3} className="px-4 py-2">Total créditos</td>
                    <td className="px-4 py-2 text-right font-semibold text-green-700">+{formatCurrency(totalCredits)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-4 py-2">Total débitos</td>
                    <td className="px-4 py-2 text-right font-semibold text-red-600">−{formatCurrency(totalDebits)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Total */}
        <div className={`rounded-xl p-5 border-2 ${
          order.status === 'paid'
            ? 'border-gray-200 bg-gray-50'
            : totalAPagar >= 0 ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
        }`}>
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-gray-500">
              {order.status === 'paid'
                ? <span className="flex items-center gap-1.5 font-medium text-green-700"><CheckCircle className="h-4 w-4" /> Pagamento confirmado em {paidAt}</span>
                : <span>Aguardando confirmação do pagamento no banco</span>
              }
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-0.5">
                {totalAPagar >= 0 ? 'Total a Pagar ao Produtor' : 'Total Devedor do Produtor'}
              </p>
              <p className={`text-3xl font-bold ${
                order.status === 'paid' ? 'text-gray-500' : totalAPagar >= 0 ? 'text-green-700' : 'text-red-700'
              }`}>
                {formatCurrency(Math.abs(totalAPagar))}
              </p>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="mt-10 pt-6 border-t grid grid-cols-2 gap-8 text-sm text-gray-500">
          <div>
            <p className="font-medium text-gray-700 mb-6">Assinatura do Responsável</p>
            <div className="border-t border-gray-400 pt-1"><p>Data: ___/___/______</p></div>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-6">Assinatura do Produtor</p>
            <div className="border-t border-gray-400 pt-1"><p>Data: ___/___/______</p></div>
          </div>
        </div>
      </div>
    </div>
  )
}
