-- Reconstrução das 3 tabelas que nunca tiveram migration commitada no repo
-- (foram criadas direto no SQL Editor do Supabase Dashboard). Gerada a partir
-- da introspecção do schema ao vivo (OpenAPI do PostgREST) em 22/09/2026, pra
-- fechar a lacuna e permitir recriar o banco do zero num servidor novo.

-- Ordens de Pagamento
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  producer_id  uuid NOT NULL REFERENCES public.producers(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  amount       numeric(12,2) NOT NULL,
  status       text NOT NULL DEFAULT 'pending',
  event_ids    text[] NOT NULL DEFAULT '{}',
  period_from  date,
  period_to    date,
  paid_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_orders_producer_id_idx ON public.payment_orders (producer_id);
CREATE INDEX IF NOT EXISTS payment_orders_order_number_idx ON public.payment_orders (order_number);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_orders_shared_access" ON public.payment_orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Log de auditoria (grava INSERT/UPDATE/DELETE de todas as tabelas monitoradas)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  action     text NOT NULL, -- 'INSERT' | 'UPDATE' | 'DELETE'
  table_name text NOT NULL,
  record_id  text,
  old_data   jsonb,
  new_data   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_table_name_idx ON public.audit_logs (table_name);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_shared_access" ON public.audit_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Histórico bruto das importações da API da Bilheteria Express
-- (raw_data guarda o JSON completo retornado pela API por período consultado)
CREATE TABLE IF NOT EXISTS public.bilheteria_api_imports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dt_inicial      date NOT NULL,
  dt_final        date NOT NULL,
  imported_at     timestamptz NOT NULL DEFAULT now(),
  total_registros integer NOT NULL DEFAULT 0,
  raw_data        jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS bilheteria_api_imports_periodo_idx ON public.bilheteria_api_imports (dt_inicial, dt_final);

ALTER TABLE public.bilheteria_api_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bilheteria_api_imports_shared_access" ON public.bilheteria_api_imports
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
