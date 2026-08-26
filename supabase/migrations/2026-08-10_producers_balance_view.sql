-- VIEW para filtragem de produtores por saldo via PostgREST
-- Usa a mesma fórmula de get_global_producer_balances() para consistência
-- A view permite que o PostgREST filtre (WHERE balance > 0, etc.) no banco,
-- evitando o limite de 1000 linhas da RPC SET-returning.
CREATE OR REPLACE VIEW public.producers_with_balance AS
WITH balances AS (
  SELECT
    p.id AS producer_id,
    COALESCE(SUM(CASE WHEN ae.entry_type = 'credito' THEN ae.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN ae.entry_type = 'debito'  THEN ae.amount ELSE 0 END), 0)
    - COALESCE((
        SELECT SUM(po.amount)
        FROM payment_orders po
        WHERE po.producer_id = p.id AND po.status = 'paid'
      ), 0) AS balance
  FROM producers p
  LEFT JOIN account_entries ae ON ae.producer_id = p.id
  GROUP BY p.id
)
SELECT p.*, COALESCE(b.balance, 0) AS balance
FROM producers p
LEFT JOIN balances b ON b.producer_id = p.id;

GRANT SELECT ON public.producers_with_balance TO authenticated;
GRANT SELECT ON public.producers_with_balance TO anon;
