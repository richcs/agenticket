# Agenticket

AI-powered support ticket management system. Incoming customer emails become tickets that are auto-classified, summarised, and replied to by an AI provider — high-confidence replies auto-send, low-confidence ones land in a review queue for human agents.

See [`project-scope.md`](./project-scope.md), [`tech-stack.md`](./tech-stack.md), and [`implementation-plan.md`](./implementation-plan.md) for full context.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite + React Router + Tailwind CSS |
| Backend | Node.js + Express 5 + TypeScript (ESM) |
| Database | PostgreSQL |
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

Install all workspace dependencies from the root:

```sh
npm install
```

Run client and server:

```sh
npm run dev:server   # http://localhost:3001
npm run dev:client   # http://localhost:5173
```

The Vite dev server proxies `/api/*` to the backend on port 3001, so the frontend uses relative URLs (`fetch('/api/...')`) in both dev and prod.

## Status

Phase 1 (foundation) is complete — both apps boot, frontend talks to backend through the proxy. See [`implementation-plan.md`](./implementation-plan.md) for what's next. Phases 6 (auth) and 7 (email ingestion) are intentionally deferred so the AI pipeline can be built and validated end-to-end first.
