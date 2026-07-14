ALTER TABLE equipment_rentals
  ADD COLUMN IF NOT EXISTS is_bonificada boolean NOT NULL DEFAULT false;
