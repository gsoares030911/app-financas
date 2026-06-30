-- Tabela de transações
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  date date not null,
  type text not null check (type in ('receita', 'despesa')),
  category text not null check (
    category in (
      'Alimentação', 'Transporte', 'Moradia', 'Lazer',
      'Saúde', 'Educação', 'Salário', 'Freelance', 'Outros'
    )
  ),
  created_at timestamptz default now()
);

-- Índices
create index if not exists transactions_user_id_idx on public.transactions(user_id);
create index if not exists transactions_date_idx on public.transactions(date desc);

-- Row Level Security
alter table public.transactions enable row level security;

-- Políticas RLS: cada usuário só acessa suas próprias transações
create policy "Usuários veem suas próprias transações"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "Usuários criam suas próprias transações"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "Usuários atualizam suas próprias transações"
  on public.transactions for update
  using (auth.uid() = user_id);

create policy "Usuários excluem suas próprias transações"
  on public.transactions for delete
  using (auth.uid() = user_id);

-- =============================================
-- Sistema de Conta Corrente — Produtores Culturais
-- =============================================

-- Produtores culturais
create table if not exists public.producers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  pix_key text,
  bank_name text,
  bank_agency text,
  bank_account text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists producers_user_id_idx on public.producers(user_id);

alter table public.producers enable row level security;

-- Dados compartilhados entre todos os usuários autenticados (uso interno
-- de uma única organização) — ver supabase/migrations/2026-06-30_shared_access_rls.sql
create policy "producers_shared_access"
  on public.producers for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Aluguéis de equipamentos (declarado antes de account_entries por causa da FK)
create table if not exists public.equipment_rentals (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  equipment_name text not null,
  monthly_amount numeric(12,2) not null check (monthly_amount > 0),
  billing_day int not null check (billing_day between 1 and 28),
  start_date date not null,
  end_date date,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz default now()
);

create index if not exists equipment_rentals_producer_id_idx on public.equipment_rentals(producer_id);

alter table public.equipment_rentals enable row level security;

create policy "equipment_rentals_shared_access"
  on public.equipment_rentals for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Eventos por produtor
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  name text not null,
  event_date date not null,
  gross_revenue numeric(12,2) not null default 0 check (gross_revenue >= 0),
  platform_fee numeric(12,2) not null default 0 check (platform_fee >= 0),
  net_amount numeric(12,2) not null check (net_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'settled', 'cancelado')),
  notes text,
  created_at timestamptz default now()
);

create index if not exists events_producer_id_idx on public.events(producer_id);

alter table public.events enable row level security;

create policy "events_shared_access"
  on public.events for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Lançamentos da conta corrente
create table if not exists public.account_entries (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  equipment_rental_id uuid references public.equipment_rentals(id) on delete set null,
  entry_type text not null check (entry_type in ('credito', 'debito')),
  category text not null check (category in (
    'venda_evento', 'adiantamento', 'anuncio', 'emprestimo',
    'aluguel_equipamento', 'pagamento', 'outros',
    'taxa_conveniencia',
    'taxa_cartao_pix', 'taxa_dinheiro', 'taxa_servico',
    'taxa_administrativa', 'taxa_impressao', 'voucher',
    'juros_emprestimo', 'bonificacao'
  )),
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  date date not null,
  reference_month text,
  created_at timestamptz default now()
);

create index if not exists account_entries_producer_id_idx on public.account_entries(producer_id);
create index if not exists account_entries_date_idx on public.account_entries(date desc);

alter table public.account_entries enable row level security;

create policy "account_entries_shared_access"
  on public.account_entries for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- =============================================
-- Financeiro da Plataforma (Bilheteria Express)
-- =============================================

create table if not exists public.platform_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('receita', 'despesa')),
  category text not null check (category in (
    'taxa_evento', 'publicidade', 'servicos', 'outros_receita',
    'infraestrutura', 'marketing', 'pessoal', 'taxa_cartao', 'impostos', 'outros_despesa'
  )),
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  date date not null,
  event_id uuid references public.events(id) on delete set null,
  producer_id uuid references public.producers(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists platform_entries_user_id_idx on public.platform_entries(user_id);
create index if not exists platform_entries_date_idx on public.platform_entries(date desc);

alter table public.platform_entries enable row level security;

create policy "platform_entries_shared_access"
  on public.platform_entries for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
