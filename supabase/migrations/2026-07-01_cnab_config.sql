-- Configuração da empresa pagadora para geração de CNAB 240 (singleton)
CREATE TABLE IF NOT EXISTS cnab_config (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj         text        NOT NULL DEFAULT '',
  nome         text        NOT NULL DEFAULT '',
  agencia      text        NOT NULL DEFAULT '',
  digito_agencia text      NOT NULL DEFAULT '',
  conta        text        NOT NULL DEFAULT '',
  digito_conta text        NOT NULL DEFAULT '',
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid        REFERENCES auth.users(id)
);

-- Garante uma única linha (singleton)
INSERT INTO cnab_config (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE cnab_config ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado lê
CREATE POLICY "cnab_config_select"
  ON cnab_config FOR SELECT TO authenticated USING (true);

-- Qualquer usuário autenticado atualiza (dados da empresa, não sensíveis)
CREATE POLICY "cnab_config_update"
  ON cnab_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
