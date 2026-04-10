import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { NewOrgForm } from "@/components/orgs/new-org-form";

export default async function NewOrgPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = session.user as typeof session.user & { role?: string };
  if (user.role !== "platform_head") redirect("/dashboard");

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Link
        href="/orgs"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All organizations
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">New Organization</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create a real client organization. Use the demo flow for ephemeral trial sessions.
        </p>
      </div>

      <NewOrgForm />
    </div>
  );
}
