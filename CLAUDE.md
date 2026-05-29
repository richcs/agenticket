# Agenticket

AI-powered support ticket management system. Customers email in → tickets are created → the configured AI provider classifies, summarises, and drafts replies → high-confidence drafts auto-send, low-confidence go to a review queue managed by agents.

For full context see:
- `project-scope.md` — features, users, decisions
- `tech-stack.md` — stack choices
- `implementation-plan.md` — phased task breakdown

## Stack

- **Frontend**: React 18 + TypeScript + Vite + React Router + Tailwind CSS (Tailwind not wired up yet)
- **Backend**: Node.js + Express 5 + TypeScript (ESM, run via `tsx`)
- **Database**: PostgreSQL via **Prisma ORM**. Schema lives at `server/prisma/schema.prisma`; the `PrismaClient` singleton is exported from `server/src/db.ts` — never instantiate `new PrismaClient()` elsewhere. Local dev runs Postgres via `docker-compose.yml` at the repo root (database name: `helpdesk`).
- **Auth**: database sessions (not wired up yet)
- **AI**: pluggable provider interface (`AIProvider`) — not wired up yet. MVP implementation will be Claude (Anthropic). Code outside `/server/src/ai/` must depend only on the interface, never the vendor SDK.
- **Email**: inbound webhook (SendGrid / Postmark / Mailgun) — not wired up yet

## Structure

npm workspaces monorepo:

```
agenticket/
├── client/   # Vite + React + TS — port 5173, proxies /api → :3001
└── server/   # Express + TS (ESM) — port 3001, /api/* endpoints
```

## Commands

Run from the repo root:

```sh
docker compose up -d                # start the helpdesk Postgres (one-time per session)
npm install                         # install all workspace deps; runs prisma generate
npm run dev:server                  # backend on :3001
npm run dev:client                  # frontend on :5173
npm run build                       # build both workspaces
npm run -w server db:migrate        # create / apply migrations against the helpdesk DB
npm run -w server db:studio         # open Prisma Studio against the helpdesk DB
```

The Vite dev server proxies `/api/*` to the backend, so the frontend calls relative URLs (`fetch('/api/...')`) in both dev and prod.

## Conventions

- **ESM everywhere** (`"type": "module"`). Imports must include the `.js` extension when targeting compiled output, but `tsx` and Vite handle `.ts` / `.tsx` imports without extension during dev.
- **Type-only imports** for types: `import { type Request } from 'express'`.
- **Display name** is "Agenticket" (capitalised) in user-facing strings; npm package names and service slugs stay lowercase (`agenticket`, `agenticket-server`, `@agenticket/*`).
- **Shared types** between client and server should eventually live in `/shared` (not created yet) — for now duplicate small DTOs.
- **AI prompts** live in `/server/src/ai/prompts/` (not created yet) as versioned files so changes are reviewable in diffs.
- **AI provider isolation**: the `AIProvider` interface lives at `/server/src/ai/provider.ts`; concrete implementations under `/server/src/ai/providers/` (e.g. `claude.ts`); the factory at `/server/src/ai/index.ts` picks one via the `AI_PROVIDER` env var. Importing a vendor SDK outside that directory is a code smell — wrap it behind the interface instead.

## Fetching library docs — use context7

When working with any library, framework, SDK, or CLI tool in this project — Express, React, Vite, React Router, Tailwind, `pg`, `pgvector`, the Anthropic SDK, SendGrid/Postmark/Mailgun, etc. — use the **context7 MCP server** to fetch up-to-date documentation before writing code, even for libraries you think you know well. Training data may lag behind current APIs.

Workflow:
1. `mcp__context7__resolve-library-id` with the library name to get the Context7 ID
2. `mcp__context7__query-docs` with that ID and a specific question (e.g. "express 5 error handler middleware signature", not just "express")

Skip context7 for: refactoring existing code, debugging business logic, code review, or general programming concepts.

## What's done vs. what's next

**Done (Phase 1 of `implementation-plan.md`):**
- Monorepo scaffolded with npm workspaces
- Express + TS backend with `/api/health` and `/api/db-health`
- Vite + React + TS frontend with health-check display
- CORS + proxy wired and verified end-to-end
- Prisma + Postgres set up (schema, client singleton, Docker Compose for local `helpdesk` DB)

**Next:** Phase 2 — core ticket management (schema models for tickets/messages, CRUD endpoints, ticket list/detail UI). See `implementation-plan.md`. Phases 6 (auth) and 7 (email ingestion) are intentionally deferred so AI features land sooner.
