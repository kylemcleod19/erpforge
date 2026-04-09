/**
 * GET /api/orgs — list all organizations with member counts and demo status.
 * Restricted to platform_head.
 */
import { getSession } from "@/lib/session";
import { db } from "@/db/index";
import { organization, member, orgMeta } from "@/db/schema/index";
import { eq, sql } from "drizzle-orm";
import { ok, apiError } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return apiError("Unauthorized", 401);
  const user = session.user as typeof session.user & { role?: string };
  if (user.role !== "platform_head") return apiError("Forbidden", 403);

  const orgs = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      createdAt: organization.createdAt,
      memberCount: sql<number>`cast(count(${member.id}) as int)`,
      isDemo: orgMeta.isDemo,
      demoExpiresAt: orgMeta.demoExpiresAt,
    })
    .from(organization)
    .leftJoin(member, eq(member.organizationId, organization.id))
    .leftJoin(orgMeta, eq(orgMeta.orgId, organization.id))
    .groupBy(organization.id, orgMeta.isDemo, orgMeta.demoExpiresAt)
    .orderBy(organization.createdAt);

  return ok({ orgs });
}
