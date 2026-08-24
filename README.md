# Finance OS

A personal financial optimisation platform — not a budgeting app. It builds a **deterministic
model** of your finances, learns your actual behaviour, forecasts cash flow, and recommends what
your money should do next — **showing the full reasoning for every recommendation**.

The deterministic financial engine is the product. An (optional, later) AI layer only ever
*explains* figures the engine computes — it never invents balances, rates, or recommendations.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict)
- **Tailwind v4** (calm, theme-aware, no chart/component-library bloat)
- **Drizzle ORM** + **PostgreSQL** — local dev uses embedded **pglite** (zero config), a networked
  Postgres via `DATABASE_URL`
- **Vitest** for the engine unit tests · **argon2** password hashing + server sessions

## Architecture

```
src/core/       Pure deterministic engine (no DB/framework imports) — the product. Fully unit-tested.
                ledger · categorise · recurring · behaviour · forecast · liquidity · optimise ·
                recommend · state · goals · analyse (orchestrator) · money · dates · stats
src/server/     db (Drizzle schema, client, migrate, seed) · auth (sessions) · services (snapshot,
                analysis, transactions, import, reference)
src/app/        Auth pages + (app) dashboard, accounts, transactions (+ CSV import), behaviour,
                forecast, recommendations, health
```

Engines take a plain `FinancialSnapshot` (built by `services/snapshot.ts` from DB rows → DB-free
`core/types.ts`). Pages are React Server Components calling the service layer directly. All money is
**integer pence**; rates are **integer basis points**.

## Running it

Local dev needs **no configuration** — it uses an embedded Postgres at `./.pglite`.

```bash
npm install
npm run db:migrate   # create schema
npm run db:seed      # deterministic 14-month demo user
npm run dev          # http://localhost:3000
```

Demo login: **demo@example.com** / **demo12345**

To use a real Postgres instead, set `DATABASE_URL` (see `.env.example`) — the driver switches
automatically. Note: pglite is single-process — **stop `npm run dev` before running `db:seed`/`db:migrate`**.

```bash
npm test          # engine unit tests (deterministic financial calculations)
npm run typecheck
```

## What it does (the proven loop)

1. Create/seed accounts → import CSV or seed 12+ months of transactions
2. Categorise transactions (rule-based; corrections are learned)
3. Detect recurring income/bills/subscriptions/transfers
4. Learn behavioural spending baselines, ranges, trends, and signals (with confidence tiers)
5. Forecast cash flow at 7/30/90/365 days (KNOWN / RECURRING / PREDICTED, with confidence bands)
6. Compute liquidity requirements — buffer, emergency fund, and a **conservative surplus** (never
   breaches the 30-day low point)
7. Generate deterministic allocation recommendations (clear high-cost debt → close emergency gap →
   best accessible savings → keep a buffer), honouring user rules
8. Every recommendation carries a full **explanation trace**: What / Why / Why this account /
   What if I don't / Confidence — traceable to the underlying data

Transfers between your own accounts are never counted as spending. Recommendations are financial
planning suggestions and educational information — **not regulated financial advice**, and no money
is moved (execution is a mocked, disabled boundary).

## Pages

Dashboard (4-question home) · Accounts · Transactions (+ CSV import wizard) · Behaviour · Forecast ·
What if? (scenario lab) · Recommendations (with approve/reject/snooze) · Health · Assistant.

## AI assistant (optional)

A conversational assistant that answers **only** from your real data — it calls read-only tools over
the deterministic engine and never invents figures (the safety boundary in spec §32). Enable it by
setting `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`, default `claude-opus-5`). Without a
key, every other part of the app works unchanged.

## Status

**Complete.** Foundation → ledger → behaviour → forecast → liquidity → optimisation → dashboard →
scenarios → AI assistant → approval workflow. 56 engine unit tests; production build clean. Financial
execution is a mocked, disabled boundary — no money is moved.
