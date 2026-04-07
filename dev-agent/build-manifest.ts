/**
 * ERP Forge Dev Agent — Build Manifest
 *
 * Tracks the mapping from spec IDs to generated file paths.
 * Written to customers/<slug>/build-manifest.json after each phase.
 */

import * as fs from "fs";
import type { BuildManifest, ManifestEntry } from "./types.js";
import { buildManifestPath } from "./spec-manager.js";

// ─── Load / Create ────────────────────────────────────────────────────────────

export function createManifest(
  customerSlug: string,
  specVersion: string
): BuildManifest {
  return {
    customer_slug: customerSlug,
    spec_version: specVersion,
    build_started_at: new Date().toISOString(),
    entries: [],
  };
}

export function loadManifest(customerSlug: string): BuildManifest | null {
  const p = buildManifestPath(customerSlug);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8")) as BuildManifest;
}

export function saveManifest(manifest: BuildManifest): void {
  const p = buildManifestPath(manifest.customer_slug);
  fs.writeFileSync(p, JSON.stringify(manifest, null, 2));
}

// ─── Entry Management ─────────────────────────────────────────────────────────

/**
 * Adds or merges an entry for a spec ID.
 * If an entry for the same spec_id already exists, merges the file list.
 */
export function addEntry(
  manifest: BuildManifest,
  entry: Omit<ManifestEntry, "generated_at">
): BuildManifest {
  const existing = manifest.entries.findIndex(
    (e) => e.spec_id === entry.spec_id
  );

  const fullEntry: ManifestEntry = {
    ...entry,
    generated_at: new Date().toISOString(),
  };

  if (existing >= 0) {
    // Merge file lists
    const merged = new Set([
      ...manifest.entries[existing].generated_files,
      ...entry.generated_files,
    ]);
    manifest.entries[existing] = {
      ...fullEntry,
      generated_files: Array.from(merged),
    };
  } else {
    manifest.entries.push(fullEntry);
  }

  return manifest;
}

/**
 * Looks up the generated files for a given spec ID.
 */
export function getFilesForSpecId(
  manifest: BuildManifest,
  specId: string
): string[] {
  return manifest.entries.find((e) => e.spec_id === specId)?.generated_files ?? [];
}

/**
 * Returns all generated file paths across all entries.
 */
export function getAllGeneratedFiles(manifest: BuildManifest): string[] {
  return manifest.entries.flatMap((e) => e.generated_files);
}

/**
 * Marks the build as complete.
 */
export function completeBuild(manifest: BuildManifest): BuildManifest {
  manifest.build_completed_at = new Date().toISOString();
  return manifest;
}
