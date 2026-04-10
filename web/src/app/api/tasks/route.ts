/**
 * GET  /api/tasks  — list tasks visible to the caller
 * POST /api/tasks  — create a new task (consultant + platform_head only)
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { listTasks, createTask } from "@/lib/task-service";
import type { TaskRow } from "@/lib/task-service";
import { ok, created, apiError, serverError } from "@/lib/api";
import { childLogger } from "@/lib/logger";

const log = childLogger("api/tasks");

const CreateTaskBody = z.object({
  orgId: z.string().min(1),
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  contextNotes: z.string().max(5000).optional(),
  assignedToId: z.string().optional(),
  actionType: z
    .enum(["interview", "upload_transcript", "upload_document", "reassign", "general"])
    .default("general"),
  interviewSlug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  dueAt: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return apiError("Unauthorized", 401);

  const user = session.user as typeof session.user & { role?: string };
  const { searchParams } = req.nextUrl;

  try {
    const taskList = await listTasks(session.user.id, user.role ?? "client_user", {
      orgId: searchParams.get("orgId") ?? undefined,
      assignedToId: searchParams.get("assignedToId") ?? undefined,
      status: (searchParams.get("status") as TaskRow["status"] | null) ?? undefined,
    });
    return ok(taskList);
  } catch (err) {
    log.error({ err }, "failed to list tasks");
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return apiError("Unauthorized", 401);

  const user = session.user as typeof session.user & { role?: string };
  if (user.role !== "platform_head" && user.role !== "consultant") {
    return apiError("Forbidden", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }

  const parsed = CreateTaskBody.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? "Invalid request");
  }

  const { dueAt, ...rest } = parsed.data;

  try {
    const task = await createTask(
      { ...rest, dueAt: dueAt ? new Date(dueAt) : undefined },
      session.user.id
    );
    log.info({ taskId: task.id, orgId: task.orgId }, "task created");
    return created(task);
  } catch (err) {
    log.error({ err }, "failed to create task");
    return serverError();
  }
}
