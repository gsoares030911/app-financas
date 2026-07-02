# Documentação Técnica — Bilheteria Express · Sistema Financeiro

> Documento de handoff para desenvolvedores. Cobre arquitetura, banco de dados, regras de negócio, integrações e processo de deploy.

---

## 1. Visão Geral

Sistema de gestão financeira interno da **Bilheteria Express** (plataforma de venda de ingressos). Controla:

- Conta corrente de produtores culturais (créditos, débitos, saldo)
- Ordens de pagamento e geração de remessa bancária (CNAB 240 Itaú)
- P&L (DRE) da plataforma Bilheteria Express
- Importação automática de eventos via API externa

**Não é** um sistema multi-tenant: todos os usuários autenticados compartilham os mesmos dados (RLS aberta para `authenticated`). A separação é por papel (role), não por proprietário dos dados.

---

## 2. Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16.2.9 (App Router, Turbopack) |
| Linguagem | TypeScript estrito |
| Banco de dados | Supabase (PostgreSQL 15) |
| Autenticação | Supabase Auth (email/senha) |
| ORM/Client | `@supabase/ssr` (Server Components + Client Components) |
| UI | Tailwind CSS v4 + shadcn/ui |
| Gráficos | Recharts |
| Notificações | Sonner (toast) |
| Ícones | Lucide React |
| Deploy | Vercel (CLI, **não** conectado ao GitHub) |

> **Atenção:** `git push` **não** faz deploy. Publicar com `npx vercel --prod --yes` na raiz do projeto.

---

## 3. Estrutura de Pastas

```
claude-financas/
├── app/
│   ├── api/bilheteria/pagamentos/   # Proxy para API externa da BE
│   ├── actions/cnabConfig.ts        # Server Actions para config CNAB
│   ├── auth/callback/               # Callback OAuth Supabase
│   └── dashboard/
│       ├── page.tsx                 # Dashboard principal
│       ├── producers/               # Produtores + extrato + OP individual
│       ├── ordens-pagamento/        # Lista de OPs + detalhe
│       ├── bilheteria/              # P&L da plataforma + importação
│       ├── rankings/                # Rankings de receita/devedores
│       ├── configuracoes/           # Categorias + Usuários
│       ├── conta/                   # Troca de senha
│       └── logs/                    # Auditoria
├── components/
│   ├── ordens-pagamento/            # OrdensListClient + ExportarCNABModal
│   ├── producers/                   # ProducersClient, ProducerStatementClient
│   ├── bilheteria/                  # ImportWizard, PlatformEntriesClient
│   ├── ui/                          # Componentes shadcn/ui
│   └── shared/                      # DateRangePicker, etc.
├── lib/
│   ├── supabase/
│   │   ├── client.ts                # createClient() — uso em Client Components
│   │   ├── server.ts                # createClient() — uso em Server Components
│   │   └── admin.ts                 # createAdminClient() — bypassa RLS
│   ├── utils/
│   │   ├── cnab240.ts               # Gerador CNAB 240 Itaú SISPAG 085
│   │   └── format.ts                # formatCurrency, etc.
│   └── types.ts                     # Todos os tipos TypeScript do domínio
├── supabase/migrations/             # SQL histórico de migrações
├── middleware.ts                    # Protege /dashboard (redireciona não autenticados)
├── CLAUDE.md / AGENTS.md            # Instruções para o assistente de IA
└── TECHNICAL.md                     # Este arquivo
```

---

## 4. Variáveis de Ambiente

Criar `.env.local` na raiz:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # Só server-side, nunca exposta ao browser

# API externa Bilheteria Express
BILHETERIA_API_TOKEN=Bearer eyJ...
```

No Vercel, as mesmas variáveis devem estar configuradas nas Environment Variables do projeto.

---

## 5. Banco de Dados (Supabase / PostgreSQL)

### 5.1 Tabelas Principais

#### `profiles`
Estende `auth.users`. Um registro por usuário.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` |
| `role` | text | `super_admin`, `admin`, `financeiro_bilheteria`, `producer`, `financeiro_produtor` |
| `email` | text | E-mail do usuário |
| `producer_id` | uuid FK → producers | Preenchido apenas para role `producer` |
| `created_at` | timestamptz | |

RLS: cada usuário só lê/edita o próprio perfil. A listagem para administração usa `SUPABASE_SERVICE_ROLE_KEY` no servidor.

---

#### `producers`
Cadastro de produtores culturais.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `full_name` | text | Nome completo |
| `email` | text | |
| `phone` | text | |
| `pix_key` | text | Chave PIX (qualquer tipo) |
| `bank_name` | text | Nome do banco (ex: "Itaú", "Bradesco") |
| `bank_agency` | text | Número da agência |
| `bank_account` | text | Número da conta (com dígito, ex: "06333-6") |
| `notes` | text | Observações |
| `user_id` | uuid FK → auth.users | Criador (legado; RLS atual é compartilhada) |
| `created_at` | timestamptz | |

---

#### `events`
Eventos de um produtor (shows, espetáculos, etc.).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `producer_id` | uuid FK → producers | |
| `name` | text | Nome do evento |
| `event_date` | date | Data do evento |
| `gross_revenue` | numeric(10,2) | Receita bruta do produtor |
| `platform_fee` | numeric(10,2) | Receita da BE neste evento |
| `net_amount` | numeric(10,2) | Líquido a pagar ao produtor |
| `status` | text | `pending` ou `settled` |
| `notes` | text | Observações / flags especiais |
| `created_at` | timestamptz | |

Status `settled` = evento incluído em uma Ordem de Pagamento confirmada.

---

#### `account_entries`
Lançamentos na conta corrente de um produtor (créditos e débitos).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `producer_id` | uuid FK → producers | |
| `event_id` | uuid FK → events (nullable, ON DELETE SET NULL) | Vínculo opcional com evento |
| `equipment_rental_id` | uuid FK → equipment_rentals (nullable) | |
| `entry_type` | text | `credito` ou `debito` |
| `category` | text | Ver categorias abaixo |
| `description` | text | |
| `amount` | numeric(10,2) | Sempre positivo |
| `date` | date | |
| `reference_month` | text | Para despesas recorrentes (formato `YYYY-MM`) |
| `created_at` | timestamptz | |

**Categorias aceitas** (CHECK constraint no banco):
`venda_evento`, `adiantamento`, `anuncio`, `emprestimo`, `aluguel_equipamento`, `pagamento`, `outros`, `taxa_conveniencia`, `taxa_cartao_pix`, `taxa_dinheiro`, `taxa_servico`, `taxa_administrativa`, `taxa_impressao`, `voucher`, `juros_emprestimo`, `bonificacao`

> **Importante:** adicionar nova categoria exige migração SQL no Supabase (ALTER TABLE ... DROP/ADD CONSTRAINT) **e** atualização de `lib/types.ts`.

---

#### `payment_orders`
Ordens de Pagamento emitidas para produtores.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `producer_id` | uuid FK → producers | |
| `order_number` | text | Numeração sequencial, ex: `OP-2026-001` |
| `amount` | numeric(10,2) | Valor total da OP |
| `status` | text | `pending` ou `paid` |
| `event_ids` | uuid[] | Array de IDs dos eventos cobertos |
| `period_from` | date | Início do período (quando emitida por período) |
| `period_to` | date | Fim do período |
| `paid_at` | timestamptz | Preenchido ao confirmar pagamento |
| `user_id` | uuid FK → auth.users | |
| `created_at` | timestamptz | |

**Cálculo de saldo do produtor:**
```
saldo = totalCreditos − totalDebitos − soma(payment_orders.amount WHERE status='paid')
```
Nunca criar `account_entries` ao confirmar pagamento — a OP paga já desconta via `paidTotal`.

---

#### `platform_entries`
Lançamentos financeiros da Bilheteria Express (P&L da plataforma).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `entry_type` | text | `receita` ou `despesa` |
| `category` | text | Ver categorias abaixo (CHECK constraint) |
| `description` | text | |
| `amount` | numeric(10,2) | |
| `date` | date | |
| `event_id` | uuid FK → events (nullable) | |
| `producer_id` | uuid FK → producers (nullable) | |
| `user_id` | uuid FK → auth.users | |
| `created_at` | timestamptz | |

**Categorias aceitas** (CHECK constraint):
- Receita: `taxa_evento`, `publicidade`, `servicos`, `outros_receita`
- Despesa: `infraestrutura`, `marketing`, `pessoal`, `taxa_cartao`, `impostos`, `outros_despesa`

---

#### `equipment_rentals`
Aluguéis de equipamentos com cobrança mensal automática.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `producer_id` | uuid FK → producers | |
| `equipment_name` | text | |
| `monthly_amount` | numeric(10,2) | Valor mensal |
| `billing_day` | int | Dia do mês para lançar (1–28) |
| `start_date` | date | |
| `end_date` | date (nullable) | null = ativo indefinidamente |
| `is_active` | boolean | |
| `notes` | text | |
| `created_at` | timestamptz | |

---

#### `categories`
Categorias dinâmicas (gerenciadas via UI em Configurações > Categorias).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | |
| `slug` | text | Identificador único (ex: `venda_evento`) |
| `name` | text | Nome de exibição |
| `entry_type` | text | `credito`, `debito` ou `ambos` |
| `color` | text | `green`, `blue`, `orange`, etc. |
| `is_active` | boolean | |
| `is_system` | boolean | Categorias do sistema (não editáveis) |
| `sort_order` | int | Ordem de exibição |
| `scope` | text | `producer` ou `platform` |
| `created_at` | timestamptz | |

---

#### `recurring_expenses`
Despesas recorrentes da plataforma (ex: servidores, licenças).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `description` | text | |
| `category` | text | Categoria de `platform_entries` |
| `amount` | numeric(10,2) | |
| `billing_day` | int | Dia do mês (1–28) |
| `is_active` | boolean | |
| `last_launched_month` | text | Último mês lançado (`YYYY-MM`) |
| `user_id` | uuid FK → auth.users | |
| `created_at` | timestamptz | |

---

#### `bilheteria_api_imports`
Histórico de importações da API externa.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | |
| `dt_inicial` | text | Data inicial da consulta |
| `dt_final` | text | Data final da consulta |
| `total_registros` | int | Qtd de registros retornados |
| `raw_data` | jsonb | Resposta completa da API |
| `created_at` | timestamptz | |

---

#### `audit_logs`
Auditoria automática via triggers no banco.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid (nullable) | |
| `user_email` | text | |
| `action` | text | `INSERT`, `UPDATE` ou `DELETE` |
| `table_name` | text | |
| `record_id` | text | |
| `old_data` | jsonb | Estado anterior (UPDATE/DELETE) |
| `new_data` | jsonb | Estado novo (INSERT/UPDATE) |
| `created_at` | timestamptz | |

---

#### `cnab_config`
Singleton com dados da empresa pagadora para geração de CNAB 240.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | Fixo: `00000000-0000-0000-0000-000000000001` |
| `cnpj` | text | |
| `nome` | text | Razão social |
| `agencia` | text | Agência sem dígito |
| `digito_agencia` | text | |
| `conta` | text | Conta sem dígito |
| `digito_conta` | text | |
| `updated_at` | timestamptz | |
| `updated_by` | uuid FK → auth.users | |

Pré-preenchida com dados da Bilheteria Express. Qualquer usuário autenticado pode ler e atualizar.

---

### 5.2 RLS (Row Level Security)

| Tabela | Política |
|---|---|
| `profiles` | Cada usuário lê/edita só o próprio (`auth.uid() = id`) |
| Demais tabelas | Qualquer `authenticated` tem acesso total (`auth.role() = 'authenticated'`) |

A gestão de usuários (listar todos, criar, editar roles, excluir) usa `SUPABASE_SERVICE_ROLE_KEY` via `createAdminClient()` no servidor — nunca no cliente.

---

## 6. Autenticação e Papéis

### Papéis disponíveis

| Role | Acesso |
|---|---|
| `super_admin` | Tudo. Não pode ser editado ou excluído por nenhum outro usuário. |
| `admin` | Tudo exceto promover alguém a `super_admin`. Pode gerenciar usuários. |
| `financeiro_bilheteria` | Dashboard + Produtores + Ordens de Pagamento + Bilheteria Express |
| `financeiro_produtor` | Apenas módulo de Produtores (sem Bilheteria Express) |
| `producer` | Apenas a própria conta corrente (não habilitado completamente ainda) |

### Proteção de rotas

- **`middleware.ts`**: intercepta todas as requisições para `/dashboard` e redireciona para `/login` se não autenticado. Funciona no Edge Runtime.
- **`app/dashboard/layout.tsx`**: segunda camada de verificação no servidor.
- **Server Actions**: toda ação sensível re-verifica `supabase.auth.getUser()` no servidor antes de executar.

---

## 7. Módulos e Funcionalidades

### 7.1 Dashboard (`/dashboard`)

Cards com totalizadores gerais: receita total da plataforma, valor a pagar aos produtores, total de devedores (produtores com saldo negativo). Rankings de maiores receitas e maiores devedores. Painel de cobranças pendentes de eventos cancelados.

---

### 7.2 Produtores (`/dashboard/producers`)

**Listagem:**
- DateRangePicker no topo: sem período = visão acumulada; com período = filtra produtores com eventos pendentes no período e saldo > 0
- Cards: "Produtores a pagar", "A Pagar no período", "Eventos pendentes"
- Checkbox por produtor → botão **"Emitir N OPs"** cria 1 `payment_order` por produtor
- Anti-duplicidade: eventos já cobertos por OP existente são excluídos automaticamente

**Extrato do produtor (`/dashboard/producers/[id]`):**
- Conta corrente completa: créditos, débitos, saldo
- Gráfico de evolução de vendas (Recharts)
- Filtro por período
- Lançamentos manuais
- Aluguéis de equipamentos com lançamento mensal automático
- Botão **"Emitir OP"** individual (com anti-duplicidade)

---

### 7.3 Ordens de Pagamento (`/dashboard/ordens-pagamento`)

- Abas Pendentes / Pagas
- Checkbox de seleção individual e "selecionar todas"
- **"Exportar CNAB 240 — Itaú [N]"**: abre modal de geração de remessa bancária
- **"Confirmar Pagamentos [N]"**: confirma todas as OPs selecionadas em batch (um UPDATE para eventos, um UPDATE para ordens)
- **"Confirmar Pagamento"** por linha: confirma individualmente
- Exclusão de OP pendente: reverte eventos para `pending`
- Página de detalhe com documento imprimível

---

### 7.4 CNAB 240 Itaú (`lib/utils/cnab240.ts`)

Gera arquivo de remessa bancária no layout **SISPAG versão 085** (outubro/2020).

**Estrutura do arquivo:**
```
Header Arquivo  (1 registro, 240 bytes)
  Lote PIX      (se houver produtores com pix_key)
    Header Lote PIX
    Segmento A PIX × N  (câmara 009, banco 009/SPI)
    Segmento B PIX × N  (tipo chave, CPF/CNPJ, chave 100 bytes)
    Trailer Lote
  Lote TED      (se houver produtores sem pix_key)
    Header Lote TED
    Segmento A TED × N  (câmara 000, banco destino)
    Trailer Lote
Trailer Arquivo (1 registro, 240 bytes)
```

**Formas de pagamento:**
- PIX → lote forma `45` (prioridade; gerado primeiro no arquivo)
- TED → lote forma `41` (outro titular)

**Detecção do tipo de chave PIX (`detectPixKeyType`):**
- `01` = telefone (começa com `+` ou 10–11 dígitos)
- `02` = e-mail (contém `@`)
- `03` = CPF (11 dígitos) ou CNPJ (14 dígitos)
- `04` = chave aleatória (UUID)

**NOTA 11 — Agência/Conta favorecido (20 bytes):**
- Itaú (código 341 ou 409): `'0' + agência(4) + ' ' + '000000' + conta(6) + ' ' + DAC`
- Outros bancos: `agência(5) + ' ' + conta(12) + ' ' + DAC`

**Config da empresa pagadora** (`cnab_config` no Supabase, singleton):
- Salva automaticamente ao gerar o arquivo
- Compartilhada entre todos os usuários/máquinas

---

### 7.5 Bilheteria Express — P&L (`/dashboard/bilheteria`)

**Importação via API externa:**
- Rota proxy: `GET /api/bilheteria/pagamentos?dtInicial=DD/MM/YYYY&dtFinal=DD/MM/YYYY`
- API externa: `https://produtorwebapi.azurewebsites.net/api/Financeirov1/consultarpagamentos`
- Header: `Authorization: Bearer <BILHETERIA_API_TOKEN>`
- Resultado salvo em `bilheteria_api_imports` (histórico clicável)

**Regras financeiras de importação:**

| Tipo de venda | Bruto produtor | Líquido produtor | Receita BE |
|---|---|---|---|
| Cartão / PIX | ✅ Sim | Base para taxas | ✅ Sim |
| Dinheiro | ✅ Sim | Sai como débito `voucher` | ❌ Não (fica no caixa físico) |
| Voucher | ✅ Sim | Sai como débito `voucher` | ❌ Não |
| BV (Bonificação de Vendas) | ❌ Não conta no bruto | Fica no saldo | ❌ Não |

**Taxas cobradas do produtor:**
- `taxa_cartao_pix` = taxa do cartão/PIX (variável por evento)
- `taxa_dinheiro` = ~2% sobre vendas dinheiro — **apenas TEATRO/PDV** (não online)
- `taxa_servico` = taxa de serviço (não cobrada para clientes Hillarius)
- `taxa_administrativa` = taxa administrativa
- `taxa_impressao` = taxa de impressão (não cobrada para online)
- `taxa_conveniencia` = R$0,50 × qtd ingressos (apenas clientes Hillarius)
- `voucher` = débito do valor em dinheiro/voucher (que ficou no caixa físico)

**Despesas geradas automaticamente para a BE:**
- `taxa_cartao` = 2,7% × (vendas cartão + lucro BE)
- `impostos` = 13,66% × lucro BE

**Caso especial — Hillarius:**
- Produtores com "hillarius" no nome não pagam `taxa_servico`
- Pagam `taxa_conveniencia` = R$0,50 × quantidade de ingressos

**Caso especial — Produtor sem nome:**
- API retorna linha com campo `produtor` vazio
- Sistema usa e-mail como identificador temporário
- Evento criado com nota de aviso para identificação manual

---

### 7.6 Rankings (`/dashboard/rankings`)

- Ranking de produtores por receita bruta
- Ranking de maiores devedores (saldo negativo)

---

### 7.7 Configurações (`/dashboard/configuracoes`)

- **Categorias**: gestão de categorias de lançamentos (producer/platform)
- **Usuários** (admin/super_admin): criar, editar role, excluir usuários
  - Proteção server-side: ninguém pode alterar/excluir o super_admin nem promover a `super_admin`

---

### 7.8 Logs (`/dashboard/logs`)

Visualização da tabela `audit_logs` com agrupamento por usuário e tipo de operação. Alimentada por triggers automáticos no banco.

---

## 8. Padrões de Código

### Server Components vs Client Components

- **Server Components** (padrão): buscam dados no servidor, sem `useState`/`useEffect`
- **Client Components** (`'use client'`): interatividade, formulários, state local
- **Server Actions** (`'use server'`): mutações de dados chamadas de Client Components via `useTransition`

### Padrão de busca de dados

```typescript
// Server Component — page.tsx
const [{ data: orders }, { data: producers }, cnabConfig] = await Promise.all([
  supabase.from('payment_orders').select('*'),
  supabase.from('producers').select('id, full_name'),
  getCnabConfig(),
])
```

### Cliente Supabase

```typescript
// Client Component
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()

// Server Component / Server Action
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// Operações admin (bypass RLS)
import { createAdminClient } from '@/lib/supabase/admin'
const admin = createAdminClient()
```

### Paginação obrigatória

Supabase tem limite implícito de 1000 linhas. Queries que podem retornar muitos registros usam `.range(offset, offset + PAGE_SIZE - 1)` em loop.

---

## 9. Integrações Externas

### API Bilheteria Express

- **Endpoint**: `GET https://produtorwebapi.azurewebsites.net/api/Financeirov1/consultarpagamentos`
- **Auth**: header `Authorization: Bearer <token>`
- **Parâmetros**: `dtInicial` e `dtFinal` (formato `DD/MM/YYYY` ou `YYYY-MM-DD`)
- **Proxy**: toda chamada passa por `/api/bilheteria/pagamentos` (nunca direto do browser — token fica server-side)
- Formato de data validado via regex no servidor para evitar injeção de parâmetros

### Banco Itaú SISPAG (CNAB 240)

- Layout: SISPAG versão 085, outubro/2020
- Gerador em `lib/utils/cnab240.ts`
- Arquivo gerado no browser (Blob) e baixado como `.rem`
- Não há integração automática com o banco — arquivo é baixado e carregado manualmente no SISPAG

---

## 10. Deploy

### Vercel (produção)

```bash
npx vercel --prod --yes
```

URL de produção: **https://claude-financas.vercel.app**

> O projeto **não** está conectado ao GitHub no Vercel. `git push` não publica.

### Rodando localmente

```bash
npm install
npm run dev
# Acesse http://localhost:3000
```

### Migrações de banco

Não há sistema automático de migração. Rodar os arquivos em `supabase/migrations/` manualmente no SQL Editor do Supabase, **na ordem** dos prefixos de data.

Ordem de execução (do mais antigo ao mais novo):
1. `roles_and_categories.sql`
2. `platform_categories_and_recurring.sql`
3. `new_producer_categories.sql`
4. `expand_account_entry_categories.sql`
5. `add_cancelado_event_status.sql`
6. `2026-06-29_add_taxa_cartao_category.sql`
7. `2026-06-30_shared_access_rls.sql`
8. `2026-07-01_cnab_config.sql`

---

## 11. Gotchas Conhecidos

| Problema | Causa | Solução |
|---|---|---|
| `git push` não publica | Vercel não está conectado ao GitHub | Sempre usar `npx vercel --prod --yes` |
| Nova categoria não aceita no banco | `CHECK constraint` nas tabelas | Migração SQL + atualizar `lib/types.ts` |
| Saldo do produtor fica negativo após pagar OP | `account_entries` de "pagamento" inserido por engano | Nunca inserir `account_entries` ao confirmar OP; só marcar `payment_orders.status = 'paid'` |
| Dialog preso em 384px | `DialogContent` base tem `sm:max-w-sm`; usar `max-w-*` sem prefixo não sobrescreve | Sempre usar `sm:max-w-*` em DialogContent customizado |
| Dados zerados para segundo usuário | RLS estava restrita ao criador | Migração `2026-06-30_shared_access_rls.sql` corrigiu (acesso para qualquer `authenticated`) |
| Limite 1000 linhas Supabase | Limite padrão da query | Usar `.range()` em loop para tabelas grandes |
| PowerShell BOM em env vars | `echo` do PowerShell adiciona BOM | Usar `printf` no Bash ou definir variáveis pela UI do Vercel |
| Taxas Hillarius diferentes | API retorna `feeService` mas Hillarius usa modelo flat R$0,50/ingresso | `isHillarius` detectado pelo nome; `effectiveFeeService = 0` para eles |
