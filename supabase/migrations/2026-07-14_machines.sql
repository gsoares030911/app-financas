-- Tabela de máquinas (ativos físicos)
CREATE TABLE IF NOT EXISTS machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text NOT NULL,
  model text NOT NULL,
  operator text NOT NULL,
  received_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS machines_serial_number_idx ON machines (serial_number);

ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "machines_shared" ON machines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Vincular máquina aos contratos de produtor e PDVs
ALTER TABLE equipment_rentals
  ADD COLUMN IF NOT EXISTS machine_id uuid REFERENCES machines(id) ON DELETE SET NULL;

ALTER TABLE pdv_locations
  ADD COLUMN IF NOT EXISTS machine_id uuid REFERENCES machines(id) ON DELETE SET NULL;
