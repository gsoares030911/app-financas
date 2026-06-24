-- =============================================================
-- 1. Adiciona coluna scope na tabela categories
--    scope = 'producer' (conta corrente produtores)
--           'platform' (Bilheteria Express)
-- =============================================================
ALTER TABLE categories ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'producer'
  CHECK (scope IN ('producer', 'platform'));

-- =============================================================
-- 2. Despesas recorrentes da Bilheteria Express
-- =============================================================
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category    TEXT NOT NULL,
  amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  billing_day INT NOT NULL DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 28),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recurring_expenses_own" ON recurring_expenses;
CREATE POLICY "recurring_expenses_own" ON recurring_expenses FOR ALL USING (auth.uid() = user_id);
