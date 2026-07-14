ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS equipment_code text;

WITH numbered AS (
  SELECT id,
    'EQ-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::text, 3, '0') AS code
  FROM equipment_rentals
  WHERE equipment_code IS NULL
)
UPDATE equipment_rentals er
SET equipment_code = n.code
FROM numbered n
WHERE er.id = n.id;

CREATE UNIQUE INDEX IF NOT EXISTS equipment_rentals_code_idx
  ON equipment_rentals (equipment_code)
  WHERE equipment_code IS NOT NULL;
