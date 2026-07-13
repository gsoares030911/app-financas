-- Taxa de serviço contratual do produtor (% sobre o bruto de vendas).
-- Quando preenchida, substitui o feeService retornado pela API no ImportWizard.
-- Exemplo: 7 = produtor absorve 7% do bruto como taxa de serviço.
ALTER TABLE producers ADD COLUMN IF NOT EXISTS service_fee_pct numeric(5,2);
