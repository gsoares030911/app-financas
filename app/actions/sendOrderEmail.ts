'use server'

import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getOrdemPagamentoData } from '@/lib/ordemPagamento'
import { OrdemPagamentoDocument } from '@/lib/pdf/OrdemPagamentoDocument'
import { formatCurrency } from '@/lib/utils/format'

export interface SendOrderEmailResult {
  sent: string[]
  errors: { orderNumber: string; error: string }[]
}

export async function sendOrdemPagamentoEmails(orderIds: string[], emails: string[]): Promise<SendOrderEmailResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { sent: [], errors: orderIds.map(id => ({ orderNumber: id, error: 'Não autenticado' })) }

  if (emails.length === 0) return { sent: [], errors: orderIds.map(id => ({ orderNumber: id, error: 'Nenhum email informado' })) }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { sent: [], errors: orderIds.map(id => ({ orderNumber: id, error: 'RESEND_API_KEY não configurada no servidor' })) }
  }

  const { Resend } = await import('resend')
  const resend = new Resend(apiKey)
  const from = process.env.RESEND_FROM_EMAIL || 'Bilheteria Express <onboarding@resend.dev>'

  const result: SendOrderEmailResult = { sent: [], errors: [] }

  for (const orderId of orderIds) {
    const data = await getOrdemPagamentoData(supabase, orderId)
    if (!data) {
      result.errors.push({ orderNumber: orderId, error: 'Ordem de pagamento não encontrada' })
      continue
    }
    const { order, producer } = data

    try {
      const pdfBuffer = await renderToBuffer(createElement(OrdemPagamentoDocument, data) as unknown as Parameters<typeof renderToBuffer>[0])

      const { error } = await resend.emails.send({
        from,
        to: emails,
        subject: `Ordem de Pagamento ${order.order_number} — ${producer.full_name}`,
        html: `
          <p>Olá,</p>
          <p>Segue em anexo a Ordem de Pagamento <strong>${order.order_number}</strong> de <strong>${producer.full_name}</strong>, no valor de <strong>${formatCurrency(Number(order.amount))}</strong>.</p>
          <p>${order.status === 'paid' ? 'Pagamento confirmado.' : 'Aguardando confirmação do pagamento.'}</p>
        `,
        attachments: [
          { filename: `OP_${order.order_number}.pdf`, content: pdfBuffer },
        ],
      })

      if (error) {
        result.errors.push({ orderNumber: order.order_number, error: error.message })
      } else {
        result.sent.push(order.order_number)
      }
    } catch (err) {
      result.errors.push({ orderNumber: order.order_number, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return result
}
