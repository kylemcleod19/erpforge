import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { getTask, listMessages } from "@/lib/task-service";
import { db } from "@/db/index";
import { uploads } from "@/db/schema/index";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TaskActionButtons } from "@/components/tasks/task-action-buttons";
import { TaskMessageThread } from "@/components/tasks/task-message-thread";
import { TaskStatusPatch } from "@/components/tasks/task-status-patch";
import { UploadInsights } from "@/components/tasks/upload-insights";

const STATUS_LABELS = {
  open: "Open",
  in_progress: "In Progress",
  complete: "Complete",
  blocked: "Blocked",
} as const;

const STATUS_VARIANTS = {
  open: "secondary",
  in_progress: "default",
  complete: "outline",
  blocked: "destructive",
} as const satisfies Record<string, "secondary" | "default" | "outline" | "destructive">;

const ACTION_LABELS = {
  interview: "AI Interview",
  upload_transcript: "Upload Transcript",
  upload_document: "Upload Document",
  reassign: "Re-assign",
  general: "General",
} as const;

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { taskId } = await params;
  const user = session.user as typeof session.user & { role?: string };

  const task = await getTask(taskId, session.user.id, user.role ?? "client_user");
  if (!task) notFound();

  const messages = await listMessages(taskId);
  const taskUploads = await db
    .select()
    .from(uploads)
    .where(eq(uploads.taskId, taskId))
    .orderBy(uploads.createdAt);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={STATUS_VARIANTS[task.status]}>{STATUS_LABELS[task.status]}</Badge>
          <span className="text-xs text-muted-foreground">
            {ACTION_LABELS[task.actionType]}
          </span>
        </div>
        <h1 className="text-2xl font-semibold">{task.title}</h1>
        {task.description && (
          <p className="text-muted-foreground text-sm leading-relaxed">{task.description}</p>
        )}
        {task.dueAt && (
          <p className="text-xs text-muted-foreground">
            Due {new Date(task.dueAt).toLocaleDateString()}
          </p>
        )}
      </div>

      <Separator />

      {/* Actions */}
      <TaskActionButtons task={task} />

      <Separator />

      {/* Upload insights */}
      {taskUploads.length > 0 && (
        <>
          <UploadInsights uploads={taskUploads} />
          <Separator />
        </>
      )}

      {/* Status controls + message thread */}
      <div className="space-y-4">
        <TaskStatusPatch taskId={task.id} currentStatus={task.status} />
        <TaskMessageThread
          taskId={task.id}
          initialMessages={messages}
          currentUserId={session.user.id}
          currentUserName={session.user.name}
        />
      </div>
    </div>
  );
}
