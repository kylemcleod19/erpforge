/**
 * POST /api/demo — create an ephemeral demo org and auto-sign-in the visitor.
 * DELETE /api/demo/cleanup — delete expired demo orgs (platform_head only).
 *
 * This route is public (no auth required for POST).
 */
import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  createDemoOrg,
  cleanupExpiredDemoOrgs,
  checkDemoRateLimit,
} from "@/lib/demo-service";
import { ok, apiError, serverError } from "@/lib/api";
import { childLogger } from "@/lib/logger";
import { getSession } from "@/lib/session";

const log = childLogger("api/demo");

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!checkDemoRateLimit(ip)) {
    return apiError("Too many demo requests — please try again later.", 429);
  }

  try {
    const demo = await createDemoOrg();

    // Auto-sign-in the demo user so they land on /tasks already authenticated
    const hdrs = await headers();
    const signInResult = await auth.api.signInEmail({
      body: { email: demo.email, password: demo.password },
      headers: hdrs,
    });

    if (!signInResult) {
      return serverError("Failed to sign in demo user");
    }

    log.info({ orgId: demo.orgId }, "demo session started");
    return ok({ orgId: demo.orgId, expiresAt: demo.expiresAt.toISOString() });
  } catch (err) {
    log.error({ err }, "failed to create demo org");
    return serverError("Failed to create demo session");
  }
}

export async function DELETE() {
  // Only platform_head can trigger cleanup
  const session = await getSession();
  if (!session) return apiError("Unauthorized", 401);
  const user = session.user as typeof session.user & { role?: string };
  if (user.role !== "platform_head") return apiError("Forbidden", 403);

  try {
    const count = await cleanupExpiredDemoOrgs();
    log.info({ count }, "demo cleanup complete");
    return ok({ deleted: count });
  } catch (err) {
    log.error({ err }, "demo cleanup failed");
    return serverError("Cleanup failed");
  }
}
