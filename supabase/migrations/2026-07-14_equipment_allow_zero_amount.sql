-- Permitir monthly_amount = 0 para locações bonificadas
ALTER TABLE equipment_rentals DROP CONSTRAINT IF EXISTS equipment_rentals_monthly_amount_check;
ALTER TABLE equipment_rentals ADD CONSTRAINT equipment_rentals_monthly_amount_check CHECK (monthly_amount >= 0);
