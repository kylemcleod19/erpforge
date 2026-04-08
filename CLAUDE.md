# ERP Forge — Claude Code Guide

## What ERP Forge Is

ERP Forge is a custom ERP generator for small manufacturers. It conducts a structured AI-powered interview with a customer, compiles the responses into a validated spec, then generates a complete production-ready Next.js ERP platform tailored to that customer's workflows.

Three components work in sequence:

```
Interviewer → spec.json → Dev Agent → customers/<slug>/platform/
                               ↕
                         Web API (Next.js)
```

1. **Interviewer** (`interviewer/`) — Multi-phase CLI agent that interviews a customer and compiles a `spec.json`
2. **Dev Agent** (`dev-agent/`) — Reads `spec.json` and generates a full Next.js ERP platform
3. **Web Server** (`web/`) — REST API wrapping both agents for browser/HTTP access

---

## Architecture Overview

```
customers/<slug>/
  session.json        ← interviewer state (phases, messages, flags)
  spec.json           ← compiled spec (output of interviewer)
  dev-session.json    ← dev-agent build state
  build-manifest.json ← file generation manifest
  platform/           ← generated Next.js ERP app
```

All three components communicate via files in `customers/<slug>/`. The database is an audit log — source of truth is on disk (Railway volume in production).

---

## Repo Structure

```
erpforge/
├── interviewer/          CLI interview agent (phases/, modules/)
├── dev-agent/            CLI build agent (phases/)
├── schemas/              spec.schema.json + spec.example.json
├── web/                  Next.js API server
│   ├── src/
│   │   ├── app/api/      Route handlers (interviews, builds, health)
│   │   ├── db/           Drizzle schema, migrations, singleton
│   │   ├── lib/          config, logger, api helpers, services
│   │   └── instrumentation.ts  DB migrations at startup
│   ├── drizzle/          Generated migration files (committed)
│   └── scripts/          migrate.ts CLI
├── scripts/              validate-schema.ts (CI)
├── customers/            Runtime data — git-ignored, Railway volume
├── Dockerfile            Multi-stage build
├── railway.toml          Start command, healthcheck config
└── package.json          Workspaces root (web/)
```

---

## Interviewer — How It Works

Entry: `interviewer/cli.ts` → `interviewer/agent.ts`

**7 phases in order:**

| Phase | What happens |
|-------|-------------|
| `intake` | Collects company info, industry, pain points, success metrics |
| `routing` | Claude selects which modules to run based on intake signals |
| `modules` | Runs selected modules: research gate → interview → extraction → review flag evaluation |
| `gap_analysis` | Claude identifies missing information, asks follow-up questions |
| `review` | Operator reviews flagged issues (accept / note / question / skip) |
| `compilation` | Claude maps session data to spec.json schema (with validation retries) |
| `complete` | spec.json written to `customers/<slug>/spec.json` |

**10 interview modules** (always-run: bom, customer-orders, inventory, purchasing, production; conditional: shipping, finance, quality, reporting, equipment)

**Two Claude models used:**
- `claude-sonnet-4-6` — interview turns, routing, gap analysis, compilation
- `claude-haiku-4-5-20251001` — fast extraction from module responses

**Session persistence:** `customers/<slug>/session.json` — safe to restart, resumes from current phase.

---

## Dev Agent — How It Works

Entry: `dev-agent/cli.ts` → `dev-agent/agent.ts`

**8 build phases in order:** plan → scaffold → database → api → frontend → integrations → ai-touchpoints → docs

Reads `customers/<slug>/spec.json`, generates `customers/<slug>/platform/` (complete Next.js app).

Tracks generated files in `customers/<slug>/build-manifest.json`.

---

## Spec Schema

**File:** `schemas/spec.schema.json` (JSON Schema draft 2020-12)

**Key top-level fields:**
- `schema_version` — version of the schema itself (bump when schema structure changes)
- `spec_version` — semantic version of this customer's spec (bump on content changes)
- `spec_id` — UUID, stable across all versions
- `business_profile`, `core_workflows`, `data_entities`, `feature_requirements`, `integration_points`, `ai_touchpoints`, `development_standards`, `history`

**ID formats:** `ent_*`, `wf_NNN`, `wf_NNN_sNN`, `feat_NNN`, `int_NNN`, `ai_NNN`

**Rendering envelopes** control audience-specific display:
```json
{ "_value": "actual_value", "_render": ["customer", "dev"], "_label": "Display Name" }
```

**Before changing `spec.schema.json`:**
1. Bump `schema_version` in the schema file
2. Update `spec.example.json` to match
3. Run `npm run validate-schema` — must pass
4. Update the interviewer compiler prompt if extraction fields changed
5. Update the dev-agent spec-manager if new required fields added

---

## Web API Routes

All routes return `{ data, error }` envelope via helpers in `web/src/lib/api.ts`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Railway healthcheck — returns `{ status, ts, db, version }` |
| POST | `/api/interviews` | Create interview session `{ slug }` |
| GET | `/api/interviews/:slug` | Get session state from disk |
| POST | `/api/interviews/:slug/messages` | Send message `{ message }`, get agent reply |
| POST | `/api/builds` | Start dev-agent build `{ slug }` |
| GET | `/api/builds/:slug` | Poll build status |

**Interview service** (`web/src/lib/interview-service.ts`): Runs InterviewAgent as a long-lived background Promise. HTTP turns sync with agent turns via two Promises (`agentWaiting`, `userInput`). Review phase auto-approves flags. State doesn't survive restarts — GET /interviews/:slug re-spawns the worker from session.json if needed.

**Build service** (`web/src/lib/build-service.ts`): Runs DevAgent in background. In-memory Map tracks status per slug. Falls back to dev-session.json on server restart.

---

## Database Schema

Tables are audit logs — source of truth is on-disk session files.

**`interview_sessions`** — one row per interview session (keyed by `slug`)
**`build_jobs`** — one row per build run (keyed by `slug`)

Migrations live in `web/drizzle/` (committed to git). Run automatically at startup via `web/src/instrumentation.ts`. To generate a new migration after schema changes: `npm run db:generate --workspace=web`.

---

## Development Standards

- **TypeScript strict mode** everywhere — no `any` without comment justification
- **Drizzle ORM** for all database access — no raw SQL
- **Zod** at API route boundaries for request validation
- **Pino** structured JSON logging — use `childLogger("module-name")` from `web/src/lib/logger.ts`
- **Environment variables** validated at startup via `web/src/lib/config.ts` — add new required vars there
- **`process.cwd()`** in the production container resolves to `/app/web` (Next.js standalone `server.js` runs `process.chdir(__dirname)`) — keep this in mind for any file path resolution
- Never hardcode customer slugs, file paths, or port numbers

---

## How to Run Locally

```bash
# Install all dependencies (root + web workspace)
npm ci

# Compile CLI tools
npm run build:cli

# Start web dev server (localhost:3000)
npm run dev:web

# Run an interview (requires ANTHROPIC_API_KEY)
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev:interview acme-parts

# Run dev-agent build after interview completes
npm run dev:dev-agent acme-parts

# Validate the spec schema
npm run validate-schema

# Run tests
npm test

# Web workspace commands (from web/ or via workspace)
npm run db:generate --workspace=web   # generate migration from schema changes
npm run db:migrate --workspace=web    # apply pending migrations
npm run db:studio --workspace=web     # Drizzle Studio UI
npm run typecheck --workspace=web
```

Local web dev requires `web/.env.local`:
```
DATABASE_URL=postgres://localhost:5432/erpforge
ANTHROPIC_API_KEY=sk-ant-...
BETTER_AUTH_SECRET=any-string-for-local
```

---

## Deployment Pipeline

```
dev branch  →  GitHub Actions  →  Railway staging   (erpforge-staging.kyle-mcleod.io)
main branch →  GitHub Actions  →  Railway production (production URL)
```

**GitHub Actions workflows:**
- `ci.yml` — typecheck + validate-schema + test (runs on all PRs and pushes)
- `deploy-staging.yml` — CI + `railway up` to staging (triggers on push to `dev`)
- `deploy-production.yml` — CI + `railway up` to production + healthcheck polling (triggers on push to `main`)
- `spec-notify.yml` — creates GitHub issue when `spec.schema.json` changes on `main`

**Required GitHub secrets:** `RAILWAY_TOKEN`, `RAILWAY_STAGING_SERVICE_ID`, `RAILWAY_PRODUCTION_SERVICE_ID`
**Required GitHub variables:** `STAGING_URL`, `PRODUCTION_URL`
**Optional secret:** `SLACK_WEBHOOK_URL` (production failure alerts)

**Railway service config:**
- PORT must be set to `8080` in Railway environment variables
- `DATABASE_URL` auto-injected by Railway Postgres plugin
- `ANTHROPIC_API_KEY`, `BETTER_AUTH_SECRET`, `CUSTOMERS_DIR` set manually
- Migrations run automatically at startup (via `instrumentation.ts`)
- Health check: `GET /api/health` must return 200 within 60s

**Dockerfile (multi-stage):**
1. Builder: `npm ci` + `next build` → produces `web/.next/standalone/`
2. Runner: copies standalone to `/app/`, static assets to `/app/web/.next/static/`, drizzle migrations to `/app/web/drizzle/`
3. Start: `node web/server.js` (server.js chdir's to `/app/web`, so all paths resolve from there)

---

## Autonomous vs. Human Review

Claude can do without asking:
- Edit any file in `interviewer/`, `dev-agent/`, `schemas/`, `web/src/`
- Add or modify API routes, services, lib utilities
- Update Drizzle schema + generate migrations
- Update `web/src/lib/config.ts` for new env vars
- Write and run tests
- Push to feature branches
- Update `CLAUDE.md`

Always ask before:
- Changing `schemas/spec.schema.json` structure (impacts compiler, spec-manager, all customer specs)
- Modifying `railway.toml` or `Dockerfile`
- Renaming API routes (breaking change for any clients)
- Pushing to `dev` or `main`
- Changing `customers/` directory structure or slug validation
- Modifying GitHub Actions workflows
