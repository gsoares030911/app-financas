'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet, Search } from 'lucide-react'
import { toast } from 'sonner'
import { PLATFORM_CATEGORY_LABELS } from '@/lib/types'
import type { PlatformEntry } from '@/lib/types'
import PlatformEntryDialog from './PlatformEntryDialog'

interface Props {
  initialEntries: PlatformEntry[]
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function BilheteriaClient({ initialEntries }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [entries, setEntries] = useState<PlatformEntry[]>(initialEntries)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PlatformEntry | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'receita' | 'despesa'>('all')

  const totalReceita = entries.filter(e => e.entry_type === 'receita').reduce((s, e) => s + Number(e.amount), 0)
  const totalDespesa = entries.filter(e => e.entry_type === 'despesa').reduce((s, e) => s + Number(e.amount), 0)
  const saldo = totalReceita - totalDespesa

  const filtered = useMemo(() => {
    return entries
      .filter(e => filterType === 'all' || e.entry_type === filterType)
      .filter(e => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return (
          e.description.toLowerCase().includes(q) ||
          PLATFORM_CATEGORY_LABELS[e.category].toLowerCase().includes(q)
        )
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [entries, filterType, search])

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

  return (
    <div className="space-y-6">
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
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-8 h-8 text-sm"
              />
            </div>
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
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">Data</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Descrição</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">Categoria</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 w-32">Valor</th>
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
                      {PLATFORM_CATEGORY_LABELS[entry.category]}
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
