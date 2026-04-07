/**
 * ERP Forge Dev Agent — Phase 2: Database
 *
 * Generates Drizzle schema files and runs drizzle-kit to produce migrations.
 * Rule-based — deterministic spec → code transformation.
 */

import type * as readline from "readline";
import type { GeneratorContext, PhaseGateResult, BuildManifest } from "../types.js";
import { generateDrizzleSchema } from "../generators/db/schema-generator.js";
import { generateMigrations } from "../generators/db/migration-generator.js";
import { addEntry, saveManifest } from "../build-manifest.js";

/**
 * Runs Phase 2: Database Schema.
 * Generates Drizzle tables from spec data_entities and produces migration SQL.
 *
 * @param ctx - Generator context
 * @param manifest - Build manifest to update
 * @param rl - Readline interface (unused — rule-based phase)
 * @returns Phase gate result
 */
export async function runDatabasePhase(
  ctx: GeneratorContext,
  manifest: BuildManifest,
  _rl: readline.Interface
): Promise<PhaseGateResult> {
  console.log("\n  Phase 2: Database Schema");
  console.log("  ─────────────────────────────────────────────");

  // Generate Drizzle schema files
  const schemaFiles = generateDrizzleSchema(ctx);

  // Run drizzle-kit to produce SQL migrations
  const migrationFiles = generateMigrations(ctx);

  const allFiles = [...schemaFiles, ...migrationFiles];

  // Update manifest per entity
  for (const entity of ctx.spec.data_entities) {
    const entityFiles = schemaFiles
      .filter((f) => f.specIds.includes(entity.entity_id))
      .map((f) => f.relativePath);

    if (entityFiles.length) {
      addEntry(manifest, {
        spec_id: entity.entity_id,
        spec_section: "data_entities",
        generated_files: entityFiles,
        generator: "schema-generator",
      });
    }
  }

  // Log migration files
  if (migrationFiles.length > 0) {
    addEntry(manifest, {
      spec_id: "migrations",
      spec_section: "data_entities",
      generated_files: migrationFiles.map((f) => f.relativePath),
      generator: "migration-generator",
    });
  }

  saveManifest(manifest);

  const tableCount = schemaFiles.filter((f) =>
    f.relativePath.startsWith("src/db/schema/") && !f.relativePath.includes("index")
  ).length;

  const migrationCount = migrationFiles.filter(
    (f) => f.relativePath.endsWith(".sql") && !f.relativePath.endsWith(".down.sql")
  ).length;

  const amendmentCount = ctx.pendingAmendments.length;

  const flags: string[] = [];
  if (migrationCount === 0) {
    flags.push("No migration files generated — run 'npm install && npx drizzle-kit generate' manually in the platform directory");
  }

  const result: PhaseGateResult = {
    phase: "database",
    files_created: allFiles.length,
    spec_amendments: amendmentCount,
    flags,
    summary: [
      `✓ ${tableCount} Drizzle schema table(s) + auth tables`,
      `✓ ${migrationCount} migration file(s)${migrationCount > 0 ? " (each with .down.sql rollback)" : " (install deps first)"}`,
      amendmentCount > 0 ? `⚠ ${amendmentCount} spec amendment(s) pending` : "✓ No spec amendments",
      ...flags.map((f) => `⚠ ${f}`),
    ].join("\n  "),
  };

  printPhaseGate(result);
  return result;
}

function printPhaseGate(result: PhaseGateResult): void {
  const LINE = "═".repeat(60);
  console.log(`\n  ${LINE}`);
  console.log(`  Phase 2 Complete — Database`);
  console.log(`  ${result.summary.replace(/\n/g, "\n  ")}`);
  if (result.flags.length > 0) {
    console.log(`\n  Spec changes: ${result.spec_amendments} | Needs review: ${result.flags.length}`);
  }
  console.log(`  ${LINE}`);
}
