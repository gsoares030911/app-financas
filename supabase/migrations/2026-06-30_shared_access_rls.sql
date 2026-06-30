-- Acesso compartilhado: este é um sistema de uso interno de uma única
-- organização (Bilheteria Express), não um app multi-tenant com dados
-- privados por usuário. Os dados de negócio (produtores, eventos,
-- lançamentos, categorias, importações, ordens de pagamento, logs)
-- devem ser visíveis e editáveis por qualquer usuário autenticado,
-- independente de quem os criou.
--
-- Antes: RLS restringia cada tabela a "auth.uid() = user_id" (ou via
-- producer.user_id), então um segundo login só via os próprios dados
-- (tela ficava "zerada" para qualquer usuário que não o criador).
--
-- Execute no SQL Editor do Supabase.

do $$
declare
  t text;
  pol record;
begin
  for t in select unnest(array[
    'producers', 'equipment_rentals', 'events', 'account_entries',
    'platform_entries', 'categories', 'recurring_expenses',
    'bilheteria_api_imports', 'payment_orders', 'audit_logs'
  ])
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    -- Remove todas as políticas existentes na tabela, qualquer que seja o nome
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')',
      t || '_shared_access', t
    );
  end loop;
end $$;

-- profiles NÃO entra nessa lista de propósito: continua restrita a
-- "auth.uid() = id" (cada usuário só lê/edita o próprio perfil via
-- client direto). A listagem/gestão de todos os usuários na tela
-- Configurações > Usuários já usa o admin client no servidor, com
-- as permissões controladas em código (isAdmin / isSuperAdmin).
