-- Vincula um usuário com role 'producer' ao seu produtor correspondente
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS producer_id uuid REFERENCES producers(id) ON DELETE SET NULL;
