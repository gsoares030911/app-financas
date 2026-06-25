# Bilheteria Express — Sistema Financeiro

Sistema de gestão financeira da plataforma Bilheteria Express, desenvolvido com Next.js 16 e Supabase.

## Funcionalidades

- **Dashboard / Rankings** — visão geral de receitas e eventos
- **Produtores** — cadastro completo com dados bancários e rateio de receitas
- **Ordens de Pagamento** — emissão, aprovação e exportação CNAB 240 Itaú (`.rem`)
- **Bilheteria** — importação e gestão de entradas (CSV) com controle de duplicatas
- **Conta Corrente** — extrato por produtor com lançamentos manuais
- **Configurações** — categorias, usuários e permissões
- **Logs do Sistema** — auditoria de todas as ações com agrupamento por usuário

## Tecnologias

- [Next.js 16](https://nextjs.org) (App Router, Server Actions, Turbopack)
- [Supabase](https://supabase.com) — banco de dados PostgreSQL + autenticação + RLS
- [Tailwind CSS v4](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com) com componentes `@base-ui/react`
- TypeScript estrito

## Rodando localmente

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

Crie um arquivo `.env.local` com as variáveis:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Deploy

Publicado na Vercel: **https://claude-financas.vercel.app**

Qualquer push para `master` dispara um novo deploy automaticamente.
