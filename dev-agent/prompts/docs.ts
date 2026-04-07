/**
 * ERP Forge Dev Agent — Documentation Prompts
 *
 * Prompts for generating HANDOFF.md and CUSTOMER_SUMMARY.md.
 */

import type { ErpSpec } from "../types.js";
import type { BuildManifest } from "../types.js";

/**
 * Builds the prompt for the developer handoff document.
 */
export function buildHandoffPrompt(
  spec: ErpSpec,
  manifest: BuildManifest,
  appliedAmendments: number
): string {
  const integrations = spec.integration_points.map((i) => i.name).join(", ");
  const aiTouchpoints = spec.ai_touchpoints.map((t) => t.name).join(", ");
  const entities = spec.data_entities.map((e) => e.entity_id).join(", ");

  return `Generate docs/HANDOFF.md for the ${spec.business_profile.company_name} ERP platform.

This is a developer handoff document explaining the generated codebase.

SPEC: v${spec.spec_version} (${appliedAmendments} amendments applied during build)
BUILD: ${manifest.entries.length} spec nodes → ${new Set(manifest.entries.flatMap((e) => e.generated_files)).size} files

INCLUDE THESE SECTIONS:

## Architecture
- Tech stack: Next.js 15 App Router, Drizzle ORM, PostgreSQL (Railway), better-auth, shadcn/ui
- Why Next.js App Router: Server Components query Drizzle directly for data-heavy ERP pages; Route Handlers at /api/v1/ provide the REST API
- Database: ${entities}
- Integrations: ${integrations || "none"}
- AI touchpoints: ${aiTouchpoints || "none"}

## Environment Variables
List every env var from .env.example with a description of where to get each value.
Include: DATABASE_URL, AUTH_SECRET, ANTHROPIC_API_KEY${spec.integration_points.length ? ", " + spec.integration_points.map((i) => Object.keys(i.auth_config ?? {}).map((k) => k.toUpperCase()).join(", ")).filter(Boolean).join(", ") : ""}

## Run Locally
1. Prerequisites (Node 22, pnpm/npm, Postgres or Railway CLI)
2. npm install
3. Copy .env.example to .env.local
4. npm run db:migrate
5. npm run db:seed (creates admin@example.com / changeme)
6. npm run dev

## Deploy to Railway
1. Connect repo to Railway
2. Add Postgres plugin
3. Set env vars
4. Deploy (startCommand: node scripts/migrate && next start)

## Add a New Entity
Step-by-step guide: add Drizzle schema file, add to schema/index.ts, run drizzle-kit generate, create service, create route handlers, add page.

## Add a New Integration
Step-by-step guide: create lib/integrations/<slug>/, implement client.ts + oauth.ts + sync.ts, add oauth_tokens row, add Route Handler, call sync from service.

## Add an AI Touchpoint
Step-by-step guide: add touchpoint to spec, create lib/ai/<slug>.ts, add POST /api/v1/ai/<slug>/route.ts.

## Spec Version History
${spec.history.map((h) => `- v${h.version} (${h.changed_at.slice(0, 10)}): ${h.change_type} — ${h.rationale}`).join("\n")}

Output Markdown only. Be concise and precise.`;
}

/**
 * Builds the prompt for the customer summary document.
 */
export function buildCustomerSummaryPrompt(spec: ErpSpec): string {
  const painPoints = spec.business_profile.pain_points
    .map((p) => `- ${p.description} (${p.severity})`)
    .join("\n");

  const features = spec.feature_requirements
    .filter((f) => f.priority === "P1")
    .map((f) => `- ${f.name}: ${f.description}`)
    .join("\n");

  const integrations = spec.integration_points
    .map(
      (i) =>
        `- ${i.name}: ${i.endpoints.map((e) => e.description).join("; ")}`
    )
    .join("\n");

  const aiTouchpoints = spec.ai_touchpoints
    .map((t) => `- ${t.name}: ${t.description}`)
    .join("\n");

  return `Generate docs/CUSTOMER_SUMMARY.md for ${spec.business_profile.company_name}.

This document is written for a non-technical business owner. Plain language. No jargon.

PAIN POINTS ADDRESSED:
${painPoints}

FEATURES BUILT:
${features}

INTEGRATIONS:
${integrations || "None"}

AI FEATURES:
${aiTouchpoints || "None"}

INCLUDE THESE SECTIONS:

## What We Built For You
Plain English summary of the ERP system and its main capabilities.

## How It Solves Your Pain Points
For each pain point, explain specifically how the ERP addresses it.

## Your Integrations
For each integration: what it connects to, what it does automatically, what you need to set up.

## Where AI Helps You
For each AI touchpoint: what it does, when it runs, what you need to review.

## Getting Started
Simple steps for the business owner's team to start using the system.

Output Markdown only. Write as if explaining to a smart business owner who is not a software developer.`;
}
