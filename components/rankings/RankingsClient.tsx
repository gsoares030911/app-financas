'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/format'
import { Trophy, TrendingDown, Users, TrendingUp } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { Producer, AccountEntry, ProducerEvent } from '@/lib/types'

interface Props {
  producers: Producer[]
  entries: Pick<AccountEntry, 'producer_id' | 'entry_type' | 'amount'>[]
  events: Pick<ProducerEvent, 'producer_id' | 'gross_revenue' | 'net_amount' | 'status'>[]
}

const MEDAL_COLORS = ['#f59e0b', '#9ca3af', '#d97706']

export default function RankingsClient({ producers, entries, events }: Props) {
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
        <h1 className="text-2xl font-bold text-gray-900">Rankings</h1>
        <p className="text-gray-500 text-sm mt-1">Performance dos produtores culturais</p>
      </div>

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
