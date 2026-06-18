import { Transaction } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { CATEGORY_COLORS } from '@/lib/utils/colors'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Transações Recentes</CardTitle>
        <Link
          href="/dashboard/transactions"
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          Ver todas <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">Nenhuma transação neste período</p>
        ) : (
          <div className="space-y-3">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[t.category] ?? '#6b7280' }}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800 line-clamp-1">{t.description}</p>
                    <p className="text-xs text-gray-400">{formatDate(t.date)} · {t.category}</p>
                  </div>
                </div>
                <span
                  className={`text-sm font-semibold ml-4 flex-shrink-0 ${
                    t.type === 'receita' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {t.type === 'receita' ? '+' : '-'}{formatCurrency(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
