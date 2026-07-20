-- Função que calcula os totais globais de saldo de produtores de forma eficiente
-- Usada nos cards da tela de Produtores (A Pagar / Devendo globais, não só da página atual)

CREATE OR REPLACE FUNCTION get_global_producer_balances()
RETURNS TABLE(
  total_to_receive numeric,
  total_owed       numeric,
  count_to_receive bigint,
  count_owed       bigint,
  count_zero       bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH balances AS (
    SELECT
      p.id,
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
  SELECT
    COALESCE(SUM(CASE WHEN balance > 0 THEN balance       ELSE 0 END), 0) AS total_to_receive,
    COALESCE(SUM(CASE WHEN balance < 0 THEN ABS(balance)  ELSE 0 END), 0) AS total_owed,
    COUNT(CASE WHEN balance > 0 THEN 1 END)                               AS count_to_receive,
    COUNT(CASE WHEN balance < 0 THEN 1 END)                               AS count_owed,
    COUNT(CASE WHEN balance = 0 THEN 1 END)                               AS count_zero
  FROM balances;
$$;
