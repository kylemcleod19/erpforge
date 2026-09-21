# ERP Forge - a software factory

ERP Forge is a test of how far AI could go in helping create hyper-vertical SaaS. It is a way to test how much of the product discovery and design process can be assisted by AI and what that company would look like. I have been working in manufacturing most of my life, so I started there.

**A custom ERP software factory for small manufacturers, built entirely on AI agents.**

Most small manufacturers don't run SAP - they run spreadsheets, whiteboards, or a hodge podge of off-the-shelf and low-code tools. Large ERPs are too expensive and not flexible enough to fit many manufacturers. 

ERP Forge tests this hypothesis:

1. Development is cheap due to AI
1. Cheap development means you should build near-custom software for each customer
1. The blocker and expensive resource is now product and business requirements gathering
1. AI can assist in the requirements gathering
1. Basic ERPs can be produced through AI interviews, documentation, and coding

This is a stretch hypothesis, meaning I think it represents a way of doing software in a few years, not in the present.

**Live:** [erpforge.kyle-mcleod.io](https://erpforge.kyle-mcleod.io)

---

## How it works

Four services, each doing one job, coordinating over a shared data volume:

```
Interviewer Service ──┐
                       ├── shared volume ── customers/<slug>/
Coder Service ─────────┤
                       │
Docs Service ──────────┘
      ↕ HTTP
Web Service (Next.js) ← thin orchestrator, delegates via HTTP
```

1. **Interviewer** — runs a structured, multi-phase AI interview with the customer and compiles the transcript into a validated `spec.json`
2. **Dev Agent (Coder)** — reads `spec.json` and generates a complete Next.js ERP application, phase by phase
3. **Docs** — generates on-demand documentation from the spec and the build manifest
4. **Web** — the customer-facing Next.js app; a thin REST layer that delegates the real work to the three agent services above

### The interview

The interviewer runs the conversation through seven phases — intake, module routing, per-module interviews, gap analysis, human review, spec compilation, and completion. Claude selects which of ten interview modules apply to a given business (always: BOM, customer orders, inventory, purchasing, production; conditional: shipping, finance, quality, reporting, equipment) rather than asking every customer the same fixed questionnaire. The output is a schema-validated `spec.json` — a structured, versioned description of that manufacturer's entities, workflows, and feature requirements.

### The build

The dev agent takes that spec and builds a real application across eight phases — plan, scaffold, database, API, frontend, integrations, AI touchpoints, docs — tracking every generated file in a build manifest so the process is resumable and auditable. What comes out isn't a mockup: it's a deployable Next.js app with its own database schema, API routes, and UI, generated specifically for the workflows that customer described.

---

## Tech stack

- **Next.js** (App Router) + TypeScript, strict mode
- **Claude** (Sonnet for interview/routing/compilation reasoning, Haiku for fast extraction)
- **Drizzle ORM** + Postgres
- **Zod** for API boundary validation
- **Express** microservices for the interviewer, coder, and docs agents
- **Railway** for hosting, with a shared volume across the three agent services
- **GitHub Actions** for CI gating (typecheck + schema validation + tests), with Railway's native GitHub integration handling deploys

## Repo layout

```
erpforge/
├── interviewer/     interview agent — phases/ and modules/
├── dev-agent/        build agent — phases/
├── schemas/          spec.schema.json (JSON Schema draft 2020-12) + example
├── services/         Express wrappers around interviewer/ and dev-agent/ (interviewer, coder, docs)
├── web/               Next.js app + REST API — orchestrates the three services over HTTP
├── scripts/          CI schema validation
└── customers/         runtime data (git-ignored; lives on a Railway volume)
```

Each of the three agent services is deployed independently on Railway and talks to Postgres and disk state through a shared volume; the web app never touches customer data directly — it's a pure HTTP client to the other three services.

## Running locally

```bash
npm ci
npm run build:cli

# Web app (localhost:3000)
npm run dev:web

# Agent microservices (each in its own terminal)
npx tsx services/interviewer/server.ts   # :3001
npx tsx services/coder/server.ts         # :3002
npx tsx services/docs/server.ts          # :3003

# Or drive an interview + build directly via CLI
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev:interview acme-parts
npm run dev:dev-agent acme-parts
```

`web/` needs a `.env.local` with `DATABASE_URL`, `ANTHROPIC_API_KEY`, `BETTER_AUTH_SECRET`, and the three service URLs — see [CLAUDE.md](CLAUDE.md) for the full variable list and architectural detail.

## Status

Actively developed. Interview → spec → build pipeline is live and deployed across staging and production on Railway. See [CLAUDE.md](CLAUDE.md) for the full architecture writeup, database schema, and deployment pipeline.

## Copyright
Copyright © 2026 Kyle McLeod. All rights reserved.

This source code is publicly available for portfolio and evaluation purposes. No license is granted to copy, modify, distribute, sublicense, or commercially use this software.
