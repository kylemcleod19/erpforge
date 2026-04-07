/**
 * GET /api/builds/:slug
 *
 * Returns the current build status for a customer slug.
 * Checks in-memory status first, then falls back to dev-session.json on disk
 * so it survives server restarts.
 *
 * Response: { ok: true, data: BuildStatus }
 *
 * Poll this endpoint every 5–10 seconds during an active build.
 * The build is done when status is "complete" or "error".
 */
import { NextRequest } from "next/server";
import { getBuildStatus } from "@/lib/build-service";
import { ok, notFound } from "@/lib/api";
import { childLogger } from "@/lib/logger";

const log = childLogger("api/builds/[slug]");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  log.debug({ slug }, "GET build status");

  const status = getBuildStatus(slug);
  if (!status) return notFound("Build job");

  return ok(status);
}
