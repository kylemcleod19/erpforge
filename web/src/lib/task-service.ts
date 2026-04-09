/**
 * Task service — CRUD helpers with org-scoped visibility rules.
 *
 * Visibility rules:
 *   platform_head → sees all tasks across all orgs
 *   consultant     → sees tasks in orgs they are a member of
 *   client_admin / client_user → sees tasks in their own org only
 */
import { eq, and, inArray, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/index";
import { tasks, taskMessages } from "@/db/schema/index";
import { auth } from "./auth";
import type { TaskRow, NewTaskRow, TaskMessageRow } from "@/db/schema/index";

export type { TaskRow, TaskMessageRow };

// ---------------------------------------------------------------------------
// Visibility helpers
// ---------------------------------------------------------------------------

/**
 * Returns org IDs visible to this user based on their platform role.
 * Returns null to mean "all orgs" (platform_head).
 */
async function visibleOrgIds(
  userId: string,
  userRole: string
): Promise<string[] | null> {
  if (userRole === "platform_head") return null; // no filter

  // Get orgs this user is a member of via better-auth
  const hdrs = await headers();
  const memberships = await auth.api
    .listOrganizations({ headers: hdrs })
    .catch(() => null);
  if (!memberships || !Array.isArray(memberships)) return [];
  return memberships.map((m: { id: string }) => m.id);
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export interface ListTasksOptions {
  orgId?: string;
  assignedToId?: string;
  status?: TaskRow["status"];
}

export async function listTasks(
  userId: string,
  userRole: string,
  opts: ListTasksOptions = {}
): Promise<TaskRow[]> {
  const orgIds = await visibleOrgIds(userId, userRole);

  const conditions = [];

  // Scope to visible orgs
  if (opts.orgId) {
    // Verify the caller can see this org
    if (orgIds !== null && !orgIds.includes(opts.orgId)) {
      return [];
    }
    conditions.push(eq(tasks.orgId, opts.orgId));
  } else if (orgIds !== null) {
    if (orgIds.length === 0) return [];
    conditions.push(inArray(tasks.orgId, orgIds));
  }

  if (opts.assignedToId) {
    conditions.push(eq(tasks.assignedToId, opts.assignedToId));
  }
  if (opts.status) {
    conditions.push(eq(tasks.status, opts.status));
  }

  return db
    .select()
    .from(tasks)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(tasks.createdAt));
}

// ---------------------------------------------------------------------------
// Get single
// ---------------------------------------------------------------------------

export async function getTask(
  taskId: string,
  userId: string,
  userRole: string
): Promise<TaskRow | null> {
  const rows = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  const task = rows[0];
  if (!task) return null;

  const orgIds = await visibleOrgIds(userId, userRole);
  if (orgIds !== null && !orgIds.includes(task.orgId)) return null;

  return task;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CreateTaskInput = Pick<
  NewTaskRow,
  "orgId" | "title" | "description" | "contextNotes" | "assignedToId" | "actionType" | "interviewSlug" | "dueAt"
>;

export async function createTask(
  input: CreateTaskInput,
  createdById: string
): Promise<TaskRow> {
  const rows = await db
    .insert(tasks)
    .values({ ...input, assignedById: createdById })
    .returning();
  return rows[0]!;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export type UpdateTaskInput = Partial<
  Pick<TaskRow, "title" | "description" | "status" | "assignedToId" | "dueAt">
>;

export async function updateTask(
  taskId: string,
  patch: UpdateTaskInput,
  userId: string,
  userRole: string
): Promise<TaskRow | null> {
  const task = await getTask(taskId, userId, userRole);
  if (!task) return null;

  // Only assignee, assigning consultant, or platform_head can update
  const canEdit =
    userRole === "platform_head" ||
    userRole === "consultant" ||
    task.assignedToId === userId ||
    task.assignedById === userId;
  if (!canEdit) return null;

  const now = new Date();
  const completedAt =
    patch.status === "complete" ? now : patch.status !== undefined ? null : undefined;

  const rows = await db
    .update(tasks)
    .set({
      ...patch,
      ...(completedAt !== undefined && { completedAt }),
      updatedAt: now,
    })
    .where(eq(tasks.id, taskId))
    .returning();
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function listMessages(taskId: string): Promise<TaskMessageRow[]> {
  return db
    .select()
    .from(taskMessages)
    .where(eq(taskMessages.taskId, taskId))
    .orderBy(taskMessages.createdAt);
}

export async function postMessage(
  taskId: string,
  authorId: string,
  body: string
): Promise<TaskMessageRow> {
  const rows = await db
    .insert(taskMessages)
    .values({ taskId, authorId, body })
    .returning();
  return rows[0]!;
}
