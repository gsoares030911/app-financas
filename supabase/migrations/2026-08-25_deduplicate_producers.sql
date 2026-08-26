-- Deduplicar produtores com mesmo full_name (por user_id)
-- Estratégia: manter o produtor com mais eventos (ou menor id em caso de empate)
-- e transferir todos os dados do(s) duplicado(s) para ele.

DO $$
DECLARE
  dup RECORD;
  keep_id   uuid;
  discard_id uuid;
BEGIN

  -- Para cada conjunto de produtores com mesmo (user_id, full_name), processa os duplicados
  FOR dup IN
    SELECT user_id, lower(trim(full_name)) AS norm_name
    FROM producers
    GROUP BY user_id, lower(trim(full_name))
    HAVING count(*) > 1
  LOOP

    -- Escolhe o produtor a MANTER: o que tem mais eventos; desempate pelo menor id
    SELECT p.id INTO keep_id
    FROM producers p
    LEFT JOIN events e ON e.producer_id = p.id
    WHERE p.user_id = dup.user_id
      AND lower(trim(p.full_name)) = dup.norm_name
    GROUP BY p.id
    ORDER BY count(e.id) DESC, p.id ASC
    LIMIT 1;

    -- Para cada outro produtor do mesmo grupo, transfere tudo e apaga
    FOR discard_id IN
      SELECT id FROM producers
      WHERE user_id = dup.user_id
        AND lower(trim(full_name)) = dup.norm_name
        AND id <> keep_id
    LOOP
      RAISE NOTICE 'Mesclando produtor % → %', discard_id, keep_id;

      -- Transferir eventos
      UPDATE events
        SET producer_id = keep_id
        WHERE producer_id = discard_id
          -- Evitar conflito: só transfere se não existe já o mesmo evento no produtor destino
          AND NOT EXISTS (
            SELECT 1 FROM events e2
            WHERE e2.producer_id = keep_id
              AND e2.name       = events.name
              AND e2.event_date = events.event_date
          );

      -- Remover eventos duplicados que ficaram no descartado (já existem no keep)
      DELETE FROM events
        WHERE producer_id = discard_id;

      -- Transferir lançamentos da conta
      UPDATE account_entries SET producer_id = keep_id WHERE producer_id = discard_id;

      -- Transferir ordens de pagamento
      UPDATE payment_orders SET producer_id = keep_id WHERE producer_id = discard_id;

      -- Transferir locações de equipamento
      UPDATE equipment_rentals SET producer_id = keep_id WHERE producer_id = discard_id;

      -- Transferir perfil de usuário vinculado (se houver)
      UPDATE profiles SET producer_id = keep_id WHERE producer_id = discard_id;

      -- Apagar o produtor duplicado
      DELETE FROM producers WHERE id = discard_id;

    END LOOP;

  END LOOP;

END $$;
