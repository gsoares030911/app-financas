-- Top N produtores com saldo negativo (Maiores Devedores)
CREATE OR REPLACE FUNCTION get_top_debtors(p_limit int DEFAULT 10)
RETURNS TABLE(producer_id uuid, full_name text, balance numeric)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH balances AS (
    SELECT
      p.id,
      p.full_name,
      COALESCE(SUM(CASE WHEN ae.entry_type = 'credito' THEN ae.amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN ae.entry_type = 'debito'  THEN ae.amount ELSE 0 END), 0)
      - COALESCE((
          SELECT SUM(po.amount)
          FROM payment_orders po
          WHERE po.producer_id = p.id AND po.status = 'paid'
        ), 0) AS balance
    FROM producers p
    LEFT JOIN account_entries ae ON ae.producer_id = p.id
    GROUP BY p.id, p.full_name
  )
  SELECT id, full_name, balance
  FROM balances
  WHERE balance < 0
  ORDER BY balance ASC
  LIMIT p_limit;
$$;

-- Top N produtores por receita bruta (Melhores Produtores)
CREATE OR REPLACE FUNCTION get_top_sellers(p_limit int DEFAULT 10)
RETURNS TABLE(producer_id uuid, full_name text, total_revenue numeric)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT p.id, p.full_name,
    COALESCE(SUM(e.gross_revenue), 0) AS total_revenue
  FROM producers p
  LEFT JOIN events e ON e.producer_id = p.id
  GROUP BY p.id, p.full_name
  HAVING COALESCE(SUM(e.gross_revenue), 0) > 0
  ORDER BY total_revenue DESC
  LIMIT p_limit;
$$;

-- Receita bruta total de todos os eventos
CREATE OR REPLACE FUNCTION get_total_revenue()
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(gross_revenue), 0) FROM events;
$$;
