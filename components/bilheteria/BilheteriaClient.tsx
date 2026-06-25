'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet, Search, Upload, ChevronUp, ChevronDown, ChevronsUpDown, RefreshCw, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { PLATFORM_CATEGORY_LABELS } from '@/lib/types'
import type { PlatformEntry } from '@/lib/types'
import PlatformEntryDialog from './PlatformEntryDialog'
import DateRangePicker from '@/components/shared/DateRangePicker'
import type { DateRange } from 'react-day-picker'

interface Props {
  initialEntries: PlatformEntry[]
  needsRenewal?: boolean
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function BilheteriaClient({ initialEntries, needsRenewal = false }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [renewalDismissed, setRenewalDismissed] = useState(false)
  const [renewing, setRenewing] = useState(false)

  const [entries, setEntries] = useState<PlatformEntry[]>(initialEntries)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PlatformEntry | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'receita' | 'despesa'>('all')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  type BilhSortCol = 'date' | 'description' | 'category' | 'amount'
  const [sort, setSort] = useState<{ col: BilhSortCol; dir: 'asc' | 'desc' }>({ col: 'date', dir: 'desc' })
  function toggleSort(col: BilhSortCol) {
    setSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }
  function SortIcon({ col }: { col: BilhSortCol }) {
    if (sort.col !== col) return <ChevronsUpDown className="h-3 w-3 ml-1 text-gray-400" />
    return sort.dir === 'asc'
      ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" />
      : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />
  }

  const filtered = useMemo(() => {
    const base = entries
      .filter(e => filterType === 'all' || e.entry_type === filterType)
      .filter(e => {
        if (!dateRange?.from) return true
        const d = new Date(e.date + 'T12:00:00')
        if (dateRange.to) return d >= dateRange.from && d <= dateRange.to
        return d >= dateRange.from
      })
      .filter(e => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return (
          e.description.toLowerCase().includes(q) ||
          (PLATFORM_CATEGORY_LABELS[e.category] ?? e.category).toLowerCase().includes(q)
        )
      })
    return base.sort((a, b) => {
      let cmp = 0
      if (sort.col === 'date') cmp = a.date.localeCompare(b.date)
      else if (sort.col === 'description') cmp = a.description.localeCompare(b.description)
      else if (sort.col === 'category') cmp = PLATFORM_CATEGORY_LABELS[a.category].localeCompare(PLATFORM_CATEGORY_LABELS[b.category])
      else if (sort.col === 'amount') cmp = Number(a.amount) - Number(b.amount)
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [entries, filterType, search, sort, dateRange])

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(entry: PlatformEntry) {
    setEditing(entry)
    setDialogOpen(true)
  }

  async function handleDelete(entry: PlatformEntry) {
    if (!confirm(`Excluir "${entry.description}"?`)) return
    const { error } = await supabase.from('platform_entries').delete().eq('id', entry.id)
    if (error) { toast.error(error.message); return }
    setEntries(prev => prev.filter(e => e.id !== entry.id))
    toast.success('Lançamento excluído')
  }

  function handleSaved() {
    router.refresh()
    // Re-fetch local state from router refresh
    setDialogOpen(false)
  }

  // After dialog saves, refresh local list from server
  async function refreshEntries() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('platform_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
    if (data) setEntries(data as PlatformEntry[])
  }

  async function handleRenewYear() {
    setRenewing(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setRenewing(false); return }
    // Reseta last_launched_month para que o auto-lançamento retome no novo ano
    await supabase
      .from('recurring_expenses')
      .update({ last_launched_month: null })
      .eq('user_id', user.id)
      .eq('is_active', true)
    setRenewing(false)
    toast.success(`Despesas recorrentes ativadas para ${new Date().getFullYear()}!`)
    router.refresh()
  }

  const totalReceita = filtered.filter(e => e.entry_type === 'receita').reduce((s, e) => s + Number(e.amount), 0)
  const totalDespesa = filtered.filter(e => e.entry_type === 'despesa').reduce((s, e) => s + Number(e.amount), 0)
  const saldo = totalReceita - totalDespesa

  return (
    <div className="space-y-6">
      {/* Banner de renovação anual */}
      {needsRenewal && !renewalDismissed && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              Despesas recorrentes pausadas
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Os lançamentos automáticos estavam configurados até dezembro de 2026.
              Deseja continuar os lançamentos mensais em {new Date().getFullYear()}?
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleRenewYear}
              disabled={renewing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition-colors disabled:opacity-60"
            >
              {renewing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Ativar {new Date().getFullYear()}
            </button>
            <button
              onClick={() => setRenewalDismissed(true)}
              className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
            >
              Agora não
            </button>
          </div>
        </div>
      )}

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="bg-green-50 rounded-full p-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Receitas</p>
            <p className="text-lg font-bold text-green-700">{fmt(totalReceita)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="bg-red-50 rounded-full p-2">
            <TrendingDown className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Despesas</p>
            <p className="text-lg font-bold text-red-600">{fmt(totalDespesa)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className={`rounded-full p-2 ${saldo >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
            <Wallet className={`h-5 w-5 ${saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Saldo</p>
            <p className={`text-lg font-bold ${saldo >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>{fmt(saldo)}</p>
          </div>
        </div>
      </div>

      {/* Barra de ações */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {(['all', 'receita', 'despesa'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  filterType === t
                    ? t === 'receita'
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : t === 'despesa'
                        ? 'bg-red-50 border-red-300 text-red-700'
                        : 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t === 'all' ? 'Todos' : t === 'receita' ? 'Receitas' : 'Despesas'}
              </button>
            ))}
          </div>
          <div className="flex gap-2 w-full sm:w-auto flex-wrap">
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              align="end"
            />
            <div className="relative flex-1 sm:w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Link href="/dashboard/bilheteria/import">
              <Button size="sm" variant="outline">
                <Upload className="h-4 w-4 mr-1" />
                Importar
              </Button>
            </Link>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum lançamento encontrado</p>
            <p className="text-sm mt-1">Clique em &quot;Novo&quot; para adicionar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  {(
                    [
                      { col: 'date', label: 'Data', cls: 'w-24 text-left' },
                      { col: 'description', label: 'Descrição', cls: 'text-left' },
                      { col: 'category', label: 'Categoria', cls: 'text-left hidden sm:table-cell' },
                      { col: 'amount', label: 'Valor', cls: 'text-right w-32' },
                    ] as { col: BilhSortCol; label: string; cls: string }[]
                  ).map(({ col, label, cls }) => (
                    <th
                      key={col}
                      onClick={() => toggleSort(col)}
                      className={`px-4 py-3 font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors ${cls}`}
                    >
                      <span className={`inline-flex items-center gap-0.5 ${cls.includes('text-right') ? 'justify-end w-full' : ''}`}>
                        {label}
                        <SortIcon col={col} />
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium text-gray-600 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-xs shrink-0 ${
                            entry.entry_type === 'receita'
                              ? 'border-green-200 text-green-700 bg-green-50'
                              : 'border-red-200 text-red-700 bg-red-50'
                          }`}
                        >
                          {entry.entry_type === 'receita' ? '+' : '−'}
                        </Badge>
                        <span className="font-medium text-gray-800 truncate max-w-[200px]">{entry.description}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                      {PLATFORM_CATEGORY_LABELS[entry.category] ?? entry.category}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
                      entry.entry_type === 'receita' ? 'text-green-700' : 'text-red-600'
                    }`}>
                      {entry.entry_type === 'receita' ? '+' : '−'} {fmt(Number(entry.amount))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(entry)}
                          className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PlatformEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editing}
        onSaved={refreshEntries}
      />
    </div>
  )
}
