import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getOrCreateProfile } from '@/lib/supabase/profile'
import { isAdmin } from '@/lib/utils/auth'
import UsuariosClient from '@/components/configuracoes/UsuariosClient'
import type { Profile } from '@/lib/types'

export default async function UsuariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(user.id, user.email ?? undefined)
  if (!isAdmin(profile.role)) redirect('/dashboard')

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
        <p className="text-sm text-gray-500 mt-1">Gerencie os usuários e seus níveis de acesso.</p>
      </div>
      <UsuariosClient
        profiles={(profiles ?? []) as Profile[]}
        currentUserId={user.id}
        currentRole={profile.role}
      />
    </div>
  )
}
