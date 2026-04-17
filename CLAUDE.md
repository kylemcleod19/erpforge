# ERP Forge — Claude Code Guide

## What ERP Forge Is

ERP Forge is a custom ERP generator for small manufacturers. It conducts a structured AI-powered interview with a customer, compiles the responses into a validated spec, then generates a complete production-ready Next.js ERP platform tailored to that customer's workflows.

Four services work together:

```
Interviewer Service ──┐
                      ├── shared Railway volume ── customers/<slug>/
Coder Service ────────┤
                      │
Docs Service ─────────┘
      ↕ HTTP
Web Service (Next.js) ← thin orchestrator, delegates via HTTP
```

1. **Interviewer** (`interviewer/`) — Multi-phase interview logic; served as HTTP microservice (`services/interviewer/`)
2. **Dev Agent** (`dev-agent/`) — Reads `spec.json` and generates a full Next.js ERP platform; served as HTTP microservice (`services/coder/`)
3. **Docs** — On-demand documentation generation from spec + manifest; served as HTTP microservice (`services/docs/`)
4. **Web Server** (`web/`) — Next.js app + REST API, thin HTTP client that delegates to the three microservices

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

All four services share a Railway volume mounted at `customers/`. The database is an audit log — source of truth is on disk.

**Service ports (local defaults):**
- Web: 3000
- Interviewer service: 3001
- Coder service: 3002
- Docs service: 3003

---

## Repo Structure

```
erpforge/
├── interviewer/          CLI interview agent (phases/, modules/)
├── dev-agent/            CLI build agent (phases/)
├── schemas/              spec.schema.json + spec.example.json
├── services/
│   ├── interviewer/      Express microservice wrapping interviewer/
│   │   ├── server.ts
│   │   ├── package.json  (@erpforge/interviewer-service)
│   │   ├── tsconfig.json (rootDir: ../../, outDir: dist)
│   │   └── Dockerfile
│   ├── coder/            Express microservice wrapping dev-agent/
│   │   ├── server.ts
│   │   ├── package.json  (@erpforge/coder-service)
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   └── docs/             Express microservice for doc generation
│       ├── server.ts
│       ├── package.json  (@erpforge/docs-service)
│       ├── tsconfig.json
│       └── Dockerfile
├── web/                  Next.js API server (thin HTTP orchestrator)
│   ├── src/
│   │   ├── app/api/      Route handlers (interviews, builds, health)
│   │   ├── db/           Drizzle schema, migrations, singleton
│   │   ├── lib/          config, logger, api helpers, HTTP service clients
│   │   └── instrumentation.ts  DB migrations at startup
│   ├── drizzle/          Generated migration files (committed)
│   └── scripts/          migrate.ts CLI
├── scripts/              validate-schema.ts (CI)
├── customers/            Runtime data — git-ignored, Railway volume
├── railway.toml          Healthcheck config (no startCommand — set per-service in Railway UI)
└── package.json          Workspaces root (web/, services/*)
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

## Microservices — How They Work

Each service is a standalone Express server that wraps the corresponding agent logic. They are deployed as separate Railway services sharing a volume.

**Interviewer service** (`services/interviewer/server.ts`):
- Preserves the deferred-Promise bridge pattern from the original `interview-service.ts`
- `agentWaiting` deferred resolves when agent produces a reply; `userInput` deferred resolves when HTTP client sends a message
- Auto-approves review flags via mock readline
- Routes: `POST /sessions`, `GET /sessions/:slug`, `POST /sessions/:slug/messages`, `DELETE /sessions/:slug`, `GET /health`

**Coder service** (`services/coder/server.ts`):
- Preserves mock readline pattern from original `build-service.ts`
- `makeAutoBuildRl` matches phase-complete prompts and auto-continues
- Routes: `POST /builds`, `GET /builds/:slug`, `POST /builds/:slug/continue`, `DELETE /builds/:slug`, `GET /health`

**Docs service** (`services/docs/server.ts`):
- Calls `generateDocs()` from `dev-agent/generators/docs/docs-generator`
- Routes: `POST /docs`, `GET /docs/:slug`, `GET /docs/:slug/spec-summary`, `GET /docs/:slug/openapi`, `GET /health`

**TypeScript compilation:** Each service tsconfig uses `rootDir: "../../"` so the compiled output mirrors the source tree. Start commands reference the full path, e.g. `node services/interviewer/dist/services/interviewer/server.js`.

**Health routes:** All three services respond on both `/health` and `/api/health` (the root `railway.toml` configures `healthcheckPath = "/api/health"`).

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
| GET | `/api/interviews/:slug` | Get session state (delegates to interviewer service) |
| POST | `/api/interviews/:slug/messages` | Send message `{ message }`, get agent reply |
| POST | `/api/builds` | Start dev-agent build `{ slug }` |
| GET | `/api/builds/:slug` | Poll build status |

**Interview service client** (`web/src/lib/interview-service.ts`): Thin HTTP client calling `INTERVIEWER_SERVICE_URL`. `getSessionState()` is async. All session state lives in the interviewer microservice.

**Build service client** (`web/src/lib/build-service.ts`): Thin HTTP client calling `CODER_SERVICE_URL`. `getBuildStatus()` is async.

**Docs service client** (`web/src/lib/docs-service.ts`): Thin HTTP client calling `DOCS_SERVICE_URL`.

**Service URLs** configured in `web/src/lib/config.ts`:
- `interviewerServiceUrl` — default `http://localhost:3001`
- `coderServiceUrl` — default `http://localhost:3002`
- `docsServiceUrl` — default `http://localhost:3003`

In production, set these to Railway private networking URLs: `http://<service>.railway.internal:<port>`.

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
# Install all dependencies (root + all workspaces)
npm ci

# Compile CLI tools
npm run build:cli

# Start web dev server (localhost:3000)
npm run dev:web

# Run microservices locally (each in a separate terminal)
npx tsx services/interviewer/server.ts   # port 3001
npx tsx services/coder/server.ts         # port 3002
npx tsx services/docs/server.ts          # port 3003

# Run an interview directly via CLI (requires ANTHROPIC_API_KEY)
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev:interview acme-parts

# Run dev-agent build after interview completes
npm run dev:dev-agent acme-parts

# Validate the spec schema
npm run validate-schema

# Run tests
npm test

# Typecheck all workspaces
npx tsc --noEmit
npm run typecheck --workspace=web
npm run typecheck --workspace=@erpforge/interviewer-service
npm run typecheck --workspace=@erpforge/coder-service
npm run typecheck --workspace=@erpforge/docs-service

# Web workspace commands
npm run db:generate --workspace=web   # generate migration from schema changes
npm run db:migrate --workspace=web    # apply pending migrations
npm run db:studio --workspace=web     # Drizzle Studio UI
```

Local web dev requires `web/.env.local`:
```
DATABASE_URL=postgres://localhost:5432/erpforge
ANTHROPIC_API_KEY=sk-ant-...
BETTER_AUTH_SECRET=any-string-for-local
INTERVIEWER_SERVICE_URL=http://localhost:3001
CODER_SERVICE_URL=http://localhost:3002
DOCS_SERVICE_URL=http://localhost:3003
```

---

## Deployment Pipeline

```
dev branch  →  GitHub Actions  →  Railway staging   (erpforge-staging.kyle-mcleod.io)
main branch →  GitHub Actions  →  Railway production (production URL)
```

**GitHub Actions workflows:**
- `ci.yml` — typecheck (all 4 workspaces) + validate-schema + test (runs on all PRs and pushes)
- `deploy-staging.yml` — CI + `railway up` for all 4 services to staging (triggers on push to `dev`)
- `deploy-production.yml` — CI + `railway up` for all 4 services + healthcheck polling (triggers on push to `main`)
- `spec-notify.yml` — creates GitHub issue when `spec.schema.json` changes on `main`

**Required GitHub secrets:**
```
RAILWAY_TOKEN
RAILWAY_STAGING_SERVICE_ID                  (web)
RAILWAY_STAGING_INTERVIEWER_SERVICE_ID
RAILWAY_STAGING_CODER_SERVICE_ID
RAILWAY_STAGING_DOCS_SERVICE_ID
RAILWAY_PRODUCTION_SERVICE_ID               (web)
RAILWAY_PRODUCTION_INTERVIEWER_SERVICE_ID
RAILWAY_PRODUCTION_CODER_SERVICE_ID
RAILWAY_PRODUCTION_DOCS_SERVICE_ID
```
**Required GitHub variables:** `STAGING_URL`, `PRODUCTION_URL`
**Optional secret:** `SLACK_WEBHOOK_URL` (production failure alerts)

**Railway service configuration:**

| Service | Start command | Port |
|---------|--------------|------|
| web | `node web/server.js` | 8080 |
| interviewer | `node services/interviewer/dist/services/interviewer/server.js` | 8080 |
| coder | `node services/coder/dist/services/coder/server.js` | 8080 |
| docs | `node services/docs/dist/services/docs/server.js` | 8080 |

- `PORT=8080` must be set in Railway environment variables for each service
- `DATABASE_URL` auto-injected by Railway Postgres plugin (web service only)
- `ANTHROPIC_API_KEY` set on all 4 services; `BETTER_AUTH_SECRET` on web only
- `CUSTOMERS_DIR=/apps/customers` set on the 3 microservices (interviewer, coder, docs) — **not** the web service
- `INTERVIEWER_SERVICE_URL`, `CODER_SERVICE_URL`, `DOCS_SERVICE_URL` set on the web service (use Railway private networking URLs)
- The shared Railway volume is mounted at `/apps/customers` on the 3 microservices only — the web service needs no volume (it no longer reads/writes `customers/` directly)
- Health check: `GET /api/health` must return 200 within 60s (all services respond on both `/health` and `/api/health`)
- Start commands are set in the Railway UI per service — **not** in `railway.toml` (the root `railway.toml` would otherwise apply to all services)

**Dockerfiles (multi-stage, one per service):**
- Builder stage: installs all deps, copies shared packages (`interviewer/`, `dev-agent/`, `schemas/`), compiles TypeScript
- Runner stage: `npm ci --omit=dev`, copies compiled `dist/`
- Web Dockerfile additionally runs `next build` and uses Next.js standalone output

---

## Autonomous vs. Human Review

Claude can do without asking:
- Edit any file in `interviewer/`, `dev-agent/`, `schemas/`, `web/src/`, `services/*/server.ts`
- Add or modify API routes, services, lib utilities
- Update Drizzle schema + generate migrations
- Update `web/src/lib/config.ts` for new env vars
- Write and run tests
- Push to feature branches
- Update `CLAUDE.md`

Always ask before:
- Changing `schemas/spec.schema.json` structure (impacts compiler, spec-manager, all customer specs)
- Modifying `railway.toml` or any `Dockerfile`
- Renaming API routes (breaking change for any clients)
- Pushing to `dev` or `main`
- Changing `customers/` directory structure or slug validation
- Modifying GitHub Actions workflows
- Changing service-to-service URL configuration (affects Railway private networking)
