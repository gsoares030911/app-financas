'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, LayoutDashboard, LogOut, Menu, X, Users, Trophy, Ticket, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'

const ADMIN_NAV = [
  { href: '/dashboard/rankings',     label: 'Dashboard',         icon: Trophy },
  { href: '/dashboard/producers',    label: 'Produtores',        icon: Users },
  { href: '/dashboard/bilheteria',   label: 'Bilheteria Express',icon: Ticket },
]

const PRODUCER_NAV = [
  { href: '/dashboard/producers',    label: 'Minha Conta',       icon: Users },
]

interface Props {
  user: User
  role: UserRole
}

export default function Sidebar({ user, role }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const navItems = role === 'admin' ? ADMIN_NAV : PRODUCER_NAV

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Saiu com sucesso.')
    router.push('/')
    router.refresh()
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <span className="font-bold text-gray-900">FinançasPRO</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/20" onClick={() => setOpen(false)} />
      )}

      <aside className={cn(
        'fixed top-0 left-0 z-40 h-full w-64 bg-white border-r flex flex-col transition-transform duration-200',
        'lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center gap-2 px-6 py-5 border-b">
          <TrendingUp className="h-6 w-6 text-blue-600" />
          <span className="text-xl font-bold text-gray-900">FinançasPRO</span>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive(href)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}

          {role === 'admin' && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sistema</p>
              </div>
              <Link
                href="/dashboard/configuracoes"
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive('/dashboard/configuracoes')
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Settings className="h-4 w-4" />
                Configurações
              </Link>
            </>
          )}
        </nav>

        <div className="p-4 border-t">
          <p className="text-xs text-gray-400 truncate mb-2 px-3">{user.email}</p>
          {role === 'producer' && (
            <p className="text-xs text-blue-600 font-medium px-3 mb-2">Acesso Produtor</p>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="lg:hidden h-14" />
    </>
  )
}
