/**
 * ERP Forge Dev Agent — Spec Manager
 *
 * Handles reading, writing, and amending the customer spec.json.
 * Every amendment bumps the spec_version and appends a history entry.
 */

import * as fs from "fs";
import * as path from "path";
import type { ErpSpec, SpecAmendment, VersionBumpType } from "./types.js";
import { validateSpec } from "../interviewer/validate.js";

const CUSTOMERS_DIR = path.join(process.cwd(), "customers");

// ─── Paths ────────────────────────────────────────────────────────────────────

export function customerDir(slug: string): string {
  return path.join(CUSTOMERS_DIR, slug);
}

export function specPath(slug: string): string {
  return path.join(CUSTOMERS_DIR, slug, "spec.json");
}

export function platformDir(slug: string): string {
  return path.join(CUSTOMERS_DIR, slug, "platform");
}

export function devSessionPath(slug: string): string {
  return path.join(CUSTOMERS_DIR, slug, "dev-session.json");
}

export function buildManifestPath(slug: string): string {
  return path.join(CUSTOMERS_DIR, slug, "build-manifest.json");
}

// ─── Load / Save ─────────────────────────────────────────────────────────────

/**
 * Loads and validates the customer's spec.json.
 * @throws if spec file does not exist or fails schema validation.
 */
export function loadSpec(slug: string): ErpSpec {
  const p = specPath(slug);
  if (!fs.existsSync(p)) {
    throw new Error(
      `No spec found at ${p}. Run the interviewer first: npm run interview ${slug}`
    );
  }

  const raw = fs.readFileSync(p, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`spec.json is not valid JSON: ${String(e)}`);
  }

  const result = validateSpec(parsed);
  if (!result.valid) {
    const errors = result.errors.slice(0, 5).join("\n  • ");
    throw new Error(
      `spec.json failed schema validation:\n  • ${errors}\n\nFix the spec before running the dev agent.`
    );
  }

  return parsed as ErpSpec;
}

/**
 * Saves the spec to disk, updating updated_at.
 */
export function saveSpec(slug: string, spec: ErpSpec): void {
  spec.updated_at = new Date().toISOString();
  const p = specPath(slug);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(spec, null, 2));
}

// ─── Version Management ───────────────────────────────────────────────────────

/**
 * Bumps the spec version number.
 * @param current - Current semver string, e.g. "1.0.0"
 * @param bump - "major" | "minor" | "patch"
 */
export function bumpVersion(current: string, bump: VersionBumpType): string {
  const parts = current.split(".").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid spec_version format: ${current}`);
  }
  const [major, minor, patch] = parts;
  switch (bump) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

// ─── Amendments ───────────────────────────────────────────────────────────────

/**
 * Applies an amendment to the spec:
 * 1. Bumps spec_version (patch by default, or as specified)
 * 2. Appends a history entry
 * 3. Saves to disk
 *
 * @returns The updated spec
 */
export function amendSpec(
  slug: string,
  spec: ErpSpec,
  amendment: SpecAmendment
): ErpSpec {
  const newVersion = bumpVersion(spec.spec_version, amendment.bump_type);

  spec.history.push({
    version: newVersion,
    changed_at: amendment.flagged_at,
    changed_by: "dev_agent_v1",
    change_type: "amendment",
    rationale: `[${amendment.section}] ${amendment.issue} — Resolution: ${amendment.approved_resolution}${amendment.operator_note ? ` | Operator note: ${amendment.operator_note}` : ""}`,
    amended_sections: [amendment.section],
  });

  spec.spec_version = newVersion;
  saveSpec(slug, spec);

  console.log(
    `\n  ✓ Spec amended: ${amendment.section} → v${newVersion}\n    ${amendment.approved_resolution}\n`
  );

  return spec;
}

/**
 * Applies a batch of amendments sequentially.
 * Each amendment bumps the version independently.
 */
export function applyAmendments(
  slug: string,
  spec: ErpSpec,
  amendments: SpecAmendment[]
): ErpSpec {
  let current = spec;
  for (const amendment of amendments) {
    current = amendSpec(slug, current, amendment);
  }
  return current;
}

// ─── Platform Directory ───────────────────────────────────────────────────────

/**
 * Ensures the platform output directory exists.
 * @returns Absolute path to customers/<slug>/platform/
 */
export function ensurePlatformDir(slug: string): string {
  const dir = platformDir(slug);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Writes a file relative to the platform directory.
 * Creates intermediate directories as needed.
 */
export function writePlatformFile(
  platformDirPath: string,
  relativePath: string,
  content: string
): void {
  const fullPath = path.join(platformDirPath, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf-8");
}

/**
 * Checks if a platform file already exists.
 */
export function platformFileExists(
  platformDirPath: string,
  relativePath: string
): boolean {
  return fs.existsSync(path.join(platformDirPath, relativePath));
}
