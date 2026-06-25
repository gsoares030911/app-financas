'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronRight, Users, List } from 'lucide-react'
import { Input } from '@/components/ui/input'
import DateRangePicker from '@/components/shared/DateRangePicker'
import type { DateRange } from 'react-day-picker'
import type { AuditLog } from '@/lib/types'

const TABLE_LABELS: Record<string, string> = {
  events:              'Eventos',
  account_entries:     'Conta Corrente',
  producers:           'Produtores',
  payment_orders:      'Ordens de Pagamento',
  platform_entries:    'Bilheteria Express',
  recurring_expenses:  'Despesas Recorrentes',
  categories:          'Categorias',
  equipment_rentals:   'Aluguel de Equipamentos',
}

const ACTION_CONFIG = {
  INSERT: { label: 'Inclusão',  bg: 'bg-green-100',  text: 'text-green-700'  },
  UPDATE: { label: 'Alteração', bg: 'bg-blue-100',   text: 'text-blue-700'   },
  DELETE: { label: 'Exclusão',  bg: 'bg-red-100',    text: 'text-red-700'    },
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function getSummary(log: AuditLog): string {
  const data = log.action === 'DELETE' ? log.old_data : log.new_data
  if (!data) return log.record_id ?? '—'

  switch (log.table_name) {
    case 'events':           return String(data.name ?? data.id ?? '—')
    case 'producers':        return String(data.full_name ?? data.id ?? '—')
    case 'account_entries':  return String(data.description ?? data.category ?? '—')
    case 'payment_orders':   return String(data.order_number ?? data.id ?? '—')
    case 'platform_entries': return String(data.description ?? data.category ?? '—')
    case 'recurring_expenses': return String(data.description ?? '—')
    case 'categories':       return String(data.name ?? '—')
    case 'equipment_rentals': return String(data.equipment_name ?? '—')
    default:                 return log.record_id ?? '—'
  }
}

function DiffRow({ label, oldVal, newVal }: { label: string; oldVal: unknown; newVal: unknown }) {
  const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal)
  const fmt = (v: unknown) => v == null ? <span className="text-gray-300 italic">—</span> : String(v)
  return (
    <tr className={changed ? 'bg-yellow-50' : ''}>
      <td className="px-3 py-1.5 text-xs font-medium text-gray-500 whitespace-nowrap">{label}</td>
      {oldVal !== undefined && <td className={`px-3 py-1.5 text-xs ${changed ? 'text-red-600 line-through' : 'text-gray-600'}`}>{fmt(oldVal)}</td>}
      {newVal !== undefined && <td className={`px-3 py-1.5 text-xs ${changed ? 'text-green-700 font-medium' : 'text-gray-600'}`}>{fmt(newVal)}</td>}
    </tr>
  )
}

function LogDetail({ log }: { log: AuditLog }) {
  const old = log.old_data ?? {}
  const nw  = log.new_data ?? {}
  const keys = Array.from(new Set([...Object.keys(old), ...Object.keys(nw)]))
    .filter(k => !['id', 'user_id', 'created_at'].includes(k))

  if (log.action === 'INSERT') {
    return (
      <table className="w-full text-xs">
        <thead><tr className="border-b"><th className="px-3 py-1.5 text-left text-gray-400">Campo</th><th className="px-3 py-1.5 text-left text-gray-400">Valor incluído</th></tr></thead>
        <tbody>
          {keys.map(k => <DiffRow key={k} label={k} oldVal={undefined} newVal={nw[k]} />)}
        </tbody>
      </table>
    )
  }
  if (log.action === 'DELETE') {
    return (
      <table className="w-full text-xs">
        <thead><tr className="border-b"><th className="px-3 py-1.5 text-left text-gray-400">Campo</th><th className="px-3 py-1.5 text-left text-gray-400">Valor excluído</th></tr></thead>
        <tbody>
          {keys.map(k => <DiffRow key={k} label={k} oldVal={old[k]} newVal={undefined} />)}
        </tbody>
      </table>
    )
  }
  return (
    <table className="w-full text-xs">
      <thead><tr className="border-b"><th className="px-3 py-1.5 text-left text-gray-400">Campo</th><th className="px-3 py-1.5 text-left text-gray-400">Antes</th><th className="px-3 py-1.5 text-left text-gray-400">Depois</th></tr></thead>
      <tbody>
        {keys.map(k => <DiffRow key={k} label={k} oldVal={old[k]} newVal={nw[k]} />)}
      </tbody>
    </table>
  )
}

export default function LogsClient({ logs }: { logs: AuditLog[] }) {
  const [search, setSearch]           = useState('')
  const [filterTable, setFilterTable] = useState('all')
  const [filterAction, setFilterAction] = useState<'all' | 'INSERT' | 'UPDATE' | 'DELETE'>('all')
  const [dateRange, setDateRange]     = useState<DateRange | undefined>(undefined)
  const [expanded, setExpanded]       = useState<Set<string>>(new Set())
  const [page, setPage]               = useState(0)
  const [groupByUser, setGroupByUser] = useState(false)
  const [collapsedUsers, setCollapsedUsers] = useState<Set<string>>(new Set())
  const PAGE_SIZE = 50

  const tables = useMemo(() => Array.from(new Set(logs.map(l => l.table_name))).sort(), [logs])

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (filterTable !== 'all' && l.table_name !== filterTable) return false
      if (filterAction !== 'all' && l.action !== filterAction) return false
      if (dateRange?.from) {
        const d = new Date(l.created_at)
        if (d < dateRange.from) return false
        if (dateRange.to) {
          const to = new Date(dateRange.to); to.setHours(23,59,59)
          if (d > to) return false
        }
      }
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          (l.user_email ?? '').toLowerCase().includes(q) ||
          getSummary(l).toLowerCase().includes(q) ||
          (TABLE_LABELS[l.table_name] ?? l.table_name).toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [logs, filterTable, filterAction, dateRange, search])

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  // Agrupamento por usuário
  const groupedByUser = useMemo(() => {
    const map = new Map<string, AuditLog[]>()
    filtered.forEach(l => {
      const key = l.user_email ?? 'sistema'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(l)
    })
    // Ordena pelo usuário com mais ações
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [filtered])

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleUser(email: string) {
    setCollapsedUsers(prev => {
      const next = new Set(prev)
      next.has(email) ? next.delete(email) : next.add(email)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Buscar usuário, registro..." className="pl-8 h-8 text-sm" />
        </div>

        <select value={filterTable} onChange={e => { setFilterTable(e.target.value); setPage(0) }}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">Todas as tabelas</option>
          {tables.map(t => <option key={t} value={t}>{TABLE_LABELS[t] ?? t}</option>)}
        </select>

        <select value={filterAction} onChange={e => { setFilterAction(e.target.value as typeof filterAction); setPage(0) }}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm">
          <option value="all">Todas as ações</option>
          <option value="INSERT">Inclusão</option>
          <option value="UPDATE">Alteração</option>
          <option value="DELETE">Exclusão</option>
        </select>

        <DateRangePicker value={dateRange} onChange={v => { setDateRange(v); setPage(0) }} align="end" />

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setGroupByUser(v => !v)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              groupByUser
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {groupByUser ? <List className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
            {groupByUser ? 'Ver lista' : 'Agrupar por usuário'}
          </button>
        </div>
      </div>

      {/* Visão agrupada por usuário */}
      {groupByUser ? (
        <div className="space-y-3">
          {groupedByUser.length === 0 ? (
            <div className="bg-white rounded-xl border py-16 text-center text-gray-400 text-sm">Nenhum log encontrado</div>
          ) : groupedByUser.map(([email, userLogs]) => {
            const isCollapsed = collapsedUsers.has(email)
            const inserts = userLogs.filter(l => l.action === 'INSERT').length
            const updates = userLogs.filter(l => l.action === 'UPDATE').length
            const deletes = userLogs.filter(l => l.action === 'DELETE').length
            const lastAt  = userLogs[0]?.created_at
            return (
              <div key={email} className="bg-white rounded-xl border overflow-hidden">
                {/* Cabeçalho do grupo */}
                <button
                  onClick={() => toggleUser(email)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                >
                  {isCollapsed
                    ? <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    : <ChevronDown  className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  }
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-700">
                      {email === 'sistema' ? 'S' : email[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {email === 'sistema' ? <span className="italic text-gray-400">sistema</span> : email}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Último acesso: {lastAt ? fmtDateTime(lastAt) : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {inserts > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        {inserts} inclusão{inserts !== 1 ? 'ões' : ''}
                      </span>
                    )}
                    {updates > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {updates} alteração{updates !== 1 ? 'ões' : ''}
                      </span>
                    )}
                    {deletes > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        {deletes} exclusão{deletes !== 1 ? 'ões' : ''}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 ml-1">
                      {userLogs.length} total
                    </span>
                  </div>
                </button>

                {/* Logs do usuário */}
                {!isCollapsed && (
                  <div className="border-t overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="w-8 px-3 py-2" />
                          <th className="px-4 py-2 text-left font-semibold text-gray-500 text-xs whitespace-nowrap">Data / Hora</th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-500 text-xs">Ação</th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-500 text-xs">Módulo</th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-500 text-xs">Registro</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {userLogs.map(log => {
                          const isOpen = expanded.has(log.id)
                          const cfg = ACTION_CONFIG[log.action]
                          return (
                            <>
                              <tr key={log.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => toggleExpand(log.id)}>
                                <td className="px-3 py-2.5 text-gray-400">
                                  {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                </td>
                                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs font-mono">{fmtDateTime(log.created_at)}</td>
                                <td className="px-4 py-2.5">
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                                </td>
                                <td className="px-4 py-2.5 text-gray-600 text-xs whitespace-nowrap">{TABLE_LABELS[log.table_name] ?? log.table_name}</td>
                                <td className="px-4 py-2.5 text-gray-800 text-xs font-medium max-w-[260px] truncate">{getSummary(log)}</td>
                              </tr>
                              {isOpen && (
                                <tr key={`${log.id}-detail`} className="bg-gray-50 border-b">
                                  <td colSpan={5} className="px-8 py-3">
                                    <div className="rounded-lg border bg-white overflow-hidden">
                                      <div className="px-3 py-2 bg-gray-50 border-b text-xs text-gray-400 font-medium">
                                        ID: <span className="font-mono text-gray-600">{log.record_id}</span>
                                      </div>
                                      <LogDetail log={log} />
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <>
          {/* Tabela flat */}
          <div className="bg-white rounded-xl border overflow-hidden">
            {paginated.length === 0 ? (
              <p className="text-center text-gray-400 py-16 text-sm">Nenhum log encontrado</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="w-8 px-3 py-3" />
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Data / Hora</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Usuário</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Ação</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Módulo</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Registro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginated.map(log => {
                      const isOpen = expanded.has(log.id)
                      const cfg = ACTION_CONFIG[log.action]
                      return (
                        <>
                          <tr
                            key={log.id}
                            className="hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => toggleExpand(log.id)}
                          >
                            <td className="px-3 py-3 text-gray-400">
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </td>
                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs font-mono">
                              {fmtDateTime(log.created_at)}
                            </td>
                            <td className="px-4 py-3 text-gray-700 text-xs max-w-[180px] truncate">
                              {log.user_email ?? <span className="text-gray-300 italic">sistema</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                              {TABLE_LABELS[log.table_name] ?? log.table_name}
                            </td>
                            <td className="px-4 py-3 text-gray-800 text-xs font-medium max-w-[220px] truncate">
                              {getSummary(log)}
                            </td>
                          </tr>
                          {isOpen && (
                            <tr key={`${log.id}-detail`} className="bg-gray-50 border-b">
                              <td colSpan={6} className="px-8 py-3">
                                <div className="rounded-lg border bg-white overflow-hidden text-xs">
                                  <div className="px-3 py-2 bg-gray-50 border-b text-xs text-gray-400 font-medium">
                                    ID do registro: <span className="font-mono text-gray-600">{log.record_id}</span>
                                  </div>
                                  <LogDetail log={log} />
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1.5 text-sm rounded border disabled:opacity-40 hover:bg-gray-50">
                ← Anterior
              </button>
              <span className="text-sm text-gray-500">Página {page + 1} de {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-sm rounded border disabled:opacity-40 hover:bg-gray-50">
                Próxima →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
