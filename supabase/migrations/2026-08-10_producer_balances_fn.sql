-- Retorna saldo atual por produtor (créditos - débitos - OPs pagas)
-- Mesmo padrão de get_global_producer_balances: LEFT JOIN só em account_entries
-- + subquery correlacionada para payment_orders (evita multiplicação de linhas)
CREATE OR REPLACE FUNCTION get_all_producer_balances()
RETURNS TABLE(producer_id uuid, balance numeric)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
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
$$;

GRANT EXECUTE ON FUNCTION get_all_producer_balances() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_producer_balances() TO anon;
