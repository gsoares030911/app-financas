import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BilheteriaClient from '@/components/bilheteria/BilheteriaClient'
import type { PlatformEntry, RecurringExpense } from '@/lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function autoLaunchRecurring(supabase: any, userId: string): Promise<boolean> {
  const today = new Date()
  const currentYear = today.getFullYear()

  // Após 2026, não lança automaticamente — retorna flag para sugerir renovação
  if (currentYear > 2026) return true

  const currentMonth = `${currentYear}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const todayDay = today.getDate()

  const { data: recurring } = await supabase
    .from('recurring_expenses')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  for (const rec of (recurring ?? []) as RecurringExpense[]) {
    if (rec.last_launched_month === currentMonth) continue
    if (todayDay < rec.billing_day) continue

    const daysInMonth = new Date(currentYear, today.getMonth() + 1, 0).getDate()
    const day = Math.min(rec.billing_day, daysInMonth)
    const date = `${currentMonth}-${String(day).padStart(2, '0')}`

    const { error } = await supabase.from('platform_entries').insert({
      user_id: userId,
      entry_type: 'despesa',
      category: rec.category,
      description: rec.description,
      amount: rec.amount,
      date,
    })
    if (!error) {
      await supabase.from('recurring_expenses').update({ last_launched_month: currentMonth }).eq('id', rec.id)
    }
  }

  return false
}

export default async function BilheteriaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const needsRenewal = await autoLaunchRecurring(supabase, user.id)

  const { data: importHistory } = await supabase
    .from('bilheteria_api_imports')
    .select('id, dt_inicial, dt_final, imported_at, total_registros')
    .eq('user_id', user.id)
    .order('dt_inicial', { ascending: false })

  const allEntries: PlatformEntry[] = []
  const pageSize = 1000
  let from = 0
  while (true) {
    const { data } = await supabase
      .from('platform_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .range(from, from + pageSize - 1)
    if (!data || data.length === 0) break
    allEntries.push(...(data as PlatformEntry[]))
    if (data.length < pageSize) break
    from += pageSize
  }
  const entries = allEntries

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bilheteria Express</h1>
        <p className="text-sm text-gray-500 mt-1">Financeiro da plataforma — receitas e despesas operacionais</p>
      </div>
      <BilheteriaClient
        initialEntries={(entries ?? []) as PlatformEntry[]}
        needsRenewal={needsRenewal}
        importHistory={(importHistory ?? []) as { id: string; dt_inicial: string; dt_final: string; imported_at: string; total_registros: number }[]}
      />
    </div>
  )
}
