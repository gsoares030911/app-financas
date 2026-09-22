# Mapa de Tabelas — claude-financas

Gerado em 22/09/2026 direto da introspecção do banco ao vivo (schema real via
PostgREST), não só dos arquivos de migration — porque 3 tabelas
(`payment_orders`, `audit_logs`, `bilheteria_api_imports`) foram criadas
direto no SQL Editor do Supabase e nunca tiveram migration commitada no repo.
Isso foi corrigido: agora existe
`supabase/migrations/2026-09-22_payment_orders_audit_logs_bilheteria_imports.sql`
reconstruindo essas 3 a partir da estrutura real.

## ⚠️ Antes de tudo: "banco novo" também significa logins novos

Este mapa cobre o **schema `public`** (tabelas de negócio). Os logins dos
usuários (email/senha) **não vivem nessas tabelas** — ficam em `auth.users`,
um schema interno do Supabase Auth que não é possível recriar só com SQL do
schema `public`. Se o servidor novo for um **projeto Supabase novo** (banco
literalmente diferente), você vai precisar:

1. Criar cada usuário de novo em **Authentication → Users** no painel do
   projeto novo (ou via convite por e-mail).
2. Depois, inserir a linha correspondente em `public.profiles` (mesmo `id`
   do `auth.users`, com o `role` certo) — ou deixar o próprio app criar
   automaticamente no primeiro login (`getOrCreateProfile` em
   `lib/supabase/profile.ts` já faz isso, com fallback pra role `admin`).

Se "outro servidor" for só trocar a hospedagem do **Next.js** (Vercel →
outro lugar) mas continuar no **mesmo projeto Supabase**, nada disso é
necessário — é só configurar as mesmas env vars (`NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, etc.) no novo host e pronto, o banco continua
sendo o mesmo.

## Como recriar o schema do zero

Rode os arquivos abaixo **nesta ordem exata** no SQL Editor do projeto
Supabase novo (a ordem dos nomes de arquivo NÃO é a ordem de execução —
várias migrations não têm prefixo de data e uma tabela precisa existir antes
de uma função SQL que a referencia):

```
1.  supabase/schema.sql
2.  supabase/migrations/add_cancelado_event_status.sql
3.  supabase/migrations/roles_and_categories.sql
4.  supabase/migrations/platform_categories_and_recurring.sql
5.  supabase/migrations/expand_account_entry_categories.sql
6.  supabase/migrations/new_producer_categories.sql          (não altera nada — pode pular)
7.  supabase/migrations/2026-06-29_add_taxa_cartao_category.sql
8.  supabase/migrations/2026-06-30_shared_access_rls.sql
9.  supabase/migrations/2026-07-01_cnab_config.sql
10. supabase/migrations/2026-07-13_events_billing_period.sql
11. supabase/migrations/2026-07-13_producers_service_fee_pct.sql
12. supabase/migrations/2026-07-14_equipment_code.sql
13. supabase/migrations/2026-07-14_pdv_locations.sql
14. supabase/migrations/2026-07-14_returned_to_network.sql
15. supabase/migrations/2026-07-14_machines.sql
16. supabase/migrations/2026-07-14_equipment_bonificada.sql
17. supabase/migrations/2026-07-14_machines_drop_serial_unique.sql
18. supabase/migrations/2026-07-14_equipment_allow_zero_amount.sql
19. supabase/migrations/2026-07-14_machines_returned.sql
20. supabase/migrations/2026-07-17_producers_cpf_cnpj.sql
21. supabase/migrations/2026-09-22_payment_orders_audit_logs_bilheteria_imports.sql   ← tem que vir ANTES do próximo item (ele usa payment_orders numa função SQL)
22. supabase/migrations/2026-07-20_global_producer_balances.sql
23. supabase/migrations/2026-07-20_rankings_rpcs.sql
24. supabase/migrations/2026-08-10_pendencias.sql
25. supabase/migrations/2026-08-10_producer_balances_fn.sql
26. supabase/migrations/2026-08-10_producers_balance_view.sql
27. supabase/migrations/2026-08-10_profiles_producer_id.sql
28. supabase/migrations/2026-08-25_deduplicate_producers.sql  (limpeza de dados duplicados — PULAR em banco novo/vazio)
29. supabase/migrations/2026-08-25_deduplicate_v2.sql          (idem — PULAR em banco novo/vazio)
30. supabase/migrations/2026-08-26_events_recovery_applied_at.sql
31. supabase/migrations/2026-09-06_cnab_config_insert_policy.sql
32. supabase/migrations/2026-09-06_cnab_config_limite_diario.sql
```

Todos os `CREATE TABLE`/`ADD COLUMN` usam `IF NOT EXISTS`, então rodar um
arquivo daqui duas vezes por engano não quebra nada.

## Tabelas (schema `public`)

Todas usam `id uuid primary key default gen_random_uuid()`, exceto onde
indicado. RLS: todas seguem o padrão **acesso compartilhado** — qualquer
usuário autenticado lê/escreve tudo (`using (auth.role() = 'authenticated')`)
— **exceto `profiles`**, que é restrita a `auth.uid() = id` (cada um só
mexe no próprio perfil; a tela de gestão de usuários usa o client admin no
servidor, contornando essa regra com verificação de role em código).

### `producers` — Produtores culturais (cadastro)
| Coluna | Tipo | Obrigatório | Nota |
|---|---|---|---|
| id | uuid | ✔ | PK |
| user_id | uuid | ✔ | quem cadastrou (auditoria, não filtro de visibilidade) |
| full_name | text | ✔ | |
| email | text | | |
| phone | text | | |
| pix_key | text | | |
| bank_name | text | | |
| bank_agency | text | | |
| bank_account | text | | |
| notes | text | | |
| service_fee_pct | numeric | | taxa de serviço contratual (%), sobrescreve o valor da API quando preenchida |
| cpf_cnpj | text | | obrigatório pra TED/PIX no CNAB |
| created_at | timestamptz | ✔ (default now()) | |

### `equipment_rentals` — Aluguel de equipamento por produtor
| Coluna | Tipo | Obrigatório | Nota |
|---|---|---|---|
| id | uuid | ✔ | PK |
| producer_id | uuid | ✔ | FK → producers.id (cascade) |
| equipment_name | text | ✔ | |
| equipment_code | text | | `EQ-001`, `EQ-002`… |
| monthly_amount | numeric | ✔ | |
| billing_day | integer | ✔ | 1–28 |
| start_date / end_date | date | start ✔ | |
| is_active | boolean | ✔ (default true) | controla cobrança automática |
| is_bonificada | boolean | ✔ (default false) | zera cobrança |
| returned_to_network | boolean | ✔ (default false) | controla localização física |
| returned_at | date | | |
| machine_id | uuid | | FK → machines.id (set null) |
| notes | text | | |
| created_at | timestamptz | ✔ | |

### `events` — Eventos/shows importados
| Coluna | Tipo | Obrigatório | Nota |
|---|---|---|---|
| id | uuid | ✔ | PK |
| producer_id | uuid | ✔ | FK → producers.id (cascade) |
| name | text | ✔ | |
| event_date | date | ✔ | |
| billing_from / billing_to | date | | período de referência (usado nos filtros, não `event_date`) |
| gross_revenue | numeric | ✔ (default 0) | |
| platform_fee | numeric | ✔ (default 0) | |
| net_amount | numeric | ✔ | `check (net_amount >= 0)` |
| status | text | ✔ (default pending) | pending / settled / cancelado |
| notes | text | | |
| recovery_applied_at | timestamptz | | |
| created_at | timestamptz | ✔ | |

### `account_entries` — Conta corrente do produtor (créditos/débitos)
| Coluna | Tipo | Obrigatório | Nota |
|---|---|---|---|
| id | uuid | ✔ | PK |
| producer_id | uuid | ✔ | FK → producers.id (cascade) |
| event_id | uuid | | FK → events.id (set null) |
| equipment_rental_id | uuid | | FK → equipment_rentals.id (set null) |
| entry_type | text | ✔ | `credito` \| `debito` |
| category | text | ✔ | ver CHECK em `expand_account_entry_categories.sql` |
| description | text | ✔ | |
| amount | numeric | ✔ | |
| date | date | ✔ | |
| reference_month | text | | usado no anti-duplicata de cobrança mensal |
| created_at | timestamptz | ✔ | |

### `platform_entries` — Financeiro da Bilheteria Express (P&L)
| Coluna | Tipo | Obrigatório | Nota |
|---|---|---|---|
| id | uuid | ✔ | PK |
| user_id | uuid | ✔ | FK → auth.users.id (cascade) |
| entry_type | text | ✔ | receita / despesa |
| category | text | ✔ | ver `PlatformCategory` em lib/types.ts |
| description | text | ✔ | |
| amount | numeric | ✔ | |
| date | date | ✔ | |
| event_id | uuid | | FK → events.id (set null) |
| producer_id | uuid | | FK → producers.id (set null) |
| pdv_location_id | uuid | | FK → pdv_locations.id (set null) |
| reference_month | text | | |
| created_at | timestamptz | ✔ | |

### `payment_orders` — Ordens de Pagamento
| Coluna | Tipo | Obrigatório | Nota |
|---|---|---|---|
| id | uuid | ✔ | PK |
| user_id | uuid | ✔ | FK → auth.users.id (cascade) |
| producer_id | uuid | ✔ | FK → producers.id (cascade) |
| order_number | text | ✔ | `OP-2026-001`, sequencial por ano |
| amount | numeric | ✔ | |
| status | text | ✔ (default pending) | pending / paid |
| event_ids | text[] | ✔ (default `{}`) | eventos cobertos por esta OP |
| period_from / period_to | date | | |
| paid_at | timestamptz | | |
| created_at | timestamptz | ✔ | |

### `machines` — Inventário físico de máquinas
| Coluna | Tipo | Obrigatório | Nota |
|---|---|---|---|
| id | uuid | ✔ | PK |
| serial_number | text | ✔ | **sem** unique constraint (removida em `machines_drop_serial_unique.sql`) |
| model | text | ✔ | na prática, mesmo valor de `serial_number` (ver `MachineDialog.tsx`) |
| operator | text | ✔ | ex: Rede, Cielo, Stone |
| received_at | date | | |
| returned_to_network | boolean | ✔ (default false) | fonte de verdade do status "Devolvida" |
| returned_at | date | | |
| notes | text | | |
| created_at | timestamptz | ✔ | |

### `pdv_locations` — Pontos de venda físicos
| Coluna | Tipo | Obrigatório | Nota |
|---|---|---|---|
| id | uuid | ✔ | PK |
| name | text | ✔ | |
| store_name | text | ✔ | loja parceira |
| address / phone | text | | |
| monthly_cost | numeric | ✔ (default 0) | |
| billing_day | integer | ✔ (default 1) | |
| is_bonificada | boolean | ✔ (default false) | |
| is_active | boolean | ✔ (default true) | |
| returned_to_network | boolean | ✔ (default false) | |
| returned_at | date | | |
| machine_id | uuid | | FK → machines.id (set null) |
| notes | text | | |
| created_at | timestamptz | ✔ | |

### `cnab_config` — Config da empresa pagadora (singleton, 1 linha)
| Coluna | Tipo | Obrigatório | Nota |
|---|---|---|---|
| id | uuid | ✔ | PK — o app sempre usa o id fixo `00000000-0000-0000-0000-000000000001` |
| cnpj / nome / agencia / digito_agencia / conta / digito_conta | text | ✔ (default '') | dados bancários pro CNAB 240 |
| limite_diario | numeric | | teto de pagamento/dia — bloqueia geração de CNAB se excedido (não faz parte do layout do arquivo) |
| updated_at | timestamptz | ✔ | |
| updated_by | uuid | | FK → auth.users.id |

> Depois de recriar o schema, insira a linha singleton:
> `insert into public.cnab_config (id) values ('00000000-0000-0000-0000-000000000001');`
> — sem isso, o primeiro salvamento no modal de CNAB depende do `upsert` (que
> já funciona desde a policy de INSERT adicionada em 06/09/2026).

### `bilheteria_api_imports` — Histórico bruto das importações
| Coluna | Tipo | Obrigatório | Nota |
|---|---|---|---|
| id | uuid | ✔ | PK |
| user_id | uuid | ✔ | FK → auth.users.id (cascade) |
| dt_inicial / dt_final | date | ✔ | período consultado |
| imported_at | timestamptz | ✔ (default now()) | |
| total_registros | integer | ✔ (default 0) | |
| raw_data | jsonb | ✔ | resposta crua da API externa — usada pra auditoria/reconciliação de arredondamento |

### `audit_logs` — Auditoria de ações
| Coluna | Tipo | Obrigatório | Nota |
|---|---|---|---|
| id | uuid | ✔ | PK |
| user_id | uuid | | FK → auth.users.id (set null) |
| user_email | text | | |
| action | text | ✔ | INSERT / UPDATE / DELETE |
| table_name | text | ✔ | |
| record_id | text | | |
| old_data / new_data | jsonb | | |
| created_at | timestamptz | ✔ | |

### `profiles` — Roles/permissões (1 linha por usuário)
| Coluna | Tipo | Obrigatório | Nota |
|---|---|---|---|
| id | uuid | ✔ | PK — **mesmo id do `auth.users`** |
| role | text | ✔ (default admin) | super_admin \| admin \| financeiro_bilheteria \| producer \| financeiro_produtor |
| producer_id | uuid | | FK → producers.id (set null) — só usado quando role = producer |
| email | text | | |
| created_at | timestamptz | ✔ | |

> RLS diferente do resto: `using (auth.uid() = id)`. `super_admin` não é um
> valor "mágico" no banco — é atribuído automaticamente pelo e-mail hardcoded
> em `lib/utils/auth.ts` toda vez que o perfil é criado/lido.

### `categories` — Categorias de lançamento (conta corrente + plataforma)
| Coluna | Tipo | Obrigatório | Nota |
|---|---|---|---|
| id | uuid | ✔ | PK |
| user_id | uuid | ✔ | |
| slug / name | text | ✔ | |
| entry_type | text | ✔ | credito / debito / ambos |
| color | text | ✔ (default gray) | |
| is_active | boolean | ✔ (default true) | |
| is_system | boolean | ✔ (default false) | categorias padrão do sistema |
| sort_order | integer | ✔ (default 99) | |
| scope | text | ✔ (default producer) | producer \| platform |
| created_at | timestamptz | ✔ | |

### `recurring_expenses` — Despesas recorrentes (Bilheteria Express)
| Coluna | Tipo | Obrigatório | Nota |
|---|---|---|---|
| id | uuid | ✔ | PK |
| user_id | uuid | ✔ | |
| description / category | text | ✔ | |
| amount | numeric | ✔ | |
| billing_day | integer | ✔ (default 1) | |
| is_active | boolean | ✔ (default true) | |
| last_launched_month | text | | anti-duplicata mensal |
| created_at | timestamptz | ✔ | |

### `transactions` — Legado, não usado pelas telas atuais
Tabela do protótipo inicial (finanças pessoais simples), mantida no schema
mas sem uso nas rotas atuais do app. Pode ser criada por completude ou
ignorada — nenhuma tela de `/dashboard` depende dela hoje.

## Views e funções (RPC)

- **`producers_with_balance`** (view) — `producers.*` + `balance` calculado.
  Usada na listagem de produtores com filtro por saldo (a_pagar/devendo/zerado).
- **`get_global_producer_balances`** (função SQL) — totais agregados pros
  cards do topo da tela de Produtores. Depende de `producers`,
  `account_entries`, `payment_orders`.
- **RPCs de ranking** (`2026-07-20_rankings_rpcs.sql`) — melhores/piores
  produtores por receita.
- **`get_producer_balance`** (`2026-08-10_producer_balances_fn.sql`) — saldo
  de um produtor específico.

## Env vars necessárias no servidor novo

Ver `README.md` → seção "Rodando localmente" pra lista completa
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `BILHETERIA_API_TOKEN`, `CRON_SECRET`,
`RESEND_API_KEY`, `RESEND_FROM_EMAIL`) — todas apontando pro projeto
Supabase novo, se for o caso.
