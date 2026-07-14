-- Tabela de Pontos de Venda
CREATE TABLE IF NOT EXISTS pdv_locations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  store_name    text NOT NULL,
  address       text,
  phone         text,
  monthly_cost  numeric(10,2) NOT NULL DEFAULT 0,
  billing_day   integer NOT NULL DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 28),
  is_bonificada boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS: qualquer usuário autenticado pode ler e escrever
ALTER TABLE pdv_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pdv_locations_all" ON pdv_locations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Adicionar pdv_location_id e reference_month em platform_entries para anti-duplicata
ALTER TABLE platform_entries
  ADD COLUMN IF NOT EXISTS pdv_location_id uuid REFERENCES pdv_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reference_month  text;

-- Adicionar aluguel_pdv ao CHECK constraint de platform_entries
ALTER TABLE platform_entries DROP CONSTRAINT IF EXISTS platform_entries_category_check;
ALTER TABLE platform_entries ADD CONSTRAINT platform_entries_category_check
  CHECK (category IN (
    'taxa_evento', 'publicidade', 'servicos', 'outros_receita',
    'infraestrutura', 'marketing', 'pessoal', 'taxa_cartao',
    'impostos', 'outros_despesa', 'aluguel_pdv'
  ));
