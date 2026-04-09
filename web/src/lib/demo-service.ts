/**
 * Demo service — creates ephemeral demo orgs for unauthenticated visitors.
 *
 * Each call to createDemoOrg():
 *  1. Creates a better-auth user (temporary credentials)
 *  2. Creates a better-auth organization (demo-{uuid})
 *  3. Seeds demo tasks covering each action type
 *  4. Records org metadata with a 24-hour expiry
 *
 * Cleanup: DELETE /api/demo/cleanup deletes task/meta rows for orgs where demoExpiresAt < now().
 */
import { randomUUID } from "crypto";
import { eq, and, lt } from "drizzle-orm";
import { db } from "@/db/index";
import { tasks, orgMeta } from "@/db/schema/index";
import { auth } from "./auth";
import { childLogger } from "./logger";

const log = childLogger("demo-service");

// In-memory rate limiter: max 10 demo orgs per IP per hour
const ipCounts = new Map<string, { count: number; resetAt: number }>();

export function checkDemoRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipCounts.get(ip);
  if (!entry || entry.resetAt < now) {
    ipCounts.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

const DEMO_TASKS = [
  {
    title: "Clarify your BOM process",
    description:
      "Walk through your bill of materials structure with an AI interviewer. We'll cover how you manage multi-level BOMs, revision cycles, and product variants.",
    actionType: "interview" as const,
  },
  {
    title: "Upload your Netsuite integration spec",
    description:
      "If you have an existing integration document or API spec for Netsuite, upload it here. Our AI will extract the key integration points and flag any gaps.",
    actionType: "upload_document" as const,
  },
  {
    title: "Review inventory tracking workflow",
    description:
      "Discuss how you currently track raw materials, WIP, and finished goods. We'll identify the data entities and workflows needed in your ERP.",
    actionType: "interview" as const,
  },
  {
    title: "Upload meeting transcript — initial discovery call",
    description:
      "Have a recording or transcript from your initial discovery call? Upload it and our AI will extract open questions and action items automatically.",
    actionType: "upload_transcript" as const,
  },
  {
    title: "Add your team members and responsibilities",
    description:
      "List the people who will use the ERP platform and their roles. This helps us tailor workflows and permissions to your team structure.",
    actionType: "general" as const,
  },
] satisfies Array<{
  title: string;
  description: string;
  actionType: "interview" | "upload_document" | "upload_transcript" | "general";
}>;

export interface DemoSession {
  userId: string;
  orgId: string;
  email: string;
  password: string;
  expiresAt: Date;
}

export async function createDemoOrg(): Promise<DemoSession> {
  const uid = randomUUID();
  const orgSlug = `demo-${uid.slice(0, 8)}`;
  const email = `demo-${uid.slice(0, 8)}@demo.erpforge.internal`;
  const password = randomUUID();

  log.info({ orgSlug }, "creating demo org");

  // Create the user
  const signUpResult = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name: "Demo User",
      role: "client_user",
    },
  });

  if (!signUpResult?.user) {
    throw new Error("Failed to create demo user");
  }
  const userId = signUpResult.user.id;

  // Create the org
  const orgResult = await auth.api.createOrganization({
    body: {
      name: "Demo Company",
      slug: orgSlug,
      userId,
    },
  });

  if (!orgResult?.id) {
    throw new Error("Failed to create demo org");
  }
  const orgId = orgResult.id;

  // Record metadata with 24h expiry
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(orgMeta).values({ orgId, isDemo: true, demoExpiresAt: expiresAt });

  // Seed demo tasks
  await db.insert(tasks).values(
    DEMO_TASKS.map((t) => ({
      orgId,
      title: t.title,
      description: t.description,
      actionType: t.actionType,
      status: "open" as const,
      assignedToId: userId,
      assignedById: userId,
    }))
  );

  log.info({ orgId, orgSlug, email }, "demo org created");
  return { userId, orgId, email, password, expiresAt };
}

export async function cleanupExpiredDemoOrgs(): Promise<number> {
  const now = new Date();
  const expired = await db
    .select({ orgId: orgMeta.orgId })
    .from(orgMeta)
    .where(and(eq(orgMeta.isDemo, true), lt(orgMeta.demoExpiresAt, now)));

  log.info({ count: expired.length }, "cleaning up expired demo orgs");

  for (const { orgId } of expired) {
    await db.delete(tasks).where(eq(tasks.orgId, orgId));
    await db.delete(orgMeta).where(eq(orgMeta.orgId, orgId));
    // better-auth org/user rows are left in place — harmless orphans for startup phase
  }

  return expired.length;
}
