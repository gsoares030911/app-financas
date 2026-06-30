-- Adiciona a categoria 'taxa_cartao' à constraint de platform_entries
-- (taxa da operadora de cartão paga pela Bilheteria Express, 2,7% sobre vendas cartão + lucro BE)
alter table public.platform_entries
  drop constraint platform_entries_category_check,
  add constraint platform_entries_category_check check (category in (
    'taxa_evento', 'publicidade', 'servicos', 'outros_receita',
    'infraestrutura', 'marketing', 'pessoal', 'taxa_cartao', 'impostos', 'outros_despesa'
  ));
