-- Deduplicação v2 — mais direta e robusta
-- Keeper = menor UUID (primeiro criado) de cada grupo nome+user_id

BEGIN;

-- 1. Mapa: dup_id → keep_id
CREATE TEMP TABLE _dedup AS
SELECT
  p.id AS dup_id,
  ( SELECT p2.id FROM producers p2
    WHERE lower(trim(p2.full_name)) = lower(trim(p.full_name))
      AND p2.user_id = p.user_id
    ORDER BY p2.created_at ASC, p2.id ASC
    LIMIT 1
  ) AS keep_id
FROM producers p
WHERE p.id <> (
  SELECT p2.id FROM producers p2
  WHERE lower(trim(p2.full_name)) = lower(trim(p.full_name))
    AND p2.user_id = p.user_id
  ORDER BY p2.created_at ASC, p2.id ASC
  LIMIT 1
);

-- (verifica quantos duplicados foram encontrados)
-- SELECT count(*) FROM _dedup;

-- 2. Transfere eventos únicos (não existem ainda no keeper) → keeper
UPDATE events
SET producer_id = d.keep_id
FROM _dedup d
WHERE events.producer_id = d.dup_id
  AND NOT EXISTS (
    SELECT 1 FROM events e2
    WHERE e2.producer_id = d.keep_id
      AND e2.name        = events.name
      AND e2.event_date  = events.event_date
  );

-- 3. Remove lançamentos ligados a eventos duplicados que sobraram no dup
DELETE FROM account_entries
WHERE event_id IN (
  SELECT id FROM events WHERE producer_id IN (SELECT dup_id FROM _dedup)
);

-- 4. Remove os eventos duplicados que sobraram no dup
DELETE FROM events
WHERE producer_id IN (SELECT dup_id FROM _dedup);

-- 5. Transfere lançamentos avulsos (event_id IS NULL) que restaram
UPDATE account_entries
SET producer_id = d.keep_id
FROM _dedup d
WHERE account_entries.producer_id = d.dup_id;

-- 6. Transfere ordens de pagamento
UPDATE payment_orders
SET producer_id = d.keep_id
FROM _dedup d
WHERE payment_orders.producer_id = d.dup_id;

-- 7. Transfere equipamentos
UPDATE equipment_rentals
SET producer_id = d.keep_id
FROM _dedup d
WHERE equipment_rentals.producer_id = d.dup_id;

-- 8. Transfere vínculos de perfil
UPDATE profiles
SET producer_id = d.keep_id
FROM _dedup d
WHERE profiles.producer_id = d.dup_id;

-- 9. Apaga os produtores duplicados
DELETE FROM producers
WHERE id IN (SELECT dup_id FROM _dedup);

DROP TABLE _dedup;

COMMIT;

-- Verificação final — deve retornar 0 linhas se tudo estiver correto:
SELECT lower(trim(full_name)) AS nome, user_id, count(*)
FROM producers
GROUP BY lower(trim(full_name)), user_id
HAVING count(*) > 1;
