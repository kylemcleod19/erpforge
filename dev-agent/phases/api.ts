/**
 * ERP Forge Dev Agent — Phase 3: Backend API
 *
 * Generates Route Handlers, service layer, action routes, and webhook handlers.
 * AI-assisted generation.
 */

import type * as readline from "readline";
import type { GeneratorContext, PhaseGateResult, BuildManifest } from "../types.js";
import { generateRouteHandlers } from "../generators/api/route-handler-generator.js";
import { generateActionRoutes } from "../generators/api/action-route-generator.js";
import { generateWebhookHandlers } from "../generators/api/webhook-handler-generator.js";
import { generateServices } from "../generators/services/service-generator.js";
import { addEntry, saveManifest } from "../build-manifest.js";
import { generateOpenApiSpec } from "./api-openapi.js";

/**
 * Runs Phase 3: Backend API.
 * Generates CRUD routes, action routes, service layer, webhooks, and OpenAPI spec.
 *
 * @param ctx - Generator context
 * @param manifest - Build manifest to update
 * @param rl - Readline interface for spec issue prompts
 * @returns Phase gate result
 */
export async function runApiPhase(
  ctx: GeneratorContext,
  manifest: BuildManifest,
  rl: readline.Interface
): Promise<PhaseGateResult> {
  console.log("\n  Phase 3: Backend API");
  console.log("  ─────────────────────────────────────────────");

  const amendsBefore = ctx.pendingAmendments.length;

  // Service layer first (route handlers depend on service method signatures)
  const serviceFiles = await generateServices(ctx, rl);

  // CRUD Route Handlers
  const routeFiles = await generateRouteHandlers(ctx, rl);

  // Workflow action routes
  const actionFiles = await generateActionRoutes(ctx, rl);

  // Inbound webhook handlers
  const webhookFiles = await generateWebhookHandlers(ctx, rl);

  // OpenAPI spec (rule-based — generates stub from route file list)
  const openApiFile = generateOpenApiSpec(ctx, [...routeFiles, ...actionFiles]);

  const allFiles = [...serviceFiles, ...routeFiles, ...actionFiles, ...webhookFiles, openApiFile].filter(Boolean);

  // Update manifest
  for (const entity of ctx.spec.data_entities) {
    const entityFiles = [...serviceFiles, ...routeFiles]
      .filter((f) => f.specIds.includes(entity.entity_id))
      .map((f) => f.relativePath);

    if (entityFiles.length) {
      addEntry(manifest, {
        spec_id: entity.entity_id,
        spec_section: "data_entities",
        generated_files: entityFiles,
        generator: "api",
      });
    }
  }

  for (const wf of ctx.spec.core_workflows) {
    const wfFiles = actionFiles
      .filter((f) => f.specIds.includes(wf.workflow_id))
      .map((f) => f.relativePath);
    if (wfFiles.length) {
      addEntry(manifest, {
        spec_id: wf.workflow_id,
        spec_section: "core_workflows",
        generated_files: wfFiles,
        generator: "api",
      });
    }
  }

  saveManifest(manifest);

  const amendmentsThisPhase = ctx.pendingAmendments.length - amendsBefore;

  const result: PhaseGateResult = {
    phase: "api",
    files_created: allFiles.length,
    spec_amendments: amendmentsThisPhase,
    flags: [],
    summary: [
      `✓ ${serviceFiles.length} service file(s)`,
      `✓ ${routeFiles.length} Route Handler file(s) (CRUD)`,
      `✓ ${actionFiles.length} action route(s) from workflows`,
      `✓ ${webhookFiles.length} webhook handler(s)`,
      `✓ openapi.yaml generated`,
      amendmentsThisPhase > 0 ? `⚠ ${amendmentsThisPhase} spec amendment(s) applied` : "✓ No spec amendments",
    ].join("\n  "),
  };

  printPhaseGate(result);
  return result;
}

function printPhaseGate(result: PhaseGateResult): void {
  const LINE = "═".repeat(60);
  console.log(`\n  ${LINE}`);
  console.log(`  Phase 3 Complete — Backend API`);
  console.log(`  ${result.summary.replace(/\n/g, "\n  ")}`);
  if (result.spec_amendments > 0) {
    console.log(`\n  Spec amendments this phase: ${result.spec_amendments}`);
  }
  console.log(`  ${LINE}`);
}
