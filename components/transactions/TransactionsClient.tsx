'use client'

import { useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Transaction, TransactionFormData, CATEGORIES, TxCategory as Category } from '@/lib/types'
import { formatCurrency, formatDate, getCurrentMonthYear, getMonthName } from '@/lib/utils/format'
import { CATEGORY_COLORS } from '@/lib/utils/colors'
import { exportToCSV } from '@/lib/utils/csv'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Download, Search, Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'
import TransactionDialog from './TransactionDialog'
import DeleteDialog from './DeleteDialog'

interface Props {
  initialTransactions: Transaction[]
  userId: string
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

export default function TransactionsClient({ initialTransactions, userId }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const { month: curMonth, year: curYear } = getCurrentMonthYear()
  const [selectedMonth, setSelectedMonth] = useState(String(curMonth))
  const [selectedYear, setSelectedYear] = useState(String(curYear))
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const [y, m] = t.date.split('-')
      const monthMatch = Number(m) === Number(selectedMonth) && Number(y) === Number(selectedYear)
      const searchMatch = t.description.toLowerCase().includes(search.toLowerCase())
      const categoryMatch = categoryFilter === 'all' || t.category === categoryFilter
      const typeMatch = typeFilter === 'all' || t.type === typeFilter
      return monthMatch && searchMatch && categoryMatch && typeMatch
    })
  }, [transactions, selectedMonth, selectedYear, search, categoryFilter, typeFilter])

  const handleSave = useCallback(async (data: TransactionFormData) => {
    const supabase = createClient()

    if (editingTransaction) {
      const { data: updated, error } = await supabase
        .from('transactions')
        .update(data)
        .eq('id', editingTransaction.id)
        .select()
        .single()

      if (error) { toast.error('Erro ao atualizar transação.'); return }
      setTransactions((prev) => prev.map((t) => (t.id === editingTransaction.id ? updated : t)))
      toast.success('Transação atualizada!')
    } else {
      const { data: created, error } = await supabase
        .from('transactions')
        .insert({ ...data, user_id: userId })
        .select()
        .single()

      if (error) { toast.error('Erro ao criar transação.'); return }
      setTransactions((prev) => [created, ...prev])
      toast.success('Transação criada!')
    }

    setDialogOpen(false)
    setEditingTransaction(null)
  }, [editingTransaction, userId])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    const supabase = createClient()
    const { error } = await supabase.from('transactions').delete().eq('id', deleteTarget.id)

    if (error) { toast.error('Erro ao excluir transação.'); return }
    setTransactions((prev) => prev.filter((t) => t.id !== deleteTarget.id))
    toast.success('Transação excluída!')
    setDeleteTarget(null)
  }, [deleteTarget])

  function openCreate() {
    setEditingTransaction(null)
    setDialogOpen(true)
  }

  function openEdit(t: Transaction) {
    setEditingTransaction(t)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transações</h1>
          <p className="text-gray-500 text-sm mt-1">
            {getMonthName(Number(selectedMonth))} {selectedYear} — {filtered.length} transações
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToCSV(filtered)} className="gap-2">
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Transação
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-52"
          />
        </div>
        <Select value={selectedMonth} onValueChange={(v) => v && setSelectedMonth(v)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem key={m} value={String(m)}>{getMonthName(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedYear} onValueChange={(v) => v && setSelectedYear(v)}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="receita">Receitas</SelectItem>
            <SelectItem value="despesa">Despesas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => v && setCategoryFilter(v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table / List */}
      {filtered.length === 0 ? (
        <div className="bg-white border rounded-xl py-16 text-center">
          <p className="text-gray-400">Nenhuma transação encontrada</p>
          <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
            <Plus className="h-4 w-4" /> Adicionar transação
          </Button>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Descrição</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Categoria</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Data</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Tipo</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Valor</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{t.description}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium"
                        style={{
                          backgroundColor: `${CATEGORY_COLORS[t.category]}18`,
                          color: CATEGORY_COLORS[t.category],
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[t.category] }}
                        />
                        {t.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(t.date)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                          t.type === 'receita' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {t.type === 'receita' ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {t.type === 'receita' ? 'Receita' : 'Despesa'}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        t.type === 'receita' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {t.type === 'receita' ? '+' : '-'}{formatCurrency(t.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(t)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteTarget(t)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y">
            {filtered.map((t) => (
              <div key={t.id} className="p-4 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[t.category] ?? '#6b7280' }}
                  />
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{t.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t.category} · {formatDate(t.date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      t.type === 'receita' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {t.type === 'receita' ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500"
                    onClick={() => setDeleteTarget(t)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingTransaction(null) }}
        onSave={handleSave}
        editingTransaction={editingTransaction}
      />

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}
        onConfirm={handleDelete}
        description={deleteTarget?.description}
      />
    </div>
  )
}
