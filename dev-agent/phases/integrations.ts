/**
 * ERP Forge Dev Agent — Phase 5: Integrations
 *
 * Generates OAuth clients, sync handlers, and webhook handlers.
 * AI-assisted generation.
 */

import type * as readline from "readline";
import type { GeneratorContext, PhaseGateResult, BuildManifest } from "../types.js";
import { generateIntegrations } from "../generators/integrations/integration-generator.js";
import { addEntry, saveManifest } from "../build-manifest.js";

/**
 * Runs Phase 5: Integrations.
 *
 * @param ctx - Generator context
 * @param manifest - Build manifest to update
 * @param rl - Readline interface for spec issue prompts
 * @returns Phase gate result
 */
export async function runIntegrationsPhase(
  ctx: GeneratorContext,
  manifest: BuildManifest,
  rl: readline.Interface
): Promise<PhaseGateResult> {
  console.log("\n  Phase 5: Integrations");
  console.log("  ─────────────────────────────────────────────");

  if (ctx.spec.integration_points.length === 0) {
    console.log("  No integration_points defined in spec — skipping.");
    return {
      phase: "integrations",
      files_created: 0,
      spec_amendments: 0,
      flags: [],
      summary: "✓ No integrations defined in spec",
    };
  }

  const amendsBefore = ctx.pendingAmendments.length;
  const intFiles = await generateIntegrations(ctx, rl);

  for (const integration of ctx.spec.integration_points) {
    const files = intFiles
      .filter((f) => f.specIds.includes(integration.integration_id))
      .map((f) => f.relativePath);

    if (files.length) {
      addEntry(manifest, {
        spec_id: integration.integration_id,
        spec_section: "integration_points",
        generated_files: files,
        generator: "integration-generator",
      });
    }
  }

  saveManifest(manifest);

  const amendmentsThisPhase = ctx.pendingAmendments.length - amendsBefore;

  const result: PhaseGateResult = {
    phase: "integrations",
    files_created: intFiles.length,
    spec_amendments: amendmentsThisPhase,
    flags: [],
    summary: [
      `✓ ${ctx.spec.integration_points.length} integration(s) generated`,
      ...ctx.spec.integration_points.map((i) => `  • ${i.name} (${i.auth_method}, ${i.endpoints.length} endpoint(s))`),
      amendmentsThisPhase > 0 ? `⚠ ${amendmentsThisPhase} spec amendment(s) applied` : "✓ No spec amendments",
    ].join("\n  "),
  };

  printPhaseGate(result);
  return result;
}

function printPhaseGate(result: PhaseGateResult): void {
  const LINE = "═".repeat(60);
  console.log(`\n  ${LINE}`);
  console.log(`  Phase 5 Complete — Integrations`);
  console.log(`  ${result.summary.replace(/\n/g, "\n  ")}`);
  console.log(`  ${LINE}`);
}
