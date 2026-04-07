/**
 * GET /api/interviews/:slug
 * Returns the current state of an interview session (read from disk).
 * Use this to check if a session exists, what phase it's in, and whether
 * a worker is active (i.e. whether POST /messages will succeed).
 *
 * Response: { ok: true, data: { slug, sessionId, phase, completedModules, reviewFlagsCount, specPath, workerActive } }
 */
import { NextRequest } from "next/server";
import { getSessionState } from "@/lib/interview-service";
import { ok, notFound } from "@/lib/api";
import { childLogger } from "@/lib/logger";

const log = childLogger("api/interviews/[slug]");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  log.debug({ slug }, "GET session state");

  const state = getSessionState(slug);
  if (!state) return notFound("Interview session");

  return ok(state);
}
