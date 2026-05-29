# Implementation Plan

Tasks are grouped by phase. Ticket management and AI features are prioritised — they are the core value of the product. Auth and email ingestion are intentionally deferred: a stub auth and manual ticket creation are good enough to build and validate the AI pipeline end-to-end first.

---

## Phase 1 — Foundation & Project Setup

Goal: Empty but runnable frontend, backend, and database talking to each other.

- [ ] Create monorepo structure (`/client`, `/server`, `/shared`) with root `package.json` and workspaces
- [ ] Initialise backend: Express + TypeScript + `tsx` watch mode, basic `/api/health` endpoint
- [ ] Initialise frontend: Vite + React + TypeScript + Tailwind CSS + React Router
- [ ] Set up PostgreSQL locally (Docker Compose) and connect with a query library (`pg` or Knex)
- [ ] Add a migrations tool (e.g. `node-pg-migrate` or Knex migrations) and write a smoke-test migration
- [ ] Configure environment variables (`.env`, `.env.example`) and a config loader on the backend
- [ ] Add ESLint + Prettier shared config across client and server
- [ ] Wire frontend → backend with a sample fetch from `/api/health` to prove CORS and proxy work
- [ ] **Auth stub**: hardcoded dev user injected by middleware so protected routes work without a login screen

---

## Phase 2 — Core Ticket Management (no AI yet)

Goal: Agents can manage tickets manually end-to-end through the UI.

- [ ] Schema: `tickets` (id, subject, status, category, customer_email, customer_name, assignee_id, created_at, updated_at), `messages` (id, ticket_id, direction, body, author_id, created_at)
- [ ] Backend endpoints: `GET /tickets` (with filter/sort query params), `GET /tickets/:id`, `POST /tickets`, `PATCH /tickets/:id` (status, category, assignee), `POST /tickets/:id/messages`
- [ ] Frontend: ticket list page with filters (status, category, assignee) and sort
- [ ] Frontend: ticket detail page showing thread + reply composer
- [ ] Frontend: status transitions (open → pending → resolved → closed)
- [ ] Frontend: self-assign button (claim from shared queue)
- [ ] Frontend: "New ticket" form (used in place of email ingestion for now)
- [ ] Seed script: insert a handful of fake tickets for development

---

## Phase 3 — AI Classification & Summary

Goal: Every incoming ticket is auto-classified and summarised by the configured AI provider. Claude is the MVP implementation, but the rest of the codebase only depends on the provider interface.

- [ ] Define `AIProvider` interface (`/server/src/ai/provider.ts`) with methods: `classify`, `summarise`, `draftReply`, `embed`
- [ ] Claude implementation (`/server/src/ai/providers/claude.ts`) with retry + timeout
- [ ] Provider factory (`/server/src/ai/index.ts`) reads `AI_PROVIDER` env var (default: `claude`) and returns the matching implementation
- [ ] Versioned prompts in `/server/src/ai/prompts/` (provider-agnostic where possible)
- [ ] Service: `classifyTicket(subject, body)` → one of `billing | technical | account | general` (uses `AIProvider.classify`)
- [ ] Service: `summariseTicket(thread)` → short summary string (uses `AIProvider.summarise`)
- [ ] Hook into ticket creation: classify + summarise on creation; persist `category` and `summary` on ticket
- [ ] Schema: add `summary` column to `tickets`
- [ ] Frontend: show category badge in list; show AI summary at top of detail view
- [ ] Add a "Re-run AI" admin action on a ticket for debugging
- [ ] Unit tests for classification and summarisation services using a stub `AIProvider`

---

## Phase 4 — Knowledge Base & Retrieval (RAG)

Goal: Admin-uploaded documents and past resolved tickets are searchable as context for replies.

- [ ] Enable `pgvector` extension on Postgres
- [ ] Schema: `kb_documents` (id, title, source_type, original_filename, uploaded_at), `kb_chunks` (id, document_id, content, embedding vector)
- [ ] Backend: document upload endpoint (PDF / text / markdown), chunking, embedding via `AIProvider.embed`
- [ ] Backend: index resolved tickets into `kb_chunks` (sync for MVP; can move to background job later)
- [ ] Service: `retrieveContext(query)` → top-N relevant chunks via vector similarity
- [ ] Frontend: KB management page — upload, list, delete documents
- [ ] Re-index trigger when a ticket is marked resolved
- [ ] Unit tests for chunking and retrieval

---

## Phase 5 — AI Reply Generation & Confidence Routing

Goal: Tickets get a drafted reply; high-confidence drafts auto-send, low-confidence go to a review queue.

- [ ] Service: `draftReply(ticket, retrievedContext)` → `{ body, confidence }` (uses `AIProvider.draftReply`)
- [ ] Confidence: provider returns a confidence score (0–1) with rationale; persist both
- [ ] Schema: `ticket_drafts` (id, ticket_id, body, confidence, rationale, status: pending_review | sent | rejected, created_at)
- [ ] Pipeline on new ticket: classify → summarise → retrieve → draft → if confidence ≥ 0.75 mark `auto_send`; else mark `pending_review`
- [ ] "Send" action records the outgoing message in `messages` (actual email delivery comes in Phase 7)
- [ ] Frontend: "Review queue" view filtered to `pending_review` drafts
- [ ] Frontend: agent UI to approve / edit / reject a draft
- [ ] Make threshold a config value (env or admin setting) so it can be tuned later
- [ ] Unit tests for the routing logic and threshold edge cases

---

## Phase 6 — Authentication & User Management

Goal: Replace the auth stub with real login, sessions, and admin-managed users.

- [ ] Schema: `users` (id, email, password_hash, role, name, created_at), `sessions` (id, user_id, expires_at)
- [ ] Backend: password hashing (`bcrypt`), session middleware (`express-session` + `connect-pg-simple`)
- [ ] Endpoints: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- [ ] Role-based middleware (`requireAuth`, `requireAdmin`) and apply to existing routes
- [ ] Admin endpoints: `POST /users/invite` (create with temp password / set-password link), `GET /users`, `DELETE /users/:id`
- [ ] Frontend: login page, auth context / hook, protected route wrapper
- [ ] Frontend: admin-only "Users" page with invite + remove
- [ ] Seed script: create one initial admin user
- [ ] Remove the Phase 1 auth stub

---

## Phase 7 — Email Ingestion & Outbound Reply

Goal: Real emails create tickets; agent replies (and auto-sent AI drafts) are emailed back to customers.

- [ ] Pick provider (SendGrid / Postmark / Mailgun) and configure inbound parse webhook
- [ ] Endpoint: `POST /webhooks/email/inbound` — validates signature, parses sender / subject / body
- [ ] Logic: match existing ticket by message threading headers or subject token; otherwise create new ticket
- [ ] Outbound: backend service to send email via same provider; replace the "send" action from Phase 5 to also deliver email
- [ ] Threading: include a token / Message-ID in outgoing emails so replies thread correctly
- [ ] Use a tunneling tool (ngrok / localtunnel) for local webhook testing
- [ ] Handle attachments minimally (record presence; full storage is out of scope for MVP)

---

## Phase 8 — Dashboard & Polish

Goal: Production-ready surface, observability, and deployment.

- [ ] Dashboard page: ticket counts by status / category, items needing review, recent activity
- [ ] Empty states, loading skeletons, error toasts across the app
- [ ] Pagination on ticket list
- [ ] Basic audit log for AI actions (classification, send, threshold breaches)
- [ ] Logging + error reporting (e.g. pino on backend, simple console capture on frontend)
- [ ] Decide deployment target (Render / Fly.io / AWS) and write deploy docs
- [ ] Seed Postgres + run migrations in production environment
- [ ] Smoke-test full flow in production: send real email → see AI reply

---

## Cross-cutting (do throughout, not a phase)

- Unit tests for service-layer logic (classification, retrieval, draft generation, confidence routing)
- Type sharing between client and server via `/shared` package (DTOs, enums)
- Keep AI prompts in version-controlled files under `/server/src/ai/prompts/` so changes are reviewable
