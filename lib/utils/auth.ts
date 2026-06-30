import type { UserRole } from '@/lib/types'

export const SUPER_ADMIN_EMAIL = 'gustavo.soares@bilheteriaexpress.com.br'

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin:           'Super Administrador',
  admin:                 'Administrador',
  financeiro_bilheteria: 'Financeiro Bilheteria Express',
  producer:              'Produtor',
  financeiro_produtor:   'Financeiro Produtor',
}

export const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bg: string }> = {
  super_admin:           { label: 'Super Administrador',        color: 'text-purple-700', bg: 'bg-purple-100' },
  admin:                 { label: 'Administrador',              color: 'text-blue-700',   bg: 'bg-blue-100'   },
  financeiro_bilheteria: { label: 'Fin. Bilheteria Express',    color: 'text-teal-700',   bg: 'bg-teal-100'   },
  producer:              { label: 'Produtor',                   color: 'text-gray-600',   bg: 'bg-gray-100'   },
  financeiro_produtor:   { label: 'Financeiro Produtor',        color: 'text-orange-700', bg: 'bg-orange-100' },
}

export function isAdmin(role: UserRole): boolean {
  return role === 'admin' || role === 'super_admin'
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === 'super_admin'
}

export function canAccessBilheteria(role: UserRole): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'financeiro_bilheteria'
}

export function canAccessProdutores(role: UserRole): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'financeiro_produtor' || role === 'producer'
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'super_admin' || role === 'admin'
}
