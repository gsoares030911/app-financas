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
