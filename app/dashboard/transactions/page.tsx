import { createClient } from '@/lib/supabase/server'
import TransactionsClient from '@/components/transactions/TransactionsClient'

export default async function TransactionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user!.id)
    .order('date', { ascending: false })

  return <TransactionsClient initialTransactions={transactions ?? []} userId={user!.id} />
}
