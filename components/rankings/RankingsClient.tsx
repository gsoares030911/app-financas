'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/format'
import { Trophy, TrendingDown, Users, TrendingUp, AlertCircle } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { Producer, AccountEntry, ProducerEvent } from '@/lib/types'

interface CancelledEvent {
  id: string
  name: string
  event_date: string
  producer_id: string
}

interface CancelledEntry {
  event_id: string
  producer_id: string
  entry_type: string
  amount: number
}

interface Props {
  producers: Producer[]
  entries: Pick<AccountEntry, 'producer_id' | 'entry_type' | 'amount'>[]
  events: Pick<ProducerEvent, 'producer_id' | 'gross_revenue' | 'net_amount' | 'status'>[]
  cancelledEvents: CancelledEvent[]
  cancelledEntries: CancelledEntry[]
}

const MEDAL_COLORS = ['#f59e0b', '#9ca3af', '#d97706']

export default function RankingsClient({ producers, entries, events, cancelledEvents, cancelledEntries }: Props) {
  const stats = useMemo(() => {
    return producers.map(p => {
      const pe = entries.filter(e => e.producer_id === p.id)
      const pev = events.filter(ev => ev.producer_id === p.id)
      const totalCredits = pe.filter(e => e.entry_type === 'credito').reduce((s, e) => s + e.amount, 0)
      const totalDebits = pe.filter(e => e.entry_type === 'debito').reduce((s, e) => s + e.amount, 0)
      const balance = totalCredits - totalDebits
      const totalRevenue = pev.reduce((s, ev) => s + ev.gross_revenue, 0)
      return { producer: p, balance, totalCredits, totalDebits, totalRevenue }
    })
  }, [producers, entries, events])

  const topSellers = useMemo(
    () => [...stats].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10),
    [stats]
  )

  const worstDebtors = useMemo(
    () => [...stats].filter(s => s.balance < 0).sort((a, b) => a.balance - b.balance).slice(0, 10),
    [stats]
  )

  const globalTotalRevenue = events.reduce((s, e) => s + e.gross_revenue, 0)
  const globalToPay = stats.filter(s => s.balance > 0).reduce((s, p) => s + p.balance, 0)
  const globalOwed = Math.abs(stats.filter(s => s.balance < 0).reduce((s, p) => s + p.balance, 0))

  const pendingCollections = useMemo(() => {
    const producerMap = new Map(producers.map(p => [p.id, p]))
    return cancelledEvents
      .map(ev => {
        const evEntries = cancelledEntries.filter(e => e.event_id === ev.id)
        const debits  = evEntries.filter(e => e.entry_type === 'debito').reduce((s, e) => s + Number(e.amount), 0)
        const credits = evEntries.filter(e => e.entry_type === 'credito').reduce((s, e) => s + Number(e.amount), 0)
        const pending = Math.round((debits - credits) * 100) / 100
        return { ev, producer: producerMap.get(ev.producer_id), pending }
      })
      .filter(x => x.pending > 0)
      .sort((a, b) => b.pending - a.pending)
  }, [cancelledEvents, cancelledEntries, producers])

  const sellersData = topSellers.map(s => ({
    name: s.producer.full_name.split(' ')[0],
    fullName: s.producer.full_name,
    value: s.totalRevenue,
  }))

  const debtorsData = worstDebtors.map(s => ({
    name: s.producer.full_name.split(' ')[0],
    fullName: s.producer.full_name,
    value: Math.abs(s.balance),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Visão geral — produtores e cobranças pendentes</p>
      </div>

      {/* Cobranças Pendentes de Cancelamentos */}
      {pendingCollections.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-orange-700">
              <AlertCircle className="h-5 w-5" />
              Cobranças Pendentes de Cancelamentos ({pendingCollections.length})
            </CardTitle>
            <p className="text-xs text-orange-600">
              Estes valores serão descontados automaticamente no próximo evento de cada produtor.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orange-200">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-orange-700">Produtor</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-orange-700">Evento Cancelado</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-orange-700">Data</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-orange-700">A Cobrar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-100">
                  {pendingCollections.map(({ ev, producer, pending }) => (
                    <tr key={ev.id} className="hover:bg-orange-50 transition-colors">
                      <td className="py-2.5 px-3">
                        {producer ? (
                          <Link
                            href={`/dashboard/producers/${producer.id}`}
                            className="font-medium text-gray-800 hover:text-orange-700 hover:underline"
                          >
                            {producer.full_name}
                          </Link>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 max-w-[220px] truncate">{ev.name}</td>
                      <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">
                        {new Date(ev.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-orange-700 whitespace-nowrap">
                        {formatCurrency(pending)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-orange-200">
                  <tr>
                    <td colSpan={3} className="py-2 px-3 text-xs font-semibold text-orange-700">Total pendente</td>
                    <td className="py-2 px-3 text-right font-bold text-orange-700">
                      {formatCurrency(pendingCollections.reduce((s, x) => s + x.pending, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Produtores</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{producers.length}</p>
              </div>
              <Users className="h-5 w-5 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Receita Total</p>
                <p className="text-xl font-bold text-green-600 mt-0.5">{formatCurrency(globalTotalRevenue)}</p>
              </div>
              <TrendingUp className="h-5 w-5 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">A Pagar</p>
                <p className="text-xl font-bold text-blue-600 mt-0.5">{formatCurrency(globalToPay)}</p>
              </div>
              <Trophy className="h-5 w-5 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Total Devendo</p>
                <p className="text-xl font-bold text-red-600 mt-0.5">{formatCurrency(globalOwed)}</p>
              </div>
              <TrendingDown className="h-5 w-5 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Sellers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Melhores Produtores (Maior Receita)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSellers.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">Nenhum dado disponível</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={sellersData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v) => [formatCurrency(Number(v)), 'Receita']}
                      labelFormatter={(_, p) => p?.[0]?.payload?.fullName ?? ''}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {sellersData.map((_, i) => (
                        <Cell key={i} fill={i < 3 ? MEDAL_COLORS[i] : '#3b82f6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {topSellers.map((s, i) => (
                    <div key={s.producer.id} className="flex items-center gap-3">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: i < 3 ? MEDAL_COLORS[i] : '#60a5fa' }}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm text-gray-700 truncate">{s.producer.full_name}</span>
                      <span className="text-sm font-semibold text-green-600 shrink-0">{formatCurrency(s.totalRevenue)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Worst Debtors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Maiores Devedores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {worstDebtors.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">
                Nenhum produtor com saldo devedor
              </p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={debtorsData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v) => [formatCurrency(Number(v)), 'Dívida']}
                      labelFormatter={(_, p) => p?.[0]?.payload?.fullName ?? ''}
                    />
                    <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {worstDebtors.map((s, i) => (
                    <div key={s.producer.id} className="flex items-center gap-3">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: `hsl(0,${65 + i * 3}%,${58 - i * 4}%)` }}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm text-gray-700 truncate">{s.producer.full_name}</span>
                      <span className="text-sm font-semibold text-red-600 shrink-0">
                        −{formatCurrency(Math.abs(s.balance))}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
