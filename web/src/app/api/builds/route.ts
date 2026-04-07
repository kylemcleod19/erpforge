/**
 * POST /api/builds
 *
 * Triggers a dev-agent build for a customer slug that has a completed spec.
 * The build runs entirely in the background. Poll GET /api/builds/:slug for status.
 *
 * Body: { slug: string }
 * Response: { ok: true, data: BuildStatus }
 *
 * Errors:
 *   400 — slug has no spec.json (interview not complete) or build already running
 *   500 — unexpected error
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { startBuild } from "@/lib/build-service";
import { ok, apiError, serverError } from "@/lib/api";
import { childLogger } from "@/lib/logger";

const log = childLogger("api/builds");

const StartBuildBody = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }

  const parsed = StartBuildBody.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? "Invalid request");
  }

  const { slug } = parsed.data;
  log.info({ slug }, "Build requested");

  try {
    const status = await startBuild(slug);
    return ok(status, 202); // 202 Accepted — work is in progress
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already running") || msg.includes("No spec.json")) {
      return apiError(msg, 400);
    }
    log.error({ slug, err }, "Failed to start build");
    return serverError(msg);
  }
}
