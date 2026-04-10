/**
 * GET /api/orgs — list all organizations with member counts and demo status.
 * POST /api/orgs — create a new (real) organization.
 * Both restricted to platform_head.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import { auth } from "@/lib/auth";
import { db } from "@/db/index";
import { organization, member, orgMeta } from "@/db/schema/index";
import { eq, sql } from "drizzle-orm";
import { ok, apiError, serverError } from "@/lib/api";
import { childLogger } from "@/lib/logger";

const log = childLogger("api/orgs");

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

const CreateOrgBody = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return apiError("Unauthorized", 401);
  const user = session.user as typeof session.user & { role?: string };
  if (user.role !== "platform_head") return apiError("Forbidden", 403);

  let body: unknown;
  try { body = await req.json(); } catch { return apiError("Invalid JSON body"); }

  const parsed = CreateOrgBody.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? "Invalid request");

  const { name, slug } = parsed.data;

  try {
    const hdrs = await headers();
    const org = await auth.api.createOrganization({
      body: { name, slug },
      headers: hdrs,
    });

    // Record in org_meta as a real (non-demo) org
    await db.insert(orgMeta).values({ orgId: org.id, isDemo: false });

    log.info({ orgId: org.id, slug }, "organization created");
    return ok({ orgId: org.id, slug: org.slug });
  } catch (err) {
    log.error({ err }, "failed to create organization");
    return serverError(err instanceof Error ? err.message : "Failed to create organization");
  }
}
