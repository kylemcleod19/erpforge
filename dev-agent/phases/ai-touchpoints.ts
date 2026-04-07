/**
 * ERP Forge Dev Agent — Phase 6: AI Touchpoints
 *
 * Generates Anthropic SDK touchpoint handlers and their API routes.
 * Also generates background jobs for background_job feature types.
 * AI-assisted generation.
 */

import type * as readline from "readline";
import type { GeneratorContext, PhaseGateResult, BuildManifest } from "../types.js";
import { generateAiTouchpoints } from "../generators/ai/touchpoint-generator.js";
import { generateJobs } from "../generators/jobs/job-generator.js";
import { addEntry, saveManifest } from "../build-manifest.js";

/**
 * Runs Phase 6: AI Touchpoints + Background Jobs.
 *
 * @param ctx - Generator context
 * @param manifest - Build manifest to update
 * @param rl - Readline interface for spec issue prompts
 * @returns Phase gate result
 */
export async function runAiTouchpointsPhase(
  ctx: GeneratorContext,
  manifest: BuildManifest,
  rl: readline.Interface
): Promise<PhaseGateResult> {
  console.log("\n  Phase 6: AI Touchpoints + Background Jobs");
  console.log("  ─────────────────────────────────────────────");

  const amendsBefore = ctx.pendingAmendments.length;

  // AI touchpoint handlers
  const aiFiles = ctx.spec.ai_touchpoints.length > 0
    ? await generateAiTouchpoints(ctx, rl)
    : [];

  // Background jobs
  const bgJobFeatures = ctx.spec.feature_requirements.filter((f) => f.type === "background_job");
  const jobFiles = bgJobFeatures.length > 0
    ? await generateJobs(ctx, rl)
    : [];

  // Update manifest
  for (const tp of ctx.spec.ai_touchpoints) {
    const files = aiFiles
      .filter((f) => f.specIds.includes(tp.touchpoint_id))
      .map((f) => f.relativePath);
    if (files.length) {
      addEntry(manifest, {
        spec_id: tp.touchpoint_id,
        spec_section: "ai_touchpoints",
        generated_files: files,
        generator: "touchpoint-generator",
      });
    }
  }

  for (const feat of bgJobFeatures) {
    const files = jobFiles
      .filter((f) => f.specIds.includes(feat.feature_id))
      .map((f) => f.relativePath);
    if (files.length) {
      addEntry(manifest, {
        spec_id: feat.feature_id,
        spec_section: "feature_requirements",
        generated_files: files,
        generator: "job-generator",
      });
    }
  }

  saveManifest(manifest);

  const amendmentsThisPhase = ctx.pendingAmendments.length - amendsBefore;
  const allFiles = [...aiFiles, ...jobFiles];

  const result: PhaseGateResult = {
    phase: "ai_touchpoints",
    files_created: allFiles.length,
    spec_amendments: amendmentsThisPhase,
    flags: [],
    summary: [
      ctx.spec.ai_touchpoints.length > 0
        ? `✓ ${ctx.spec.ai_touchpoints.length} AI touchpoint(s): ${ctx.spec.ai_touchpoints.map((t) => t.touchpoint_id).join(", ")}`
        : "✓ No AI touchpoints defined",
      bgJobFeatures.length > 0
        ? `✓ ${bgJobFeatures.length} background job(s): ${bgJobFeatures.map((f) => f.feature_id).join(", ")}`
        : "✓ No background jobs defined",
      amendmentsThisPhase > 0 ? `⚠ ${amendmentsThisPhase} spec amendment(s) applied` : "✓ No spec amendments",
    ].join("\n  "),
  };

  printPhaseGate(result);
  return result;
}

function printPhaseGate(result: PhaseGateResult): void {
  const LINE = "═".repeat(60);
  console.log(`\n  ${LINE}`);
  console.log(`  Phase 6 Complete — AI Touchpoints + Jobs`);
  console.log(`  ${result.summary.replace(/\n/g, "\n  ")}`);
  console.log(`  ${LINE}`);
}
