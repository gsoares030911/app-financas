import { Transaction } from '@/lib/types'
import { formatDate } from './format'

export function exportToCSV(transactions: Transaction[], filename = 'transacoes.csv') {
  const headers = ['Descrição', 'Tipo', 'Categoria', 'Valor (R$)', 'Data']

  const rows = transactions.map((t) => [
    `"${t.description}"`,
    t.type === 'receita' ? 'Receita' : 'Despesa',
    t.category,
    t.amount.toFixed(2).replace('.', ','),
    formatDate(t.date),
  ])

  const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n')
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
