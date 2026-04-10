import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import { auth } from "@/lib/auth";
import { db } from "@/db/index";
import { organization } from "@/db/schema/index";
import { NewTaskForm } from "@/components/tasks/new-task-form";

export default async function NewTaskPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = session.user as typeof session.user & { role?: string };
  if (user.role !== "platform_head" && user.role !== "consultant") redirect("/tasks");

  // Fetch accessible orgs server-side to populate the org selector
  let orgs: { id: string; name: string; slug: string }[] = [];

  if (user.role === "platform_head") {
    orgs = await db.select({ id: organization.id, name: organization.name, slug: organization.slug })
      .from(organization)
      .orderBy(organization.name);
  } else {
    // Consultant: orgs they're a member of
    const hdrs = await headers();
    const memberships = await auth.api.listOrganizations({ headers: hdrs }).catch(() => []);
    orgs = Array.isArray(memberships)
      ? memberships.map((m: { id: string; name: string; slug: string }) => ({
          id: m.id,
          name: m.name,
          slug: m.slug,
        }))
      : [];
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Link
        href="/tasks"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All tasks
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">New Task</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Assign a task to a client user.
        </p>
      </div>

      <NewTaskForm orgs={orgs} />
    </div>
  );
}
