/**
 * GET  /api/tasks/:taskId/messages  — message thread
 * POST /api/tasks/:taskId/messages  — post a new message
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { getTask, listMessages, postMessage } from "@/lib/task-service";
import { ok, created, apiError, notFound, serverError } from "@/lib/api";
import { childLogger } from "@/lib/logger";

const log = childLogger("api/tasks/[taskId]/messages");

const PostMessageBody = z.object({
  body: z.string().min(1).max(10_000),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await getSession();
  if (!session) return apiError("Unauthorized", 401);

  const { taskId } = await params;
  const user = session.user as typeof session.user & { role?: string };

  const task = await getTask(taskId, session.user.id, user.role ?? "client_user");
  if (!task) return notFound("Task");

  try {
    const messages = await listMessages(taskId);
    return ok(messages);
  } catch (err) {
    log.error({ taskId, err }, "failed to list messages");
    return serverError();
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await getSession();
  if (!session) return apiError("Unauthorized", 401);

  const { taskId } = await params;
  const user = session.user as typeof session.user & { role?: string };

  const task = await getTask(taskId, session.user.id, user.role ?? "client_user");
  if (!task) return notFound("Task");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }

  const parsed = PostMessageBody.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? "Invalid request");
  }

  try {
    const message = await postMessage(taskId, session.user.id, parsed.data.body);
    return created(message);
  } catch (err) {
    log.error({ taskId, err }, "failed to post message");
    return serverError();
  }
}
