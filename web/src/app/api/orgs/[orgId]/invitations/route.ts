/**
 * POST /api/orgs/[orgId]/invitations — invite a user to an org by email.
 * Restricted to platform_head.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { ok, apiError, serverError } from "@/lib/api";
import { childLogger } from "@/lib/logger";

const log = childLogger("api/orgs/invitations");

const InviteBody = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "member"]).default("member"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await getSession();
  if (!session) return apiError("Unauthorized", 401);
  const currentUser = session.user as typeof session.user & { role?: string };
  if (currentUser.role !== "platform_head") return apiError("Forbidden", 403);

  const { orgId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }

  const parsed = InviteBody.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? "Invalid request");
  }

  const { email, role } = parsed.data;

  try {
    const hdrs = await headers();
    await auth.api.createInvitation({
      body: { email, role, organizationId: orgId },
      headers: hdrs,
    });
    log.info({ orgId, email, role }, "invitation sent");
    return ok({ invited: true });
  } catch (err) {
    log.error({ orgId, email, err }, "invitation failed");
    return serverError(err instanceof Error ? err.message : "Failed to send invitation");
  }
}
