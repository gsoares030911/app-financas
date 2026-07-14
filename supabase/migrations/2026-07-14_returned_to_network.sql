ALTER TABLE equipment_rentals
  ADD COLUMN IF NOT EXISTS returned_to_network boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS returned_at date;

ALTER TABLE pdv_locations
  ADD COLUMN IF NOT EXISTS returned_to_network boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS returned_at date;
