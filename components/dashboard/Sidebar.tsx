'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LogOut, Menu, X, Users, Trophy, Ticket,
  Settings, FileText, ShieldCheck, ChevronDown, ChevronRight, KeyRound, Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/types'
import { isAdmin, isSuperAdmin, canAccessBilheteria } from '@/lib/utils/auth'
import { cn } from '@/lib/utils'

const ADMIN_NAV = [
  { href: '/dashboard/rankings',         label: 'Dashboard',           icon: Trophy },
  { href: '/dashboard/producers',        label: 'Produtores',          icon: Users },
  { href: '/dashboard/ordens-pagamento', label: 'Ordens de Pagamento', icon: FileText },
  { href: '/dashboard/bilheteria',       label: 'Bilheteria Express',  icon: Ticket },
  { href: '/dashboard/equipamentos',     label: 'Equipamentos',        icon: Package },
]

const FIN_BILHETERIA_NAV = [
  { href: '/dashboard/rankings',         label: 'Dashboard',           icon: Trophy },
  { href: '/dashboard/producers',        label: 'Produtores',          icon: Users },
  { href: '/dashboard/ordens-pagamento', label: 'Ordens de Pagamento', icon: FileText },
  { href: '/dashboard/bilheteria',       label: 'Bilheteria Express',  icon: Ticket },
  { href: '/dashboard/equipamentos',     label: 'Equipamentos',        icon: Package },
]

const PRODUCER_NAV = [
  { href: '/dashboard/producers', label: 'Minha Conta', icon: Users },
]

const CONFIG_SUBITEMS = [
  { href: '/dashboard/configuracoes',          label: 'Categorias' },
  { href: '/dashboard/configuracoes/usuarios', label: 'Usuários' },
]

interface Props {
  user: User
  role: UserRole
}

export default function Sidebar({ user, role }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const navItems = isAdmin(role) ? ADMIN_NAV
    : role === 'financeiro_bilheteria' ? FIN_BILHETERIA_NAV
    : PRODUCER_NAV
  const superAdmin = isSuperAdmin(role)

  // Submenu de Configurações fica aberto quando qualquer sub-rota está ativa
  const configActive = pathname.startsWith('/dashboard/configuracoes')
  const [configOpen, setConfigOpen] = useState(configActive)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Saiu com sucesso.')
    router.push('/')
    router.refresh()
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === href
    // exact match para sub-itens do menu de configurações
    if (href === '/dashboard/configuracoes') return pathname === href
    return pathname.startsWith(href)
  }

  function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
    const active = isActive(href)
    return (
      <Link
        href={href}
        onClick={() => setOpen(false)}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative',
          active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-600 rounded-full" />
        )}
        <Icon className={cn('h-4 w-4', active ? 'text-blue-600' : 'text-gray-400')} />
        {label}
      </Link>
    )
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden print:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b flex items-center justify-between px-4 py-3">
        <div className="flex items-center">
          <img src="/logo-bilheteria-express.png" alt="Bilheteria Express" className="h-7 w-auto" />
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/20" onClick={() => setOpen(false)} />
      )}

      <aside className={cn(
        'fixed top-0 left-0 z-40 h-full w-64 bg-white border-r flex flex-col transition-transform duration-200 print:hidden',
        'lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center px-6 py-4 border-b">
          <img src="/logo-bilheteria-express.png" alt="Bilheteria Express" className="h-10 w-auto" />
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <NavLink key={href} href={href} label={label} icon={Icon} />
          ))}

          {isAdmin(role) && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sistema</p>
              </div>

              {/* Logs */}
              <NavLink href="/dashboard/logs" label="Logs do Sistema" icon={FileText} />

              {/* Configurações com submenu */}
              <button
                onClick={() => setConfigOpen(v => !v)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  configActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Settings className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 text-left">Configurações</span>
                {configOpen
                  ? <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  : <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                }
              </button>

              {configOpen && (
                <div className="ml-4 pl-3 border-l border-gray-200 space-y-0.5">
                  {CONFIG_SUBITEMS.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center px-3 py-2 rounded-lg text-sm transition-colors',
                        pathname === href
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                      )}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </nav>

        <div className="p-4 border-t">
          <p className="text-xs text-gray-400 truncate mb-1 px-3">{user.email}</p>
          {superAdmin && (
            <div className="flex items-center gap-1.5 px-3 mb-2">
              <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
              <span className="text-xs text-purple-600 font-semibold">Super Admin</span>
            </div>
          )}
          {role === 'admin' && !superAdmin && (
            <div className="flex items-center gap-1.5 px-3 mb-2">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs text-blue-600 font-semibold">Admin</span>
            </div>
          )}
          {role === 'producer' && (
            <p className="text-xs text-blue-600 font-medium px-3 mb-2">Acesso Produtor</p>
          )}
          <Link
            href="/dashboard/conta"
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full',
              pathname === '/dashboard/conta' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <KeyRound className="h-4 w-4" />
            Minha Conta
          </Link>
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
