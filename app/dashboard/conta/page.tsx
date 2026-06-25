import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChangePasswordForm from '@/components/conta/ChangePasswordForm'

export default async function ContaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Minha Conta</h1>
        <p className="text-sm text-gray-500 mt-1">{user.email}</p>
      </div>
      <ChangePasswordForm />
    </div>
  )
}
