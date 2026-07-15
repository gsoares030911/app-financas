# Bilheteria Express — Sistema Financeiro

Sistema de gestão financeira da plataforma Bilheteria Express, desenvolvido com Next.js 16 e Supabase.

## Funcionalidades

### Dashboard
- Visão geral de receitas totais, valor a pagar e devedores
- Ranking de melhores produtores por receita (gráfico de barras)
- Ranking de maiores devedores
- Painel de cobranças pendentes de eventos cancelados

### Produtores Culturais
- Cadastro completo com dados bancários (banco, agência, conta, PIX), e-mail e telefone
- **Taxa de serviço contratual (`service_fee_pct`)**: quando preenchida no cadastro, o import usa `bruto × %` em vez do `feeService` da API (ex: produtor que absorve 7%)
- Conta corrente por produtor: créditos, débitos, saldo acumulado
- Gráfico de evolução de vendas
- Filtro por período via `billing_from` dos eventos (não `event_date`) — garante que shows importados fora do período apareçam corretamente
- Avatar com iniciais para identificação visual
- **Emissão de Ordens de Pagamento (OP)** individuais e em lote por período
  - Anti-duplicidade: eventos já cobertos por uma OP existente são excluídos automaticamente
  - Numeração sequencial por ano (`OP-2026-001`)
- Eventos por produtor com status Pendente / Liquidado
- **Aluguéis de equipamentos** (aba dentro do produtor): visualização e cadastro dos contratos vinculados ao produtor
- Lançamentos manuais com categorias customizáveis

### Ordens de Pagamento
- Lista de OPs pendentes e pagas com filtros e totalizadores
- **Confirmação de pagamento individual** por linha: liquida eventos vinculados e reduz saldo do produtor
- **Confirmação em massa**: selecione N ordens e confirme todas de uma vez via batch update
- Exclusão de OP pendente: reverte eventos para Pendente
- **Exportação CNAB 240 Itaú** (`.rem`) para múltiplas OPs selecionadas
  - Layout oficial SISPAG versão 085 (outubro/2020)
  - Suporte a **PIX** (lote forma `45`, Segmento A + B) e **TED** (lote forma `41`) no mesmo arquivo
  - PIX tem prioridade: produtores com chave PIX cadastrada usam lote PIX; demais usam TED
  - Detecção automática do tipo de chave PIX (CPF/CNPJ, e-mail, telefone, aleatória)
  - Config da empresa pagadora salva no Supabase (compartilhada entre usuários/máquinas)
- Documento imprimível por OP com dados do produtor, eventos e conta corrente
  - Coluna **Despesas** na tabela de eventos: soma real de todos os débitos (`account_entries`) vinculados ao evento — inclui taxa cartão/PIX, taxa de impressão, voucher/dinheiro e demais débitos (não apenas a taxa da plataforma)

### Equipamentos
Página `/dashboard/equipamentos` com duas abas:

**Aba — Equipamentos de Produtor**
- Lista global de todos os contratos de aluguel vinculados a produtores
- **Código automático** (`EQ-001`, `EQ-002`…) gerado no cadastro; busca por código e por produtor (autocomplete)
- Aba dentro de cada produtor mantida para visualização contextual
- **Cobrança automática**: Cron Job roda no último dia do mês e gera débito `aluguel_equipamento` em `account_entries` para cada contrato ativo — zero intervenção manual
  - Anti-duplicata por `reference_month`
  - Trava: desativar contrato (`is_active = false`) ou marcar **Devolvida à Rede** impede cobranças futuras
  - Botão manual **"Gerar cobranças do mês"** disponível como fallback

**Aba — Pontos de Venda**
- Cadastro de PDVs físicos em lojas parceiras (custo pago pela plataforma, não pelo produtor)
- Campos: nome, loja parceira, endereço, **telefone** (para futuras notificações SMS/WhatsApp), custo mensal, dia de cobrança
- **Locação bonificada**: checkbox zera o custo e oculta campos de valor — PDV gratuito não gera despesa
- Custo mensal gera despesa `aluguel_pdv` em `platform_entries` — aparece no P&L da BE
- **Cobrança automática**: mesmo Cron Job do último dia do mês cobre PDVs não bonificados e ativos
  - Anti-duplicata por `pdv_location_id + reference_month`
  - Botão manual **"Gerar despesas do mês"** disponível como fallback

**Aba — Máquinas**
- **Importação via Excel**: botão "Importar Excel" abre seletor de arquivo `.xlsx`; colunas esperadas: `modelo` (serial) e `instalação` (data). Operadora padrão: `Rede`. Anti-duplicidade por `serial_number` — máquinas já cadastradas são ignoradas, exibindo contagem antes de confirmar.
- **Reverter devolução**: ao editar uma máquina marcada como "Dev. à Operadora", aparece bloco laranja com botão "Reverter devolução" — retorna ao status "No escritório" e limpa a data de devolução.
- **Data de devolução visível**: máquinas devolvidas exibem "Devolvida em DD/MM/AAAA" abaixo do badge na coluna Status/Localização — histórico sem coluna extra.
- Rastreamento físico de cada equipamento: **No escritório** · **Com Produtor** · **Devolvida**
  - Status derivado em 3 camadas: `returned_to_network` na máquina (prioridade máxima) → contrato de aluguel/PDV ativo sem devolução → no escritório
  - `is_active` controla faturamento; `returned_to_network` controla localização física (independentes)
- **Devolução em massa**: checkboxes por linha + "Devolver Selecionadas (N)" — marca as máquinas como devolvidas e encerra automaticamente todos os contratos de aluguel e PDVs vinculados (mesmo bonificados)
- **Seletor de máquina filtrado**: ao cadastrar/editar contrato, só aparecem as máquinas com status "No escritório" (ou a já vinculada ao contrato atual) — impede vincular a mesma máquina a dois produtores

**Status de máquinas (Equipamentos e PDVs)**
- **Ativo** (verde) · **Inativo** (cinza) · **Dev. à Operadora** (vermelho)
- Marcar **"Máquina devolvida à Operadora"** desativa o contrato automaticamente, registra a data de devolução e exibe badge vermelho — indica que o equipamento saiu do inventário (não está com o produtor, nem no PDV, nem conosco)
- Cron ignora automaticamente registros devolvidos à operadora (pois `is_active = false`)
- **Chips de filtro clicáveis** na barra acima de cada tabela: Todos · Ativos · Inativos · Dev. à Operadora (+ Bonificadas na aba PDV) — seleção destaca o chip e filtra a tabela instantaneamente
- **Ordenação por coluna**: clique em qualquer cabeçalho para ordenar crescente/decrescente (ícone ⇅/↑/↓); Equipamentos: Código, Equipamento, Produtor, Valor/Mês, Dia Cob., Início, Fim, Status; PDVs: PDV, Loja Parceira, Telefone, Custo/Mês, Dia Cob., Status

**Infraestrutura**
- Cron configurado em `vercel.json` (`0 6 28-31 * *`); requer `CRON_SECRET` nas env vars do Vercel
- Tabelas: `equipment_rentals` (produtores), `pdv_locations` (BE) e `machines` (inventário físico); todas com `returned_to_network + returned_at`

### Bilheteria Express (P&L da Plataforma)
- Importação de dados via API externa por período com histórico de importações (chips clicáveis)
- **Proteção anti duplo pagamento**: eventos já vinculados a uma OP (pendente ou paga) são ignorados na reimportação — valores e status não são alterados; resultado exibe aviso amarelo com contagem
- **Anti-duplicata de produtores**: a cada "Buscar", lista de produtores é consultada ao vivo no banco (nunca usa cache da página)
- Regras financeiras completas: cartão, dinheiro, voucher, BV, impressão, ECAD
  - Dinheiro/Voucher: ficam no bruto do produtor, saem do líquido (não entram no caixa BE)
  - Taxa de cartão (~2%): só em bilheteria física (TEATRO/PDV), não no online
  - Taxa de serviço e lucro BE: incidem sobre `beBase = cartão + outros`
  - Despesas BE geradas automaticamente: taxa de cartão (2,7%) e impostos (13,66%)
- Lançamentos manuais com categorias separadas (receita / despesa)
- Filtro por período, tipo e busca textual
- Despesas recorrentes com renovação anual

### Configurações
- **Usuários**: Admin pode criar, editar e excluir usuários; Super Admin é protegido server-side
- **Categorias**: gestão de categorias de lançamentos por produtor
- **Minha Conta**: troca de senha

### Logs do Sistema
- Auditoria completa de todas as ações com agrupamento por usuário e tipo de operação

### Acesso Compartilhado
- Todos os usuários autenticados veem os mesmos dados (RLS compartilhado)
- Papéis: `super_admin`, `admin`, `financeiro_bilheteria`, `producer`, `financeiro_produtor`
  - `financeiro_bilheteria`: acesso a Dashboard, Produtores, OPs e Bilheteria (sem Configurações/Logs)

## Interface

- **Máscara de moeda brasileira** em todos os campos de dinheiro (componente `CurrencyInput`): comportamento estilo ATM — dígitos preenchem da direita para a esquerda, últimos 2 são centavos. Ex: digitar `9000` exibe `R$ 90,00` em tempo real. Prefixo `R$` fixo, `inputMode="numeric"` para teclado numérico no celular.

## Segurança
- Middleware Next.js (`middleware.ts`) protege todas as rotas `/dashboard` e redireciona usuários não autenticados
- Server Actions com verificação dupla de autenticação + papel
- `SUPABASE_SERVICE_ROLE_KEY` usado exclusivamente server-side
- Proteção dupla (UI + servidor) contra alteração/exclusão do Super Admin
- Validação de formato de datas na rota da API externa
- Registro público bloqueado: `/register` redireciona para `/login`; sign-up desativado no Supabase
- Link "Criar conta grátis" removido da tela de login

## Tecnologias

- [Next.js 16](https://nextjs.org) (App Router, Server Actions, Turbopack)
- [Supabase](https://supabase.com) — PostgreSQL + autenticação + Row Level Security
- [Tailwind CSS v4](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)
- TypeScript estrito

## Rodando localmente

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

Crie `.env.local` com:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
BILHETERIA_API_TOKEN=...
CRON_SECRET=...
```

> `CRON_SECRET`: string segura qualquer (ex: `be-equipamentos-2026`). Deve ser adicionada também em **Vercel → Settings → Environment Variables** para que o Cron Job de equipamentos funcione em produção.

## Deploy

Publicado na Vercel: **https://claude-financas.vercel.app**

> **Atenção:** o projeto **não** está conectado ao GitHub no Vercel. Para publicar, rode:
>
> ```bash
> npx vercel --prod --yes
> ```
