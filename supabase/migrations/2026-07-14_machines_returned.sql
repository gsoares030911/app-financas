-- Rastrear devolução de máquinas à operadora diretamente na tabela machines
ALTER TABLE machines ADD COLUMN IF NOT EXISTS returned_to_network boolean DEFAULT false;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS returned_at date;
