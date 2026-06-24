'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Check, X, Lock, RefreshCw, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { CATEGORY_COLORS } from '@/lib/types'
import type { Category, RecurringExpense } from '@/lib/types'

interface Props {
  producerCategories: Category[]
  platformCategories: Category[]
  recurringExpenses: RecurringExpense[]
  userId: string
}

const COLOR_OPTIONS = [
  { key: 'green', label: 'Verde' }, { key: 'blue', label: 'Azul' },
  { key: 'orange', label: 'Laranja' }, { key: 'purple', label: 'Roxo' },
  { key: 'yellow', label: 'Amarelo' }, { key: 'teal', label: 'Verde-azul' },
  { key: 'red', label: 'Vermelho' }, { key: 'pink', label: 'Rosa' },
  { key: 'indigo', label: 'Índigo' }, { key: 'gray', label: 'Cinza' },
]

type Tab = 'producer' | 'platform' | 'recurring'
type EntryTypeFilter = 'credito' | 'debito' | 'ambos'
interface CatForm { name: string; entry_type: EntryTypeFilter; color: string }
const EMPTY_CAT: CatForm = { name: '', entry_type: 'credito', color: 'green' }

interface RecurringForm { description: string; category: string; amount: string; billing_day: string }
const EMPTY_REC: RecurringForm = { description: '', category: 'infraestrutura', amount: '', billing_day: '1' }

function slugify(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {COLOR_OPTIONS.map(c => (
        <button key={c.key} title={c.label} type="button"
          onClick={() => onChange(c.key)}
          className={`w-5 h-5 rounded-full border-2 transition-all ${CATEGORY_COLORS[c.key]?.split(' ')[0].replace('100', '400') ?? ''} ${value === c.key ? 'border-gray-700 scale-110' : 'border-transparent'}`}
        />
      ))}
    </div>
  )
}

export default function CategoriasClient({ producerCategories, platformCategories, recurringExpenses: initialRecurring, userId }: Props) {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('producer')
  const [prodCats, setProdCats] = useState<Category[]>(producerCategories)
  const [platCats, setPlatCats] = useState<Category[]>(platformCategories)
  const [recurring, setRecurring] = useState<RecurringExpense[]>(initialRecurring)

  // ── Category state ──────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<CatForm>(EMPTY_CAT)
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatForm, setNewCatForm] = useState<CatForm>(EMPTY_CAT)
  const [savingCat, setSavingCat] = useState(false)

  // ── Recurring state ─────────────────────────────────────────
  const [showNewRec, setShowNewRec] = useState(false)
  const [newRecForm, setNewRecForm] = useState<RecurringForm>(EMPTY_REC)
  const [editingRecId, setEditingRecId] = useState<string | null>(null)
  const [editRecForm, setEditRecForm] = useState<RecurringForm>(EMPTY_REC)
  const [savingRec, setSavingRec] = useState(false)
  const [launching, setLaunching] = useState<string | null>(null)

  const currentCats = tab === 'producer' ? prodCats : platCats
  const setCats = tab === 'producer' ? setProdCats : setPlatCats
  const currentScope: 'producer' | 'platform' = tab === 'producer' ? 'producer' : 'platform'

  // Platform categories for recurring expense select
  const platExpenses = platCats.filter(c => c.entry_type === 'debito' || c.entry_type === 'ambos')

  // ── Category CRUD ───────────────────────────────────────────
  async function toggleActive(cat: Category) {
    const { error } = await supabase.from('categories').update({ is_active: !cat.is_active }).eq('id', cat.id)
    if (error) { toast.error(error.message); return }
    setCats(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: !c.is_active } : c))
  }

  async function saveEditCat(cat: Category) {
    if (!editForm.name.trim()) { toast.error('Nome obrigatório'); return }
    setSavingCat(true)
    const { error } = await supabase.from('categories').update({ name: editForm.name.trim(), color: editForm.color }).eq('id', cat.id)
    setSavingCat(false)
    if (error) { toast.error(error.message); return }
    setCats(prev => prev.map(c => c.id === cat.id ? { ...c, name: editForm.name.trim(), color: editForm.color } : c))
    setEditingId(null)
    toast.success('Categoria atualizada')
  }

  async function deleteCat(cat: Category) {
    if (!confirm(`Excluir "${cat.name}"?`)) return
    const { error } = await supabase.from('categories').delete().eq('id', cat.id)
    if (error) { toast.error(error.message); return }
    setCats(prev => prev.filter(c => c.id !== cat.id))
    toast.success('Categoria excluída')
  }

  async function createCat() {
    if (!newCatForm.name.trim()) { toast.error('Nome obrigatório'); return }
    const slug = slugify(newCatForm.name) + '_' + currentScope
    setSavingCat(true)
    const { data, error } = await supabase.from('categories').insert({
      user_id: userId, slug, name: newCatForm.name.trim(),
      entry_type: newCatForm.entry_type, color: newCatForm.color,
      is_active: true, is_system: false, sort_order: 99, scope: currentScope,
    }).select().single()
    setSavingCat(false)
    if (error) { toast.error(error.message); return }
    setCats(prev => [...prev, data as Category])
    setNewCatForm(EMPTY_CAT)
    setShowNewCat(false)
    toast.success('Categoria criada')
  }

  // ── Recurring CRUD ──────────────────────────────────────────
  async function createRecurring() {
    if (!newRecForm.description.trim()) { toast.error('Descrição obrigatória'); return }
    const amount = parseFloat(newRecForm.amount)
    if (!amount || amount <= 0) { toast.error('Valor inválido'); return }
    setSavingRec(true)
    const { data, error } = await supabase.from('recurring_expenses').insert({
      user_id: userId, description: newRecForm.description.trim(),
      category: newRecForm.category, amount,
      billing_day: parseInt(newRecForm.billing_day) || 1,
      is_active: true,
    }).select().single()
    setSavingRec(false)
    if (error) { toast.error(error.message); return }
    setRecurring(prev => [...prev, data as RecurringExpense])
    setNewRecForm(EMPTY_REC)
    setShowNewRec(false)
    toast.success('Despesa recorrente criada')
  }

  async function saveEditRec(rec: RecurringExpense) {
    if (!editRecForm.description.trim()) { toast.error('Descrição obrigatória'); return }
    const amount = parseFloat(editRecForm.amount)
    if (!amount || amount <= 0) { toast.error('Valor inválido'); return }
    setSavingRec(true)
    const { error } = await supabase.from('recurring_expenses').update({
      description: editRecForm.description.trim(), category: editRecForm.category,
      amount, billing_day: parseInt(editRecForm.billing_day) || 1,
    }).eq('id', rec.id)
    setSavingRec(false)
    if (error) { toast.error(error.message); return }
    setRecurring(prev => prev.map(r => r.id === rec.id ? {
      ...r, description: editRecForm.description.trim(), category: editRecForm.category,
      amount, billing_day: parseInt(editRecForm.billing_day) || 1,
    } : r))
    setEditingRecId(null)
    toast.success('Atualizado')
  }

  async function toggleRec(rec: RecurringExpense) {
    const { error } = await supabase.from('recurring_expenses').update({ is_active: !rec.is_active }).eq('id', rec.id)
    if (error) { toast.error(error.message); return }
    setRecurring(prev => prev.map(r => r.id === rec.id ? { ...r, is_active: !r.is_active } : r))
  }

  async function deleteRec(rec: RecurringExpense) {
    if (!confirm(`Excluir despesa "${rec.description}"?`)) return
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', rec.id)
    if (error) { toast.error(error.message); return }
    setRecurring(prev => prev.filter(r => r.id !== rec.id))
    toast.success('Excluído')
  }

  async function launchExpense(rec: RecurringExpense) {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(Math.min(rec.billing_day, new Date(year, today.getMonth() + 1, 0).getDate())).padStart(2, '0')
    const date = `${year}-${month}-${day}`

    setLaunching(rec.id)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Não autenticado'); setLaunching(null); return }

    const { error } = await supabase.from('platform_entries').insert({
      user_id: user.id, entry_type: 'despesa', category: rec.category,
      description: rec.description, amount: rec.amount, date,
    })
    setLaunching(null)
    if (error) { toast.error(error.message); return }
    toast.success(`Lançado em ${day}/${month}/${year} na Bilheteria Express`)
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'producer', label: 'Produtores' },
    { key: 'platform', label: 'Bilheteria Express' },
    { key: 'recurring', label: 'Despesas Recorrentes' },
  ]

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setShowNewCat(false); setShowNewRec(false) }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Categorias (producer / platform) ── */}
      {(tab === 'producer' || tab === 'platform') && (
        <div className="space-y-4">
          {/* Nova categoria */}
          <div className="bg-white rounded-xl border p-4">
            {!showNewCat ? (
              <Button onClick={() => setShowNewCat(true)} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Nova Categoria
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="font-medium text-sm text-gray-700">Nova Categoria — {tab === 'producer' ? 'Produtores' : 'Bilheteria Express'}</p>
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-xs text-gray-500 mb-1 block">Nome</label>
                    <Input value={newCatForm.name} onChange={e => setNewCatForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="Ex: Patrocínio" className="h-8 text-sm" autoFocus
                      onKeyDown={e => e.key === 'Enter' && createCat()} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
                    <select value={newCatForm.entry_type} onChange={e => setNewCatForm(p => ({ ...p, entry_type: e.target.value as EntryTypeFilter }))}
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                      <option value="credito">Receita</option>
                      <option value="debito">Despesa</option>
                      <option value="ambos">Ambos</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Cor</label>
                    <ColorPicker value={newCatForm.color} onChange={v => setNewCatForm(p => ({ ...p, color: v }))} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={createCat} disabled={savingCat}><Check className="h-4 w-4 mr-1" />Criar</Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowNewCat(false); setNewCatForm(EMPTY_CAT) }}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Colunas receitas / despesas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {(['credito', 'debito'] as const).map(type => {
              const label = type === 'credito' ? 'Receitas' : 'Despesas'
              const filtered = currentCats.filter(c => c.entry_type === type || c.entry_type === 'ambos')
              return (
                <div key={type} className="bg-white rounded-xl border overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b">
                    <h2 className="font-semibold text-sm text-gray-700">{label}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{filtered.length} categoria{filtered.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="divide-y">
                    {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Nenhuma categoria</p>}
                    {filtered.map(cat => (
                      <div key={cat.id} className={`px-4 py-3 ${!cat.is_active ? 'opacity-50' : ''}`}>
                        {editingId === cat.id ? (
                          <div className="flex flex-wrap gap-2 items-center">
                            <Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                              className="h-7 text-sm flex-1 min-w-[120px]" autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') saveEditCat(cat); if (e.key === 'Escape') setEditingId(null) }} />
                            <ColorPicker value={editForm.color} onChange={v => setEditForm(p => ({ ...p, color: v }))} />
                            <button onClick={() => saveEditCat(cat)} disabled={savingCat} className="text-green-600 hover:text-green-700 p-1"><Check className="h-4 w-4" /></button>
                            <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-4 w-4" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button onClick={() => toggleActive(cat)} title={cat.is_active ? 'Desativar' : 'Ativar'}>
                              <Badge className={`text-xs cursor-pointer ${CATEGORY_COLORS[cat.color] ?? CATEGORY_COLORS.gray}`}>{cat.name}</Badge>
                            </button>
                            {cat.entry_type === 'ambos' && <span className="text-xs text-gray-400">receita/despesa</span>}
                            {cat.is_system && <span title="Categoria do sistema"><Lock className="h-3 w-3 text-gray-300" /></span>}
                            <div className="ml-auto flex gap-1">
                              <button onClick={() => { setEditingId(cat.id); setEditForm({ name: cat.name, entry_type: cat.entry_type, color: cat.color }) }}
                                className="p-1 text-gray-400 hover:text-gray-700 rounded"><Pencil className="h-3.5 w-3.5" /></button>
                              {!cat.is_system && (
                                <button onClick={() => deleteCat(cat)} className="p-1 text-gray-400 hover:text-red-600 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Despesas Recorrentes ── */}
      {tab === 'recurring' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500 mb-3">
              Despesas que se repetem todo mês. Use <strong>"Lançar agora"</strong> para inserir o valor do mês corrente diretamente na Bilheteria Express.
            </p>
            {!showNewRec ? (
              <Button onClick={() => setShowNewRec(true)} size="sm"><Plus className="h-4 w-4 mr-1" />Nova Despesa Recorrente</Button>
            ) : (
              <div className="space-y-3 pt-2 border-t mt-3">
                <p className="font-medium text-sm text-gray-700">Nova Despesa Recorrente</p>
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-xs text-gray-500 mb-1 block">Descrição</label>
                    <Input value={newRecForm.description} onChange={e => setNewRecForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="Ex: Aluguel do sistema" className="h-8 text-sm" autoFocus />
                  </div>
                  <div className="min-w-[160px]">
                    <label className="text-xs text-gray-500 mb-1 block">Categoria</label>
                    <select value={newRecForm.category} onChange={e => setNewRecForm(p => ({ ...p, category: e.target.value }))}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
                      {platExpenses.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="w-28">
                    <label className="text-xs text-gray-500 mb-1 block">Valor (R$)</label>
                    <Input value={newRecForm.amount} onChange={e => setNewRecForm(p => ({ ...p, amount: e.target.value }))}
                      placeholder="0,00" className="h-8 text-sm" type="number" min="0" step="0.01" />
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-gray-500 mb-1 block">Dia do mês</label>
                    <Input value={newRecForm.billing_day} onChange={e => setNewRecForm(p => ({ ...p, billing_day: e.target.value }))}
                      className="h-8 text-sm" type="number" min="1" max="28" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={createRecurring} disabled={savingRec}><Check className="h-4 w-4 mr-1" />Criar</Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowNewRec(false); setNewRecForm(EMPTY_REC) }}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <h2 className="font-semibold text-sm text-gray-700">Despesas Recorrentes</h2>
              <p className="text-xs text-gray-400 mt-0.5">{recurring.length} despesa{recurring.length !== 1 ? 's' : ''} cadastrada{recurring.length !== 1 ? 's' : ''}</p>
            </div>
            {recurring.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">Nenhuma despesa recorrente cadastrada</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Descrição</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Categoria</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Valor</th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500">Dia</th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500">Ativo</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recurring.map(rec => (
                      <tr key={rec.id} className={`hover:bg-gray-50 ${!rec.is_active ? 'opacity-50' : ''}`}>
                        {editingRecId === rec.id ? (
                          <td colSpan={6} className="px-4 py-3">
                            <div className="flex flex-wrap gap-2 items-center">
                              <Input value={editRecForm.description} onChange={e => setEditRecForm(p => ({ ...p, description: e.target.value }))}
                                className="h-7 text-sm flex-1 min-w-[140px]" autoFocus />
                              <select value={editRecForm.category} onChange={e => setEditRecForm(p => ({ ...p, category: e.target.value }))}
                                className="h-7 rounded border border-input bg-background px-2 text-sm">
                                {platExpenses.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                              </select>
                              <Input value={editRecForm.amount} onChange={e => setEditRecForm(p => ({ ...p, amount: e.target.value }))}
                                className="h-7 text-sm w-24" type="number" min="0" step="0.01" placeholder="Valor" />
                              <Input value={editRecForm.billing_day} onChange={e => setEditRecForm(p => ({ ...p, billing_day: e.target.value }))}
                                className="h-7 text-sm w-16" type="number" min="1" max="28" />
                              <button onClick={() => saveEditRec(rec)} disabled={savingRec} className="text-green-600 p-1"><Check className="h-4 w-4" /></button>
                              <button onClick={() => setEditingRecId(null)} className="text-gray-400 p-1"><X className="h-4 w-4" /></button>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-3 font-medium text-gray-800">{rec.description}</td>
                            <td className="px-4 py-3 text-gray-500">
                              {platExpenses.find(c => c.slug === rec.category)?.name ?? rec.category}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-red-600">
                              {Number(rec.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-500">Dia {rec.billing_day}</td>
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => toggleRec(rec)}
                                className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${rec.is_active ? 'bg-blue-600' : 'bg-gray-200'}`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${rec.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => launchExpense(rec)} disabled={!rec.is_active || launching === rec.id}
                                  title="Lançar no mês atual na Bilheteria Express"
                                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40 transition-colors">
                                  {launching === rec.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                                  Lançar agora
                                </button>
                                <button onClick={() => { setEditingRecId(rec.id); setEditRecForm({ description: rec.description, category: rec.category, amount: String(rec.amount), billing_day: String(rec.billing_day) }) }}
                                  className="p-1 text-gray-400 hover:text-gray-700"><Pencil className="h-3.5 w-3.5" /></button>
                                <button onClick={() => deleteRec(rec)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
