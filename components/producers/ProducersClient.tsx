'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Search, Users, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils/format'
import type { Producer, AccountEntry } from '@/lib/types'
import ProducerForm from './ProducerForm'

interface ProducerWithBalance {
  producer: Producer
  balance: number
}

interface Props {
  producers: Producer[]
  entries: Pick<AccountEntry, 'producer_id' | 'entry_type' | 'amount'>[]
  paidOrders: { producer_id: string; amount: number }[]
}

export default function ProducersClient({ producers, entries, paidOrders }: Props) {
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const producersWithBalance = useMemo((): ProducerWithBalance[] => {
    return producers.map(producer => {
      const pe = entries.filter(e => e.producer_id === producer.id)
      const credits = pe.filter(e => e.entry_type === 'credito').reduce((s, e) => s + e.amount, 0)
      const debits = pe.filter(e => e.entry_type === 'debito').reduce((s, e) => s + e.amount, 0)
      const paid = paidOrders.filter(o => o.producer_id === producer.id).reduce((s, o) => s + o.amount, 0)
      return { producer, balance: credits - debits - paid }
    })
  }, [producers, entries, paidOrders])

  const filtered = useMemo(() => {
    if (!search.trim()) return producersWithBalance
    const q = search.toLowerCase()
    return producersWithBalance.filter(({ producer }) =>
      producer.full_name.toLowerCase().includes(q) ||
      producer.email?.toLowerCase().includes(q) ||
      producer.phone?.includes(q)
    )
  }, [producersWithBalance, search])

  const totalToReceive = producersWithBalance.filter(p => p.balance > 0).reduce((s, p) => s + p.balance, 0)
  const totalOwed = producersWithBalance.filter(p => p.balance < 0).reduce((s, p) => s + Math.abs(p.balance), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produtores Culturais</h1>
          <p className="text-gray-500 text-sm mt-1">
            {producers.length} produtor{producers.length !== 1 ? 'es' : ''} cadastrado{producers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Produtor
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Produtores</p>
                <p className="text-2xl font-bold text-gray-900">{producers.length}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-full">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">A Pagar</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalToReceive)}</p>
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
                <p className="text-sm text-gray-500">Devendo</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalOwed)}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-full">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por nome, email ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          {producers.length === 0 ? (
            <div className="space-y-2">
              <Users className="h-12 w-12 mx-auto text-gray-300" />
              <p className="text-gray-500 font-medium">Nenhum produtor cadastrado</p>
              <p className="text-sm text-gray-400">Clique em "Novo Produtor" para começar</p>
            </div>
          ) : (
            <p className="text-gray-400">Nenhum resultado para "{search}"</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(({ producer, balance }) => (
            <Link key={producer.id} href={`/dashboard/producers/${producer.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{producer.full_name}</p>
                      {producer.email && (
                        <p className="text-sm text-gray-500 truncate mt-0.5">{producer.email}</p>
                      )}
                      {producer.phone && (
                        <p className="text-sm text-gray-500">{producer.phone}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                  </div>
                  <div className="mt-4 pt-4 border-t flex items-center justify-between">
                    <span className="text-xs text-gray-400">Saldo</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(Math.abs(balance))}
                      </span>
                      <Badge
                        variant={balance >= 0 ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {balance >= 0 ? 'A pagar' : 'Devendo'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <ProducerForm open={formOpen} onOpenChange={setFormOpen} producer={null} />
    </div>
  )
}
