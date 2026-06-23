export type TransactionType = 'receita' | 'despesa'

export type Category =
  | 'Alimentação'
  | 'Transporte'
  | 'Moradia'
  | 'Lazer'
  | 'Saúde'
  | 'Educação'
  | 'Salário'
  | 'Freelance'
  | 'Outros'

export const CATEGORIES: Category[] = [
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

export const INCOME_CATEGORIES: Category[] = ['Salário', 'Freelance', 'Outros']
export const EXPENSE_CATEGORIES: Category[] = [
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
  category: Category
  created_at: string
}

export interface TransactionFormData {
  description: string
  amount: number
  date: string
  type: TransactionType
  category: Category
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

export type AccountEntryCategory =
  | 'venda_evento'
  | 'adiantamento'
  | 'anuncio'
  | 'emprestimo'
  | 'aluguel_equipamento'
  | 'pagamento'
  | 'outros'

export const CATEGORY_LABELS: Record<AccountEntryCategory, string> = {
  venda_evento: 'Venda de Evento',
  adiantamento: 'Adiantamento',
  anuncio: 'Anúncio',
  emprestimo: 'Empréstimo p/ Show',
  aluguel_equipamento: 'Aluguel de Equipamento',
  pagamento: 'Pagamento ao Produtor',
  outros: 'Outros',
}

export const CREDIT_CATEGORIES: AccountEntryCategory[] = ['venda_evento', 'outros']
export const DEBIT_CATEGORIES: AccountEntryCategory[] = [
  'adiantamento', 'anuncio', 'emprestimo', 'aluguel_equipamento', 'pagamento', 'outros',
]

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
