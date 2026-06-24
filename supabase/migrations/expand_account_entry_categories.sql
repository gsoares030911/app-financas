-- Expandir categorias aceitas na conta corrente de produtores
-- Execute este SQL no SQL Editor do Supabase antes de reimportar

ALTER TABLE public.account_entries
DROP CONSTRAINT IF EXISTS account_entries_category_check;

ALTER TABLE public.account_entries
ADD CONSTRAINT account_entries_category_check
CHECK (category IN (
  'venda_evento', 'adiantamento', 'anuncio', 'emprestimo',
  'aluguel_equipamento', 'pagamento', 'outros',
  'taxa_conveniencia',
  'taxa_cartao_pix', 'taxa_dinheiro', 'taxa_servico',
  'taxa_administrativa', 'taxa_impressao', 'voucher',
  'juros_emprestimo', 'bonificacao'
));
