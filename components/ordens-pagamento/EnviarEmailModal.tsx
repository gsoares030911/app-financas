'use client'

import { useState, useTransition } from 'react'
import { Mail, X, AlertCircle, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils/format'
import { sendOrdemPagamentoEmails } from '@/app/actions/sendOrderEmail'
import { toast } from 'sonner'
import type { PaymentOrder, Producer } from '@/lib/types'

type ProducerEmailInfo = Pick<Producer, 'id' | 'full_name' | 'email'>

interface Props {
  orders: PaymentOrder[]
  producers: ProducerEmailInfo[]
  onClose: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function EnviarEmailModal({ orders, producers, onClose }: Props) {
  const producerMap = new Map(producers.map(p => [p.id, p]))

  const defaultEmails = Array.from(new Set(
    orders.map(o => producerMap.get(o.producer_id)?.email).filter((e): e is string => !!e?.trim())
  )).join(', ')

  const [emailsText, setEmailsText] = useState(defaultEmails)
  const [errors, setErrors] = useState<string[]>([])
  const [sending, startSending] = useTransition()

  function parseEmails(): string[] {
    return emailsText
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0)
  }

  function enviar() {
    const emails = parseEmails()
    const e: string[] = []
    if (emails.length === 0) e.push('Informe ao menos um email')
    const invalid = emails.filter(em => !EMAIL_RE.test(em))
    if (invalid.length > 0) e.push(`Email inválido: ${invalid.join(', ')}`)
    setErrors(e)
    if (e.length > 0) return

    startSending(async () => {
      const result = await sendOrdemPagamentoEmails(orders.map(o => o.id), emails)

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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">

        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2.5">
            <Mail className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="font-semibold text-gray-900">Enviar Ordem de Pagamento por Email</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {orders.length} ordem{orders.length > 1 ? 's' : ''} selecionada{orders.length > 1 ? 's' : ''} — um email por OP, com o PDF em anexo
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
              Destinatários
            </label>
            <Input
              value={emailsText}
              onChange={e => setEmailsText(e.target.value)}
              placeholder="produtor@email.com, contador@email.com"
              className="h-9 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Separe múltiplos emails por vírgula. Pré-preenchido com o email cadastrado do(s) produtor(es).
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg border divide-y max-h-40 overflow-y-auto">
            {orders.map(order => {
              const prod = producerMap.get(order.producer_id)
              return (
                <div key={order.id} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="font-mono text-blue-700 font-semibold">{order.order_number}</span>
                  <span className="text-gray-600 truncate mx-2 flex-1">{prod?.full_name ?? '—'}</span>
                  <span className="font-semibold text-gray-800 whitespace-nowrap">
                    {formatCurrency(Number(order.amount))}
                  </span>
                </div>
              )
            })}
          </div>

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

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
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
