/**
 * GET   /api/tasks/:taskId  — task detail
 * PATCH /api/tasks/:taskId  — update status, assignee, title, or description
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { getTask, updateTask, listMessages } from "@/lib/task-service";
import { ok, apiError, notFound, serverError } from "@/lib/api";
import { childLogger } from "@/lib/logger";

const log = childLogger("api/tasks/[taskId]");

const UpdateTaskBody = z
  .object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(5000).optional(),
    status: z.enum(["open", "in_progress", "complete", "blocked"]).optional(),
    assignedToId: z.string().optional(),
    dueAt: z.string().datetime().nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "At least one field is required",
  });

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await getSession();
  if (!session) return apiError("Unauthorized", 401);

  const { taskId } = await params;
  const user = session.user as typeof session.user & { role?: string };

  try {
    const task = await getTask(taskId, session.user.id, user.role ?? "client_user");
    if (!task) return notFound("Task");

    const messages = await listMessages(taskId);
    return ok({ task, messages });
  } catch (err) {
    log.error({ taskId, err }, "failed to get task");
    return serverError();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await getSession();
  if (!session) return apiError("Unauthorized", 401);

  const { taskId } = await params;
  const user = session.user as typeof session.user & { role?: string };

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }

  const parsed = UpdateTaskBody.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? "Invalid request");
  }

  const { dueAt, ...rest } = parsed.data;

  try {
    const updated = await updateTask(
      taskId,
      {
        ...rest,
        ...(dueAt !== undefined && { dueAt: dueAt ? new Date(dueAt) : null }),
      },
      session.user.id,
      user.role ?? "client_user"
    );
    if (!updated) return notFound("Task");
    log.info({ taskId }, "task updated");
    return ok(updated);
  } catch (err) {
    log.error({ taskId, err }, "failed to update task");
    return serverError();
  }
}
