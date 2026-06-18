'use client'

import { useMemo, useState } from 'react'
import { Transaction } from '@/lib/types'
import { formatCurrency, getCurrentMonthYear, getMonthName } from '@/lib/utils/format'
import { CATEGORY_COLORS } from '@/lib/utils/colors'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import RecentTransactions from './RecentTransactions'

interface Props {
  transactions: Transaction[]
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

export default function DashboardClient({ transactions }: Props) {
  const { month: curMonth, year: curYear } = getCurrentMonthYear()
  const [selectedMonth, setSelectedMonth] = useState(String(curMonth))
  const [selectedYear, setSelectedYear] = useState(String(curYear))

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const [y, m] = t.date.split('-')
      return Number(m) === Number(selectedMonth) && Number(y) === Number(selectedYear)
    })
  }, [transactions, selectedMonth, selectedYear])

  const totalReceita = filtered.filter((t) => t.type === 'receita').reduce((s, t) => s + t.amount, 0)
  const totalDespesa = filtered.filter((t) => t.type === 'despesa').reduce((s, t) => s + t.amount, 0)
  const saldo = totalReceita - totalDespesa

  const categoryData = useMemo(() => {
    const despesas = filtered.filter((t) => t.type === 'despesa')
    const map: Record<string, number> = {}
    despesas.forEach((t) => {
      map[t.category] = (map[t.category] ?? 0) + t.amount
    })
    return Object.entries(map).map(([name, value]) => ({
      name,
      value,
      color: CATEGORY_COLORS[name] ?? '#6b7280',
    }))
  }, [filtered])

  const barData = useMemo(() => {
    return [
      { name: 'Receitas', value: totalReceita, fill: '#22c55e' },
      { name: 'Despesas', value: totalDespesa, fill: '#ef4444' },
      { name: 'Saldo', value: saldo, fill: saldo >= 0 ? '#3b82f6' : '#f97316' },
    ]
  }, [totalReceita, totalDespesa, saldo])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Resumo de {getMonthName(Number(selectedMonth))} {selectedYear}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedMonth} onValueChange={(v) => v && setSelectedMonth(v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {getMonthName(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={(v) => v && setSelectedYear(v)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Receitas</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalReceita)}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-full">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Despesas</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalDespesa)}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-full">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Saldo</p>
                <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {formatCurrency(saldo)}
                </p>
              </div>
              <div className={`p-3 rounded-full ${saldo >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                <Wallet className={`h-5 w-5 ${saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                Nenhuma despesa neste período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visão Geral</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent */}
      <RecentTransactions transactions={filtered.slice(0, 5)} />
    </div>
  )
}
