-- Novas categorias de produtores para importação detalhada da planilha
-- Execute no SQL Editor do Supabase (não altera estrutura, só insere dados)
-- Se você ainda não rodou as migrações anteriores, pode ignorar este arquivo
-- pois o seed automático via getCategories() vai incluir tudo.

-- As categorias abaixo serão inseridas automaticamente pelo sistema na
-- próxima vez que um usuário acessar Configurações > Categorias.
-- Este arquivo serve apenas como referência das categorias adicionadas.

/*
  Novas categorias (produtor):
  - taxa_cartao_pix     → Taxa Cartão/PIX       (débito)  col M
  - taxa_dinheiro       → Taxa Vendas Dinheiro   (débito)  col O (PDV/TEATRO)
  - taxa_servico        → Taxa de Serviço        (débito)  col Q
  - taxa_administrativa → Taxa Administrativa    (débito)  col S
  - taxa_impressao      → Taxa Impressão/Envio   (débito)  col V
  - voucher             → Voucher/Outros Sistemas (débito) col K
  - juros_emprestimo    → Juros de Empréstimo    (débito)  col AC
  - bonificacao         → Bonificação de Vendas  (crédito) col AE
*/
