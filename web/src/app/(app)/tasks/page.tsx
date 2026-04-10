import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getSession } from "@/lib/session";
import { listTasks } from "@/lib/task-service";
import { Button } from "@/components/ui/button";
import { TaskList } from "@/components/tasks/task-list";

export default async function TasksPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = session.user as typeof session.user & { role?: string };
  const userRole = user.role ?? "client_user";

  const myTasks = await listTasks(session.user.id, userRole, {});

  const canCreate = userRole === "platform_head" || userRole === "consultant";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tasks</h1>
        {canCreate && (
          <Button asChild size="sm">
            <Link href="/tasks/new">
              <Plus className="h-4 w-4" />
              New Task
            </Link>
          </Button>
        )}
      </div>
      <TaskList tasks={myTasks} userRole={userRole} />
    </div>
  );
}
