/**
 * Build Service
 *
 * Wraps the CLI DevAgent for use as a background web job.
 * Unlike the interview service (which synchronises turns), the build is
 * fire-and-forget: POST /api/builds starts it, GET /api/builds/:slug polls it.
 *
 * HOW IT WORKS
 * ────────────
 * DevAgent.run() blocks at two kinds of operator prompts:
 *   1. Flag resolution: "accept default? (y)" → we answer "y"
 *   2. Phase gates: "[Phase X complete] Type 'continue' to proceed" → "continue"
 *
 * A mock readline intercepts both, auto-approves them, and extracts the
 * current phase from the prompt text so we can track progress without
 * modifying DevAgent source.
 *
 * STATUS TRACKING
 * ───────────────
 * Each build job is tracked in an in-memory Map<slug, BuildStatus>.
 * The Map entry is updated as phases complete. Clients poll GET /api/builds/:slug.
 * The persistent source of truth is customers/<slug>/dev-session.json (written
 * by DevAgent.saveSession() throughout the build).
 *
 * If the server restarts mid-build, the in-memory status is lost but the
 * dev-session.json on the Railway volume survives. GET /api/builds/:slug falls
 * back to reading dev-session.json so clients can still see the last phase.
 */

import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import { DevAgent } from "../../../dev-agent/agent";
import { devSessionPath, buildManifestPath, specPath } from "../../../dev-agent/spec-manager";
import { config } from "./config";
import { childLogger } from "./logger";
import { sendAlert } from "./alert";
import type { DevAgentSession } from "../../../dev-agent/types";

const log = childLogger("build-service");

// ─── Types ────────────────────────────────────────────────────────────────────

export type BuildStatusValue = "queued" | "running" | "complete" | "error";

export interface BuildStatus {
  slug: string;
  specVersion: string;
  status: BuildStatusValue;
  currentPhase: string;
  filesCreated: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

// ─── In-memory job registry ───────────────────────────────────────────────────

const builds = new Map<string, BuildStatus>();

// ─── File-count helper ────────────────────────────────────────────────────────

function countManifestFiles(slug: string): number {
  try {
    const manifestPath = buildManifestPath(slug);
    if (!fs.existsSync(manifestPath)) return 0;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
      files?: Record<string, unknown>;
    };
    return Object.keys(manifest.files ?? {}).length;
  } catch {
    return 0;
  }
}

// ─── Auto-approve readline ────────────────────────────────────────────────────

/**
 * Returns a mock readline.Interface that auto-approves all DevAgent prompts.
 * Inspects prompt text to track phase transitions for status reporting.
 */
function makeAutoBuildRl(status: BuildStatus): readline.Interface {
  return {
    question: (prompt: string, callback: (answer: string) => void) => {
      // Phase gate: "[Phase scaffold complete] Type 'continue' to proceed: "
      const phaseMatch = prompt.match(/\[Phase (\w+) complete\]/i);
      if (phaseMatch) {
        const completedPhase = phaseMatch[1];
        log.info(
          { slug: status.slug, phase: completedPhase },
          "build.phase_complete"
        );
        builds.set(status.slug, {
          ...status,
          currentPhase: completedPhase,
          filesCreated: countManifestFiles(status.slug),
        });
        callback("continue");
        return;
      }

      // Flag resolution or any other prompt → accept default
      callback("y");
    },
    close: () => {},
    // readline.Interface has many members we don't use in DevAgent
  } as unknown as readline.Interface;
}

// ─── Build runner ─────────────────────────────────────────────────────────────

async function runBuild(slug: string, status: BuildStatus): Promise<void> {
  const apiKey = config.anthropicApiKey;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const rl = makeAutoBuildRl(status);
  const agent = DevAgent.init(apiKey, rl, slug);

  try {
    await agent.run();
  } finally {
    rl.close();
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Starts a new build job for a customer slug.
 * Throws if no spec.json exists for the slug or a build is already running.
 */
export async function startBuild(slug: string): Promise<BuildStatus> {
  // Guard: don't double-start a running build
  const existing = builds.get(slug);
  if (existing && existing.status === "running") {
    throw new Error(`A build for ${slug} is already running (phase: ${existing.currentPhase})`);
  }

  // Guard: spec must exist
  const spec = specPath(slug);
  if (!fs.existsSync(spec)) {
    throw new Error(
      `No spec.json found for ${slug}. Complete the interview first.`
    );
  }

  // Read spec version for tracking
  let specVersion = "unknown";
  try {
    const raw = JSON.parse(fs.readFileSync(spec, "utf-8")) as { spec_version?: string };
    specVersion = raw.spec_version ?? "unknown";
  } catch {
    // specVersion stays "unknown"
  }

  const status: BuildStatus = {
    slug,
    specVersion,
    status: "running",
    currentPhase: "plan",
    filesCreated: 0,
    startedAt: new Date().toISOString(),
  };
  builds.set(slug, status);

  log.info({ slug, specVersion }, "build.started");

  // Fire and forget — the build runs entirely in the background.
  void runBuild(slug, status)
    .then(() => {
      const filesCreated = countManifestFiles(slug);
      const completed: BuildStatus = {
        ...status,
        status: "complete",
        currentPhase: "complete",
        filesCreated,
        completedAt: new Date().toISOString(),
      };
      builds.set(slug, completed);
      log.info({ slug, filesCreated }, "build.complete");
    })
    .catch(async (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const failed: BuildStatus = {
        ...status,
        status: "error",
        errorMessage,
        completedAt: new Date().toISOString(),
      };
      builds.set(slug, failed);
      log.error({ slug, err }, "build.error");
      await sendAlert("Build failed", { slug, errorMessage });
    });

  return status;
}

/**
 * Returns the current build status for a slug.
 * Falls back to reading dev-session.json if no in-memory entry exists
 * (handles the case where the server restarted mid-build).
 */
export function getBuildStatus(slug: string): BuildStatus | null {
  // Prefer in-memory (most up-to-date)
  const inMemory = builds.get(slug);
  if (inMemory) return inMemory;

  // Fall back to dev-session.json on disk
  const sessionFile = devSessionPath(slug);
  if (!fs.existsSync(sessionFile)) return null;

  try {
    const session = JSON.parse(
      fs.readFileSync(sessionFile, "utf-8")
    ) as DevAgentSession;

    return {
      slug,
      specVersion: session.spec_version,
      status: session.current_phase === "complete" ? "complete" : "running",
      currentPhase: session.current_phase,
      filesCreated: countManifestFiles(slug),
      startedAt: session.started_at,
      completedAt:
        session.current_phase === "complete" ? session.updated_at : undefined,
    };
  } catch {
    return null;
  }
}
