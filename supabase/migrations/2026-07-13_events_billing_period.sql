-- Adiciona período de faturamento nos eventos.
-- Resolve o problema de shows com event_date fora do período de fechamento
-- (ex: show em 30/06 processado no fechamento de 06-12/07).
-- O filtro de emissão de OP em lote passa a usar billing_from em vez de event_date.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS billing_from date,
  ADD COLUMN IF NOT EXISTS billing_to   date;
