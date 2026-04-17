/**
 * Build Service — HTTP client
 *
 * Delegates all build work to the Coder microservice
 * (services/coder/server.ts). The web server no longer runs the DevAgent
 * in-process; it is an HTTP orchestrator only.
 *
 * Function signatures are identical to the old in-process bridge so callers
 * (API route handlers) require no changes.
 */

import { config } from "./config";
import { childLogger } from "./logger";

const log = childLogger("build-service");

// ─── Types (re-exported for route handlers) ───────────────────────────────────

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

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function serviceRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${config.coderServiceUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const json = (await res.json()) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(
      (json as { error?: string }).error ?? `Coder service error: ${res.status}`
    );
  }
  return json as T;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Starts a new build job for a customer slug.
 * Throws if no spec.json exists or a build is already running.
 */
export async function startBuild(slug: string): Promise<BuildStatus> {
  const status = await serviceRequest<BuildStatus>("POST", "/builds", { slug });
  log.info({ slug, specVersion: status.specVersion }, "build.started");
  return status;
}

/**
 * Returns the current build status for a slug.
 * Returns null if no build exists for this slug.
 */
export async function getBuildStatus(slug: string): Promise<BuildStatus | null> {
  try {
    return await serviceRequest<BuildStatus>(
      "GET",
      `/builds/${encodeURIComponent(slug)}`
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    throw err;
  }
}
