-- Migração: todas as pendências em aberto (seguro rodar múltiplas vezes)

-- 1. Devolução de máquinas à operadora
ALTER TABLE machines ADD COLUMN IF NOT EXISTS returned_to_network boolean DEFAULT false;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS returned_at date;

-- 2. Devolução de equipamentos e PDVs à operadora
ALTER TABLE equipment_rentals
  ADD COLUMN IF NOT EXISTS returned_to_network boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS returned_at date;

ALTER TABLE pdv_locations
  ADD COLUMN IF NOT EXISTS returned_to_network boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS returned_at date;

-- 3. Vínculo de usuário produtor com seu cadastro de produtor
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS producer_id uuid REFERENCES producers(id) ON DELETE SET NULL;
