export type TransactionType = 'receita' | 'despesa'

export type TxCategory =
  | 'Alimentação'
  | 'Transporte'
  | 'Moradia'
  | 'Lazer'
  | 'Saúde'
  | 'Educação'
  | 'Salário'
  | 'Freelance'
  | 'Outros'

export const CATEGORIES: TxCategory[] = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Lazer',
  'Saúde',
  'Educação',
  'Salário',
  'Freelance',
  'Outros',
]

export const INCOME_CATEGORIES: TxCategory[] = ['Salário', 'Freelance', 'Outros']
export const EXPENSE_CATEGORIES: TxCategory[] = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Lazer',
  'Saúde',
  'Educação',
  'Outros',
]

export interface Transaction {
  id: string
  user_id: string
  description: string
  amount: number
  date: string
  type: TransactionType
  category: TxCategory
  created_at: string
}

export interface TransactionFormData {
  description: string
  amount: number
  date: string
  type: TransactionType
  category: TxCategory
}

export interface DashboardStats {
  totalReceita: number
  totalDespesa: number
  saldo: number
}

export interface CategoryTotal {
  name: string
  value: number
  color: string
}

// =============================================
// Conta Corrente — Produtores Culturais
// =============================================

export interface Producer {
  id: string
  user_id: string
  full_name: string
  email: string | null
  phone: string | null
  pix_key: string | null
  bank_name: string | null
  bank_agency: string | null
  bank_account: string | null
  notes: string | null
  created_at: string
}

export interface ProducerFormData {
  full_name: string
  email: string
  phone: string
  pix_key: string
  bank_name: string
  bank_agency: string
  bank_account: string
  notes: string
}

export type EventStatus = 'pending' | 'settled'

export interface ProducerEvent {
  id: string
  producer_id: string
  name: string
  event_date: string
  gross_revenue: number
  platform_fee: number
  net_amount: number
  status: EventStatus
  notes: string | null
  created_at: string
}

export interface EventFormData {
  name: string
  event_date: string
  gross_revenue: number
  platform_fee: number
  net_amount: number
  status: EventStatus
  notes: string
}

export type EntryType = 'credito' | 'debito'

export type AccountEntryCategory = string

export interface Category {
  id: string
  user_id: string
  slug: string
  name: string
  entry_type: 'credito' | 'debito' | 'ambos'
  color: string
  is_active: boolean
  is_system: boolean
  sort_order: number
  scope: 'producer' | 'platform'
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  user_email: string | null
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  table_name: string
  record_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
}

export interface PaymentOrder {
  id: string
  user_id: string
  producer_id: string
  order_number: string
  amount: number
  status: 'pending' | 'paid'
  event_ids: string[]
  period_from: string | null
  period_to: string | null
  paid_at: string | null
  created_at: string
}

export interface RecurringExpense {
  id: string
  user_id: string
  description: string
  category: string
  amount: number
  billing_day: number
  is_active: boolean
  last_launched_month: string | null
  created_at: string
}

export const CATEGORY_COLORS: Record<string, string> = {
  green:  'bg-green-100 text-green-700',
  blue:   'bg-blue-100 text-blue-700',
  orange: 'bg-orange-100 text-orange-700',
  purple: 'bg-purple-100 text-purple-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  teal:   'bg-teal-100 text-teal-700',
  red:    'bg-red-100 text-red-700',
  pink:   'bg-pink-100 text-pink-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  gray:   'bg-gray-100 text-gray-700',
}

// Categorias padrão do sistema (seed inicial)
export const SYSTEM_CATEGORIES: Omit<Category, 'id' | 'user_id' | 'created_at'>[] = [
  // Conta corrente de produtores
  { slug: 'venda_evento',        name: 'Venda de Evento',         entry_type: 'credito', color: 'green',  is_active: true, is_system: true, sort_order: 1,  scope: 'producer' },
  { slug: 'adiantamento',        name: 'Adiantamento',            entry_type: 'debito',  color: 'orange', is_active: true, is_system: true, sort_order: 2,  scope: 'producer' },
  { slug: 'anuncio',             name: 'Anúncio',                 entry_type: 'debito',  color: 'purple', is_active: true, is_system: true, sort_order: 3,  scope: 'producer' },
  { slug: 'emprestimo',          name: 'Empréstimo p/ Show',      entry_type: 'debito',  color: 'yellow', is_active: true, is_system: true, sort_order: 4,  scope: 'producer' },
  { slug: 'aluguel_equipamento', name: 'Aluguel de Equipamento',  entry_type: 'debito',  color: 'blue',   is_active: true, is_system: true, sort_order: 5,  scope: 'producer' },
  { slug: 'pagamento',           name: 'Pagamento ao Produtor',   entry_type: 'debito',  color: 'teal',   is_active: true, is_system: true, sort_order: 6,  scope: 'producer' },
  { slug: 'taxa_conveniencia',   name: 'Taxa de Conveniência',    entry_type: 'debito',  color: 'red',    is_active: true, is_system: true, sort_order: 7,  scope: 'producer' },
  { slug: 'outros',              name: 'Outros',                  entry_type: 'ambos',   color: 'gray',   is_active: true, is_system: true, sort_order: 8,  scope: 'producer' },
  { slug: 'taxa_cartao_pix',     name: 'Taxa Cartão/PIX',         entry_type: 'debito',  color: 'orange', is_active: true, is_system: true, sort_order: 9,  scope: 'producer' },
  { slug: 'taxa_dinheiro',       name: 'Taxa Vendas Dinheiro',    entry_type: 'debito',  color: 'yellow', is_active: true, is_system: true, sort_order: 10, scope: 'producer' },
  { slug: 'taxa_servico',        name: 'Taxa de Serviço',         entry_type: 'debito',  color: 'red',    is_active: true, is_system: true, sort_order: 11, scope: 'producer' },
  { slug: 'taxa_administrativa', name: 'Taxa Administrativa',     entry_type: 'debito',  color: 'purple', is_active: true, is_system: true, sort_order: 12, scope: 'producer' },
  { slug: 'taxa_impressao',      name: 'Taxa Impressão/Envio',    entry_type: 'debito',  color: 'teal',   is_active: true, is_system: true, sort_order: 13, scope: 'producer' },
  { slug: 'voucher',             name: 'Voucher/Outros Sistemas', entry_type: 'debito',  color: 'blue',   is_active: true, is_system: true, sort_order: 14, scope: 'producer' },
  { slug: 'juros_emprestimo',    name: 'Juros de Empréstimo',     entry_type: 'debito',  color: 'pink',   is_active: true, is_system: true, sort_order: 15, scope: 'producer' },
  { slug: 'bonificacao',         name: 'Bonificação de Vendas',   entry_type: 'credito', color: 'green',  is_active: true, is_system: true, sort_order: 16, scope: 'producer' },
  // Bilheteria Express
  { slug: 'taxa_evento',         name: 'Taxa de Evento',          entry_type: 'credito', color: 'green',  is_active: true, is_system: true, sort_order: 1,  scope: 'platform' },
  { slug: 'publicidade',         name: 'Publicidade',             entry_type: 'credito', color: 'blue',   is_active: true, is_system: true, sort_order: 2,  scope: 'platform' },
  { slug: 'servicos',            name: 'Serviços Adicionais',     entry_type: 'credito', color: 'teal',   is_active: true, is_system: true, sort_order: 3,  scope: 'platform' },
  { slug: 'outros_receita',      name: 'Outras Receitas',         entry_type: 'credito', color: 'gray',   is_active: true, is_system: true, sort_order: 4,  scope: 'platform' },
  { slug: 'infraestrutura',      name: 'Infraestrutura',          entry_type: 'debito',  color: 'orange', is_active: true, is_system: true, sort_order: 5,  scope: 'platform' },
  { slug: 'marketing',           name: 'Marketing',               entry_type: 'debito',  color: 'purple', is_active: true, is_system: true, sort_order: 6,  scope: 'platform' },
  { slug: 'pessoal',             name: 'Pessoal',                 entry_type: 'debito',  color: 'yellow', is_active: true, is_system: true, sort_order: 7,  scope: 'platform' },
  { slug: 'impostos',            name: 'Impostos',                entry_type: 'debito',  color: 'red',    is_active: true, is_system: true, sort_order: 8,  scope: 'platform' },
  { slug: 'outros_despesa',      name: 'Outras Despesas',         entry_type: 'debito',  color: 'gray',   is_active: true, is_system: true, sort_order: 9,  scope: 'platform' },
]

// Fallback para componentes que ainda não recebem categorias via prop
export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  SYSTEM_CATEGORIES.map(c => [c.slug, c.name])
)
export const CREDIT_CATEGORIES: string[] = ['venda_evento', 'bonificacao', 'outros']
export const DEBIT_CATEGORIES: string[] = [
  'adiantamento', 'anuncio', 'emprestimo', 'aluguel_equipamento', 'pagamento',
  'taxa_conveniencia', 'taxa_cartao_pix', 'taxa_dinheiro', 'taxa_servico',
  'taxa_administrativa', 'taxa_impressao', 'voucher', 'juros_emprestimo', 'outros',
]

export type UserRole =
  | 'super_admin'           // Acesso total irrestrito
  | 'admin'                 // Acesso total exceto gestão de usuários
  | 'financeiro_bilheteria' // Somente módulo Bilheteria Express
  | 'producer'              // Somente conta própria de produtor
  | 'financeiro_produtor'   // Financeiro de todos os produtores (sem Bilheteria Express)

export interface Profile {
  id: string
  role: UserRole
  email: string | null
  producer_id: string | null
  created_at: string
}

export interface AccountEntry {
  id: string
  producer_id: string
  event_id: string | null
  equipment_rental_id: string | null
  entry_type: EntryType
  category: AccountEntryCategory
  description: string
  amount: number
  date: string
  reference_month: string | null
  created_at: string
}

export interface AccountEntryFormData {
  entry_type: EntryType
  category: AccountEntryCategory
  description: string
  amount: number | string
  date: string
  event_id: string | null
  equipment_rental_id: string | null
  reference_month: string | null
}

export interface EquipmentRental {
  id: string
  producer_id: string
  equipment_name: string
  monthly_amount: number
  billing_day: number
  start_date: string
  end_date: string | null
  is_active: boolean
  notes: string | null
  created_at: string
}

export interface EquipmentRentalFormData {
  equipment_name: string
  monthly_amount: number | string
  billing_day: number | string
  start_date: string
  end_date: string
  is_active: boolean
  notes: string
}

// =============================================
// Bilheteria Express — Financeiro da Plataforma
// =============================================

export type PlatformEntryType = 'receita' | 'despesa'

export type PlatformCategory =
  | 'taxa_evento'
  | 'publicidade'
  | 'servicos'
  | 'outros_receita'
  | 'infraestrutura'
  | 'marketing'
  | 'pessoal'
  | 'impostos'
  | 'outros_despesa'

export const PLATFORM_CATEGORY_LABELS: Record<PlatformCategory, string> = {
  taxa_evento: 'Taxa de Evento',
  publicidade: 'Publicidade',
  servicos: 'Serviços Adicionais',
  outros_receita: 'Outras Receitas',
  infraestrutura: 'Infraestrutura',
  marketing: 'Marketing',
  pessoal: 'Pessoal',
  impostos: 'Impostos',
  outros_despesa: 'Outras Despesas',
}

export const PLATFORM_REVENUE_CATEGORIES: PlatformCategory[] = [
  'taxa_evento', 'publicidade', 'servicos', 'outros_receita',
]
export const PLATFORM_EXPENSE_CATEGORIES: PlatformCategory[] = [
  'infraestrutura', 'marketing', 'pessoal', 'impostos', 'outros_despesa',
]

export interface PlatformEntry {
  id: string
  user_id: string
  entry_type: PlatformEntryType
  category: PlatformCategory
  description: string
  amount: number
  date: string
  event_id: string | null
  producer_id: string | null
  created_at: string
}

export interface PlatformEntryFormData {
  entry_type: PlatformEntryType
  category: PlatformCategory
  description: string
  amount: number | string
  date: string
  event_id: string | null
  producer_id: string | null
}
