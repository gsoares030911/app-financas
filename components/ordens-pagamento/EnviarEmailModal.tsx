'use client'

import { useState, useTransition } from 'react'
import { Mail, X, AlertCircle, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils/format'
import { sendOrdemPagamentoEmails, type OrderEmailRequest } from '@/app/actions/sendOrderEmail'
import { toast } from 'sonner'
import type { PaymentOrder, Producer } from '@/lib/types'

type ProducerEmailInfo = Pick<Producer, 'id' | 'full_name' | 'email'>

interface Props {
  orders: PaymentOrder[]
  producers: ProducerEmailInfo[]
  onClose: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseEmails(text: string): string[] {
  return text.split(',').map(e => e.trim()).filter(e => e.length > 0)
}

export default function EnviarEmailModal({ orders, producers, onClose }: Props) {
  const producerMap = new Map(producers.map(p => [p.id, p]))

  // Agrupa por produtor — cada grupo tem seu próprio campo de destinatários.
  // Isso garante que a OP de um produtor NUNCA seja enviada para o email de outro.
  const groups = Array.from(
    orders.reduce((acc, order) => {
      const list = acc.get(order.producer_id) ?? []
      list.push(order)
      acc.set(order.producer_id, list)
      return acc
    }, new Map<string, PaymentOrder[]>())
  )

  const [emailsByProducer, setEmailsByProducer] = useState<Record<string, string>>(() =>
    Object.fromEntries(groups.map(([producerId]) => [producerId, producerMap.get(producerId)?.email ?? '']))
  )
  const [errors, setErrors] = useState<string[]>([])
  const [sending, startSending] = useTransition()

  function enviar() {
    const e: string[] = []
    const requests: OrderEmailRequest[] = []

    for (const [producerId, producerOrders] of groups) {
      const prod = producerMap.get(producerId)
      const emails = parseEmails(emailsByProducer[producerId] ?? '')
      if (emails.length === 0) {
        e.push(`${prod?.full_name ?? producerId}: informe ao menos um email`)
        continue
      }
      const invalid = emails.filter(em => !EMAIL_RE.test(em))
      if (invalid.length > 0) {
        e.push(`${prod?.full_name ?? producerId}: email inválido — ${invalid.join(', ')}`)
        continue
      }
      for (const order of producerOrders) {
        requests.push({ orderId: order.id, emails })
      }
    }

    setErrors(e)
    if (e.length > 0) return

    startSending(async () => {
      const result = await sendOrdemPagamentoEmails(requests)

      if (result.sent.length > 0) {
        toast.success(
          `Email${result.sent.length > 1 ? 's' : ''} enviado${result.sent.length > 1 ? 's' : ''}: ${result.sent.join(', ')}`
        )
      }
      if (result.errors.length > 0) {
        result.errors.forEach(err => toast.error(`${err.orderNumber}: ${err.error}`))
        setErrors(result.errors.map(err => `${err.orderNumber}: ${err.error}`))
        return
      }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-2.5">
            <Mail className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="font-semibold text-gray-900">Enviar Ordem de Pagamento por Email</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {orders.length} ordem{orders.length > 1 ? 's' : ''} · {groups.length} produtor{groups.length > 1 ? 'es' : ''} — um email por OP, com o PDF em anexo
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          {groups.map(([producerId, producerOrders]) => {
            const prod = producerMap.get(producerId)
            return (
              <div key={producerId} className="border rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-800 mb-2">{prod?.full_name ?? '—'}</p>

                <div className="space-y-1 mb-2">
                  {producerOrders.map(order => (
                    <div key={order.id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5">
                      <span className="font-mono text-blue-700 font-semibold">{order.order_number}</span>
                      <span className="font-semibold text-gray-700">{formatCurrency(Number(order.amount))}</span>
                    </div>
                  ))}
                </div>

                <label className="text-xs text-gray-500 mb-1 block">Destinatários desta OP</label>
                <Input
                  value={emailsByProducer[producerId] ?? ''}
                  onChange={ev => setEmailsByProducer(prev => ({ ...prev, [producerId]: ev.target.value }))}
                  placeholder="produtor@email.com, contador@email.com"
                  className="h-8 text-sm"
                />
              </div>
            )
          })}
          <p className="text-xs text-gray-400">
            Separe múltiplos emails por vírgula. Pré-preenchido com o email cadastrado de cada produtor — as OPs de um produtor são enviadas apenas para os emails informados no campo dele.
          </p>

          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-red-700 text-xs font-semibold mb-1">
                <AlertCircle className="h-3.5 w-3.5" /> Corrija antes de enviar:
              </div>
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">• {e}</p>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>Cancelar</Button>
          <Button size="sm" onClick={enviar} disabled={sending} className="bg-blue-600 hover:bg-blue-700 text-white">
            {sending
              ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              : <Send className="h-4 w-4 mr-1.5" />
            }
            {sending ? 'Enviando…' : 'Enviar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
