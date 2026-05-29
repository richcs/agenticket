# Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript, Tailwind CSS, React Router |
| Backend | Node.js + Express + TypeScript |
| Authentication | Database sessions |
| Database | PostgreSQL (via Prisma ORM; local dev runs in Docker Compose) |
| AI Provider | Pluggable provider interface — MVP implementation: Claude (Anthropic) |
| Email Ingestion | Inbound webhook — SendGrid, Postmark, or Mailgun |
| Deployment | TBD |
