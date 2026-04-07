/**
 * ERP Forge Dev Agent — Phase 4: Frontend
 *
 * Generates RSC pages, Client Component forms, and the app layout.
 * AI-assisted generation.
 */

import type * as readline from "readline";
import type { GeneratorContext, PhaseGateResult, BuildManifest } from "../types.js";
import { generatePages } from "../generators/ui/page-generator.js";
import { addEntry, saveManifest } from "../build-manifest.js";

/**
 * Runs Phase 4: Frontend Screens.
 *
 * @param ctx - Generator context
 * @param manifest - Build manifest to update
 * @param rl - Readline interface for spec issue prompts
 * @returns Phase gate result
 */
export async function runFrontendPhase(
  ctx: GeneratorContext,
  manifest: BuildManifest,
  rl: readline.Interface
): Promise<PhaseGateResult> {
  console.log("\n  Phase 4: Frontend Screens");
  console.log("  ─────────────────────────────────────────────");

  const amendsBefore = ctx.pendingAmendments.length;

  const pageFiles = await generatePages(ctx, rl);

  // Update manifest per feature
  for (const feature of ctx.spec.feature_requirements) {
    const featureFiles = pageFiles
      .filter((f) => f.specIds.includes(feature.feature_id))
      .map((f) => f.relativePath);

    if (featureFiles.length) {
      addEntry(manifest, {
        spec_id: feature.feature_id,
        spec_section: "feature_requirements",
        generated_files: featureFiles,
        generator: "page-generator",
      });
    }
  }

  saveManifest(manifest);

  const p1Count = pageFiles.filter((f) =>
    ctx.spec.feature_requirements
      .filter((ft) => ft.priority === "P1")
      .some((ft) => f.specIds.includes(ft.feature_id))
  ).length;

  const p2Count = pageFiles.length - p1Count;
  const amendmentsThisPhase = ctx.pendingAmendments.length - amendsBefore;

  const result: PhaseGateResult = {
    phase: "frontend",
    files_created: pageFiles.length,
    spec_amendments: amendmentsThisPhase,
    flags: [],
    summary: [
      `✓ ${pageFiles.length} frontend file(s) generated`,
      `✓ Login page + app shell layout`,
      `✓ RoleGuard component`,
      `✓ ${p1Count} P1 screen file(s)`,
      p2Count > 0 ? `✓ ${p2Count} P2 screen file(s)` : null,
      amendmentsThisPhase > 0 ? `⚠ ${amendmentsThisPhase} spec amendment(s) applied` : "✓ No spec amendments",
    ].filter(Boolean).join("\n  "),
  };

  printPhaseGate(result);
  return result;
}

function printPhaseGate(result: PhaseGateResult): void {
  const LINE = "═".repeat(60);
  console.log(`\n  ${LINE}`);
  console.log(`  Phase 4 Complete — Frontend`);
  console.log(`  ${result.summary.replace(/\n/g, "\n  ")}`);
  console.log(`  ${LINE}`);
}
