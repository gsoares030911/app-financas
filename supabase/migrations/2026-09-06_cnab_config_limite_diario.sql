-- Limite diário de pagamento (teto bancário) usado para avisar/bloquear a
-- exportação de CNAB 240 quando o total selecionado para uma data excede o
-- limite operacional da conta pagadora. NULL = sem limite configurado.
ALTER TABLE cnab_config ADD COLUMN IF NOT EXISTS limite_diario numeric(14,2);
