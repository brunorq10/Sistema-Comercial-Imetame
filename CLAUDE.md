# Sistema Comercial Imetame

## Referência
BRD v3.0 é a fonte de verdade para regras de negócio, perfis, fluxos e requisitos.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Tabelas | TanStack Table v8 |
| Estilização | Tailwind CSS |
| Backend | Next.js Route Handlers (API Routes) |
| Banco | PostgreSQL |
| ORM | Prisma |
| Auth | NextAuth.js v5 (JWT + credentials) |
| E-mail | Nodemailer |
| Deploy | Vercel + Supabase (MVP) |

---

## Estrutura de pastas

```
src/
├── app/
│   ├── (auth)/login/
│   ├── orcamentos/
│   │   ├── layout.tsx        # layout com Sidebar + Topbar (via DashboardShell)
│   │   ├── painel/
│   │   ├── solicitacoes/
│   │   ├── propostas/
│   │   └── dashboard/
│   ├── acordos/
│   │   ├── layout.tsx        # layout com Sidebar + Topbar (via DashboardShell)
│   │   ├── painel/
│   │   ├── faturamento/
│   │   ├── nfs/
│   │   ├── previsao/
│   │   └── dashboard/
│   └── api/
├── components/
│   ├── ui/           # primitivos (button, input, badge, modal)
│   ├── tables/       # tabelas com TanStack
│   ├── forms/        # formulários por módulo
│   └── layout/       # sidebar, topbar, DashboardShell
├── lib/
│   ├── auth.ts
│   ├── prisma.ts
│   ├── notifications.ts
│   └── utils.ts
├── hooks/            # usePermissions, useFilters
├── types/            # tipos globais e DTOs
└── middleware.ts     # proteção de rotas por perfil
```

---

## Padrões obrigatórios

### Geral
- Nunca `any` — tipar tudo com TypeScript
- Server Components por padrão; `"use client"` apenas para interatividade real
- Mutations via Server Actions ou Route Handlers — zero lógica de negócio no cliente
- Validação com **Zod** em todo input (frontend e backend)
- Retornos tipados: `{ data, error }` — sem lançar exceções não tratadas

### Banco de dados
- Prisma para todas as queries — SQL raw apenas para CTEs complexas
- Toda tabela tem: `id`, `created_at`, `updated_at`, `created_by`
- Soft delete via `cancelled_at` + `cancel_reason` (exclusão não é permitida — BRD RN-18)
- Índices em todas as colunas usadas em filtros ou joins frequentes

### Autenticação e autorização
- NextAuth JWT com perfil embedado no token
- Hook `usePermissions()` centraliza todas as regras de acesso — nunca checar perfil inline
- `middleware.ts` protege rotas por grupo de perfil antes de renderizar

### Componentes
- Responsabilidade única — máximo ~150 linhas por componente
- Props sempre tipadas com `interface` nomeada (nunca inline)
- Formulários com `react-hook-form` + Zod resolver

### Notificações (BRD RN-16)
- Serviço centralizado em `lib/notifications.ts`
- Cada evento dispara: notificação in-app (inserção no banco) + e-mail via Nodemailer
- Envio de e-mail **assíncrono** — nunca bloquear a resposta da action

### Tabelas com colunas congeladas
- TanStack Table com `columnPinning` (left pin nas 3 primeiras colunas)
- Container com `overflow-x: auto` apenas no wrapper da tabela

---

## Paleta de cores (Tailwind — extender theme)

```js
// tailwind.config.ts
colors: {
  'green-primary': '#2E7D32',
  'green-dark':    '#1B5E20',
  'green-light':   '#E8F5E9',
  'auto-value':    '#1565C0', // campos calculados automaticamente
  'auto-bg':       '#EEF7EE', // fundo de campos automáticos
  'future':        '#6A1B9A', // coluna "Prev. anos seguintes"
  'future-bg':     '#F3E5F5',
}
```

---

## Regras de negócio rápidas

| # | Regra |
|---|-------|
| RN-07 | HH Total = Direto + Indireto; % Indireto = Indireto / Total — não editáveis |
| RN-12 | Status faturamento calculado apenas sobre NFs **ativas** |
| RN-17 | Resultado "Perdeu" exige motivo obrigatório da lista padronizada |
| RN-18 | Exclusão não permitida — cancelamento com justificativa e histórico |
| RN-19 | NF pode ter rateio por % entre itens; vencimento obrigatório (RN-21) |
| RN-20 | NF inativa mantida no registro, não entra no faturamento |
| RN-22 | Contratos multi-ano geram linha automática para o ano seguinte |
| RN-23 | Coluna "Prev. anos seguintes" totaliza valores fora do ano filtrado |
| RN-25 | Login com e-mail corporativo + senha; suporte a SSO configurável |

---

## Perfis

```ts
export const PERFIS = [
  'ADM_COMERCIAL',
  'GESTAO_COMERCIAL',
  'ANALISTA_CRITICO',
  'ORCAMENTISTA',
  'GESTAO_ACORDOS',
  'ACORDOS',
  'ADM_GERAL',
] as const;

export type Perfil = typeof PERFIS[number];
```

---

## Convenções de commit

```
feat(modulo): descrição curta
fix(modulo): descrição curta
refactor(modulo): descrição curta
```

Módulos: `auth` | `solicitacoes` | `propostas` | `faturamento` | `nfs` | `acordos` | `cadastros`
