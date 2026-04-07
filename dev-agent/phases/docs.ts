/**
 * ERP Forge Dev Agent — Phase 7: Documentation
 *
 * Generates HANDOFF.md, CUSTOMER_SUMMARY.md, and writes final spec + manifest.
 * AI-assisted generation.
 */

import * as fs from "fs";
import type * as readline from "readline";
import type { GeneratorContext, PhaseGateResult, BuildManifest } from "../types.js";
import { generateDocs } from "../generators/docs/docs-generator.js";
import { completeBuild, saveManifest } from "../build-manifest.js";
import { saveSpec } from "../spec-manager.js";

/**
 * Runs Phase 7: Documentation + Final Outputs.
 * Generates docs, writes final spec.json and build-manifest.json.
 *
 * @param ctx - Generator context
 * @param manifest - Build manifest to finalize
 * @param appliedAmendments - Total amendments applied across all phases
 * @param _rl - Readline interface (unused — no spec flags in docs phase)
 * @returns Phase gate result
 */
export async function runDocsPhase(
  ctx: GeneratorContext,
  manifest: BuildManifest,
  appliedAmendments: number,
  _rl: readline.Interface
): Promise<PhaseGateResult> {
  console.log("\n  Phase 7: Documentation");
  console.log("  ─────────────────────────────────────────────");

  const docFiles = await generateDocs(ctx, manifest, appliedAmendments);

  // Copy final spec.json into the platform directory
  const finalSpecPath = `${ctx.platformDir}/spec.json`;
  fs.writeFileSync(finalSpecPath, JSON.stringify(ctx.spec, null, 2));
  console.log(`  ✓ Final spec written to platform/spec.json (v${ctx.spec.spec_version})`);

  // Finalize and save manifest
  completeBuild(manifest);
  saveManifest(manifest);
  console.log("  ✓ Build manifest finalized");

  const totalFiles = manifest.entries.flatMap((e) => e.generated_files).length;

  const result: PhaseGateResult = {
    phase: "docs",
    files_created: docFiles.length + 1, // +1 for spec.json
    spec_amendments: appliedAmendments,
    flags: [],
    summary: [
      `✓ docs/HANDOFF.md — developer handoff documentation`,
      `✓ docs/CUSTOMER_SUMMARY.md — plain-language customer summary`,
      `✓ platform/spec.json — final versioned spec (v${ctx.spec.spec_version})`,
      `✓ build-manifest.json — ${manifest.entries.length} spec IDs → ${totalFiles} file(s)`,
      `✓ ${appliedAmendments} total spec amendment(s) applied during build`,
    ].join("\n  "),
  };

  printFinalGate(result, ctx, manifest, totalFiles);
  return result;
}

function printFinalGate(
  result: PhaseGateResult,
  ctx: GeneratorContext,
  manifest: BuildManifest,
  totalFiles: number
): void {
  const LINE = "═".repeat(65);
  console.log(`\n${LINE}`);
  console.log(`  ✓ BUILD COMPLETE — ${ctx.spec.business_profile.company_name.toUpperCase()} ERP`);
  console.log(LINE);
  console.log(`  ${result.summary.replace(/\n/g, "\n  ")}`);
  console.log(`\n  Output directory: ${ctx.platformDir}`);
  console.log(`  Total files generated: ${totalFiles}`);
  console.log(`\n  NEXT STEPS:`);
  console.log(`  1. cd ${ctx.platformDir}`);
  console.log(`  2. npm install`);
  console.log(`  3. cp .env.example .env.local  # fill in your values`);
  console.log(`  4. npm run db:migrate`);
  console.log(`  5. npm run db:seed              # creates admin@example.com`);
  console.log(`  6. npm run dev`);
  console.log(`\n  See docs/HANDOFF.md for full deployment and Railway instructions.`);
  console.log(`${LINE}\n`);
}
