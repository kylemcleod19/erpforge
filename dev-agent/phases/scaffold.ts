/**
 * ERP Forge Dev Agent — Phase 1: Scaffold
 *
 * Generates the Next.js project structure, Railway config, auth setup, and lib/api utilities.
 * Rule-based — no AI calls. Fast and deterministic.
 */

import type * as readline from "readline";
import type { GeneratorContext, PhaseGateResult, BuildManifest } from "../types.js";
import { generateNextjsScaffold } from "../generators/scaffold/nextjs-scaffold.js";
import { generateRailwayConfig } from "../generators/scaffold/railway-config.js";
import { generateBetterAuth } from "../generators/auth/better-auth-generator.js";
import { installShadcnUi } from "../generators/ui/shadcn-installer.js";
import { addEntry, saveManifest } from "../build-manifest.js";

/**
 * Runs Phase 1: Scaffold.
 * Generates project structure, Railway config, better-auth, and shadcn/ui setup.
 *
 * @param ctx - Generator context
 * @param manifest - Build manifest to update
 * @param rl - Readline interface (unused in scaffold but consistent signature)
 * @returns Phase gate result for operator review
 */
export async function runScaffoldPhase(
  ctx: GeneratorContext,
  manifest: BuildManifest,
  _rl: readline.Interface
): Promise<PhaseGateResult> {
  console.log("\n  Phase 1: Scaffold");
  console.log("  ─────────────────────────────────────────────");

  const allFiles = [
    ...generateNextjsScaffold(ctx),
    ...generateRailwayConfig(ctx),
    ...generateBetterAuth(ctx),
    ...installShadcnUi(ctx),
  ];

  // Update manifest
  for (const file of allFiles) {
    for (const specId of file.specIds) {
      addEntry(manifest, {
        spec_id: specId,
        spec_section: "development_standards",
        generated_files: [file.relativePath],
        generator: file.generator,
      });
    }
  }
  saveManifest(manifest);

  const result: PhaseGateResult = {
    phase: "scaffold",
    files_created: allFiles.length,
    spec_amendments: 0,
    flags: [],
    summary: [
      `✓ ${allFiles.length} files created`,
      `✓ Next.js 15 App Router scaffold`,
      `✓ Railway config (railway.toml + .env.example)`,
      `✓ better-auth with ${ctx.spec.development_standards.roles.length} role(s): ${ctx.spec.development_standards.roles.map((r) => r.role_id).join(", ")}`,
      `✓ shadcn/ui configured`,
      `✓ lib/api utilities (withAuth, ok/apiError, cursor pagination, error classes)`,
    ].join("\n  "),
  };

  printPhaseGate(result);
  return result;
}

function printPhaseGate(result: PhaseGateResult): void {
  console.log(`\n  Phase 1 Complete — Scaffold`);
  console.log(`  ${result.summary}`);
}
