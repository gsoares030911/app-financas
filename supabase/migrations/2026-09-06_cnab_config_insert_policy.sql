-- saveCnabConfig usa upsert (INSERT ... ON CONFLICT DO UPDATE) para nunca
-- falhar silenciosamente se a linha singleton sumir de novo — mas faltava a
-- policy de INSERT (só existiam SELECT e UPDATE), então o upsert era barrado
-- pelo RLS mesmo quando a linha já existia (Postgres checa a policy de INSERT
-- antes de resolver o conflito).
CREATE POLICY "cnab_config_insert"
  ON cnab_config FOR INSERT TO authenticated WITH CHECK (true);
