import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateProfile } from '@/lib/supabase/profile'
import LogsClient from '@/components/logs/LogsClient'
import type { AuditLog } from '@/lib/types'
import { isAdmin } from '@/lib/utils/auth'

export default async function LogsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(user.id, user.email ?? undefined)
  if (!isAdmin(profile.role)) redirect('/dashboard')

  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Logs do Sistema</h1>
        <p className="text-sm text-gray-500 mt-1">
          Histórico de todas as inclusões, alterações e exclusões realizadas no sistema.
        </p>
      </div>
      <LogsClient logs={(logs ?? []) as AuditLog[]} />
    </div>
  )
}
