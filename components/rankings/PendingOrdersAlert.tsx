import Link from 'next/link'
import { AlertTriangle, Clock, FileText, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import type { PaymentOrder, Producer, UserRole } from '@/lib/types'

interface Props {
  pendingOrders: PaymentOrder[]
  producers: Pick<Producer, 'id' | 'full_name'>[]
  role: UserRole
  isPenultimateBusinessDay: boolean
  penultimateDate: string // "DD/MM"
}

export default function PendingOrdersAlert({ pendingOrders, producers, role, isPenultimateBusinessDay, penultimateDate }: Props) {
  if (pendingOrders.length === 0) return null

  const producerMap = new Map(producers.map(p => [p.id, p.full_name]))
  const totalAmount = pendingOrders.reduce((s, o) => s + Number(o.amount), 0)

  const isFinanceiro = role === 'financeiro_bilheteria'
  const showUrgentAlert = isPenultimateBusinessDay && pendingOrders.length > 0

  return (
    <div className="space-y-3">
      {/* Banner de urgência — penúltimo dia útil */}
      {showUrgentAlert && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 flex gap-3 items-start">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-800 text-sm">
              Atenção — Penúltimo dia útil do mês ({penultimateDate})
            </p>
            <p className="text-amber-700 text-sm mt-0.5">
              {isFinanceiro
                ? `Você tem ${pendingOrders.length} ordem${pendingOrders.length > 1 ? 's' : ''} de pagamento pendente${pendingOrders.length > 1 ? 's' : ''} que precisa${pendingOrders.length > 1 ? 'm' : ''} ser confirmada${pendingOrders.length > 1 ? 's' : ''} antes do encerramento do mês.`
                : `Há ${pendingOrders.length} ordem${pendingOrders.length > 1 ? 's' : ''} de pagamento pendente${pendingOrders.length > 1 ? 's' : ''} para encerramento até o final do mês.`
              }
            </p>
          </div>
          <Link
            href="/dashboard/ordens-pagamento"
            className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-200 hover:bg-amber-300 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            Ver ordens <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Card de ordens pendentes */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-500" />
            <h2 className="font-semibold text-sm text-gray-800">
              Ordens de Pagamento Pendentes
            </h2>
            <span className="text-xs bg-yellow-100 text-yellow-700 font-semibold px-2 py-0.5 rounded-full">
              {pendingOrders.length}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              Total: <span className="font-semibold text-gray-800">{formatCurrency(totalAmount)}</span>
            </span>
            <Link
              href="/dashboard/ordens-pagamento"
              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5"
            >
              Ver todas <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <div className="divide-y">
          {pendingOrders.slice(0, 5).map(order => (
            <Link
              key={order.id}
              href={`/dashboard/ordens-pagamento/${order.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
            >
              <div className="flex-shrink-0">
                <FileText className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                    {order.order_number}
                  </span>
                  <span className="text-sm text-gray-700 truncate">
                    {producerMap.get(order.producer_id) ?? '—'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {order.event_ids.length} evento{order.event_ids.length !== 1 ? 's' : ''} · emitida em{' '}
                  {new Date(order.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </p>
              </div>
              <span className="text-sm font-semibold text-green-700 whitespace-nowrap">
                {formatCurrency(Number(order.amount))}
              </span>
            </Link>
          ))}
          {pendingOrders.length > 5 && (
            <Link
              href="/dashboard/ordens-pagamento"
              className="flex items-center justify-center gap-1 py-2.5 text-xs text-blue-600 hover:text-blue-800 font-medium hover:bg-blue-50 transition-colors"
            >
              Ver mais {pendingOrders.length - 5} ordem{pendingOrders.length - 5 !== 1 ? 's' : ''} pendente{pendingOrders.length - 5 !== 1 ? 's' : ''}
              <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
