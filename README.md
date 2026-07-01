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
- Conta corrente por produtor: créditos, débitos, saldo acumulado
- Gráfico de evolução de vendas
- Filtro por período (DateRangePicker) com lançamentos filtrados
- Avatar com iniciais para identificação visual
- **Emissão de Ordens de Pagamento (OP)** individuais e em lote por período
  - Anti-duplicidade: eventos já cobertos por uma OP existente são excluídos automaticamente
  - Numeração sequencial por ano (`OP-2026-001`)
- Eventos por produtor com status Pendente / Liquidado
- Aluguéis de equipamentos com cobrança mensal automática
- Lançamentos manuais com categorias customizáveis

### Ordens de Pagamento
- Lista de OPs pendentes e pagas com filtros e totalizadores
- Confirmação de pagamento: liquida eventos vinculados e reduz saldo do produtor
- Exclusão de OP pendente: reverte eventos para Pendente
- Exportação **CNAB 240 Itaú** (`.rem`) para múltiplas OPs selecionadas
- Documento imprimível por OP com dados do produtor, eventos e conta corrente

### Bilheteria Express (P&L da Plataforma)
- Importação de dados via API externa por período com histórico de importações (chips clicáveis)
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
- Papéis: `super_admin`, `admin`, `producer`

## Segurança
- Middleware Next.js (`middleware.ts`) protege todas as rotas `/dashboard` e redireciona usuários não autenticados
- Server Actions com verificação dupla de autenticação + papel
- `SUPABASE_SERVICE_ROLE_KEY` usado exclusivamente server-side
- Proteção dupla (UI + servidor) contra alteração/exclusão do Super Admin
- Validação de formato de datas na rota da API externa

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
```

## Deploy

Publicado na Vercel: **https://claude-financas.vercel.app**

> **Atenção:** o projeto **não** está conectado ao GitHub no Vercel. Para publicar, rode:
>
> ```bash
> npx vercel --prod --yes
> ```
