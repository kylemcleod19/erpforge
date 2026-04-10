/**
 * GET /api/orgs/[orgId] — org detail with member list.
 * Restricted to platform_head.
 */
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/db/index";
import { organization, member, user, orgMeta } from "@/db/schema/index";
import { ok, apiError, notFound } from "@/lib/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await getSession();
  if (!session) return apiError("Unauthorized", 401);
  const currentUser = session.user as typeof session.user & { role?: string };
  if (currentUser.role !== "platform_head") return apiError("Forbidden", 403);

  const { orgId } = await params;

  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);

  if (!org) return notFound("Organization not found");

  const [meta] = await db
    .select()
    .from(orgMeta)
    .where(eq(orgMeta.orgId, orgId))
    .limit(1);

  const members = await db
    .select({
      memberId: member.id,
      role: member.role,
      joinedAt: member.createdAt,
      userId: user.id,
      name: user.name,
      email: user.email,
      globalRole: user.role,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, orgId))
    .orderBy(member.createdAt);

  return ok({
    org: {
      ...org,
      isDemo: meta?.isDemo ?? false,
      demoExpiresAt: meta?.demoExpiresAt ?? null,
    },
    members,
  });
}
