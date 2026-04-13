import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { getTask } from "@/lib/task-service";
import { ChatUI } from "@/components/interview/chat-ui";

export default async function InterviewPage({
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

  // Derive a deterministic interview slug from the task ID.
  // UUID chars (a-z, 0-9, -) are all valid slug characters.
  const interviewSlug = task.interviewSlug ?? `task-${task.id}`;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Back nav */}
      <div className="shrink-0 border-b px-6 py-3 flex items-center gap-3">
        <Link
          href={`/tasks/${taskId}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to task
        </Link>
        <span className="text-muted-foreground/40">|</span>
        <span className="text-sm font-medium truncate">{task.title}</span>
      </div>

      {/* Chat fills remaining space */}
      <div className="flex-1 min-h-0 px-6 py-4">
        <div className="max-w-2xl mx-auto h-full">
          <ChatUI
            slug={interviewSlug}
            taskTitle={task.title}
            initialPrompt={task.contextNotes ?? undefined}
          />
        </div>
      </div>
    </div>
  );
}
