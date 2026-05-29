# AI-Powered Ticket Management System

## Problem

We receive hundreds of support emails daily. Our agents manually read, classify, and respond to each ticket — which is slow and leads to impersonal, canned responses.

## Solution

Build a ticket management system that uses AI to automatically classify, respond to, and route support tickets — delivering faster, more personalized responses to customers while freeing up agents for complex issues.

## Users

- **Customers** — send support emails that become tickets
- **Agents** — manage, respond to, and resolve tickets from a shared queue
- **Admins** — manage agents, configure the system, upload knowledge base documents

## Features

### Core Ticket Workflow
- Receive support emails via inbound webhook (SendGrid / Postmark / Mailgun) and create tickets
- Ticket list with filtering and sorting
- Ticket detail view
- Shared queue — agents self-assign tickets (no auto-routing in MVP)

### AI Capabilities
- **Auto-classification** — categorize each ticket on arrival into one of: Billing & Payments, Technical / Bug, Account & Access, General Enquiry
- **AI summary** — generate a concise summary of each ticket for quick agent scanning
- **AI-suggested reply** — draft a human-friendly response using the knowledge base
- **Confidence-based auto-send** — if AI confidence ≥ 75%, send the reply automatically; below 75%, queue the draft for agent review and approval before sending
- **Pluggable AI provider** — features depend on a provider interface (classify / summarise / draft / embed), not a specific vendor. MVP ships with a Claude (Anthropic) implementation; swapping providers should not require changes outside the AI module.

### Knowledge Base
- Admins upload documents (PDFs, FAQs, etc.) as the primary retrieval source
- Past resolved tickets and their responses are used as a secondary retrieval source
- RAG (retrieval-augmented generation) powers reply generation

### User Management (Admin only)
- Invite and remove agents via email
- Two roles: **Admin** (full access + user management) and **Agent** (ticket management only)

### Dashboard
- View and manage all tickets
- Filter by status, category, assignee, and date
- Surface tickets pending agent review (AI confidence < 75%)

## Out of Scope (MVP)

- Ticket routing / auto-assignment to specific agents or teams
- SLA tracking and breach alerts
- Integrations with CRM or external helpdesk tools (greenfield build)
- Custom roles or granular permissions beyond Admin / Agent
