import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/db/index";
import { tasks } from "@/db/schema/index";
import { TaskList } from "@/components/tasks/task-list";

export default async function TasksPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = session.user as typeof session.user & { role?: string };

  // For now: show tasks assigned to this user.
  // Phase 2 will add full org-scoped visibility rules via task-service.ts.
  const myTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.assignedToId, session.user.id))
    .orderBy(tasks.createdAt);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tasks</h1>
      </div>
      <TaskList tasks={myTasks} userRole={user.role} />
    </div>
  );
}
