# Agenticket

AI-powered support ticket management system. Incoming customer emails become tickets that are auto-classified, summarised, and replied to by an AI provider — high-confidence replies auto-send, low-confidence ones land in a review queue for human agents.

See [`project-scope.md`](./project-scope.md), [`tech-stack.md`](./tech-stack.md), and [`implementation-plan.md`](./implementation-plan.md) for full context.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite + React Router + Tailwind CSS |
| Backend | Node.js + Express 5 + TypeScript (ESM) |
| Database | PostgreSQL via Prisma ORM (local dev: Docker Compose) |
| Auth | Database sessions |
| AI | Pluggable `AIProvider` interface — MVP implementation: Claude (Anthropic) |
| Email | Inbound webhook (SendGrid / Postmark / Mailgun) |

The AI provider is abstracted behind an interface so swapping vendors (or running a local model) is a one-file change. Code outside `/server/src/ai/` depends only on the interface, never a vendor SDK.

## Structure

npm workspaces monorepo:

```
agenticket/
├── client/   # Vite + React + TS — port 5173, proxies /api → :3001
└── server/   # Express + TS (ESM) — port 3001
```

## Development

**One-time setup** — copy the env template and start Postgres:

```sh
cp server/.env.example server/.env   # adjust DATABASE_URL if needed
docker compose up -d                 # starts the helpdesk Postgres on :5432
npm install                          # installs deps + runs prisma generate
```

**Run client and server:**

```sh
npm run dev:server   # http://localhost:3001
npm run dev:client   # http://localhost:5173
```

The Vite dev server proxies `/api/*` to the backend on port 3001, so the frontend uses relative URLs (`fetch('/api/...')`) in both dev and prod.

**Database workflow** (from repo root):

```sh
npm run -w server db:migrate   # create / apply migrations against helpdesk
npm run -w server db:push      # quick prototype push without a migration file
npm run -w server db:studio    # open Prisma Studio
```

**Health checks:** `GET /api/health` (server alive) and `GET /api/db-health` (Postgres reachable).

## Status

Phase 1 (foundation) is complete — both apps boot, frontend talks to backend through the proxy. See [`implementation-plan.md`](./implementation-plan.md) for what's next. Phases 6 (auth) and 7 (email ingestion) are intentionally deferred so the AI pipeline can be built and validated end-to-end first.
