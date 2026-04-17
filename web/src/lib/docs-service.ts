/**
 * Docs Service — HTTP client
 *
 * Calls the Docs microservice (services/docs/server.ts) to trigger and poll
 * on-demand documentation generation for a completed customer build.
 */

import { config } from "./config";
import { childLogger } from "./logger";

const log = childLogger("docs-service");

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocJobStatus = "running" | "complete" | "error";

export interface DocJob {
  slug: string;
  status: DocJobStatus;
  artifacts: string[];
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
  const url = `${config.docsServiceUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const json = (await res.json()) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(
      (json as { error?: string }).error ?? `Docs service error: ${res.status}`
    );
  }
  return json as T;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Triggers async documentation generation for a completed customer build.
 * Returns immediately — poll getDocsStatus() for completion.
 */
export async function generateDocs(
  slug: string
): Promise<{ jobId: string; status: string }> {
  const result = await serviceRequest<{ jobId: string; status: string }>(
    "POST",
    "/docs",
    { slug }
  );
  log.info({ slug }, "docs.generation_started");
  return result;
}

/**
 * Returns the current docs generation status. Returns null if no job exists.
 */
export async function getDocsStatus(slug: string): Promise<DocJob | null> {
  try {
    return await serviceRequest<DocJob>(
      "GET",
      `/docs/${encodeURIComponent(slug)}`
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    throw err;
  }
}

/**
 * Returns the CUSTOMER_SUMMARY.md content as a string.
 * Returns null if not yet generated.
 */
export async function getSpecSummary(slug: string): Promise<string | null> {
  const url = `${config.docsServiceUrl}/docs/${encodeURIComponent(slug)}/spec-summary`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Docs service error: ${res.status}`);
  return res.text();
}
