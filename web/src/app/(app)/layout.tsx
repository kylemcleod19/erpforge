import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/db/index";
import { orgMeta } from "@/db/schema/index";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = session.user as typeof session.user & { role?: string };

  // Check if current session belongs to a demo org (best-effort — may not have org context)
  // For now we look up org metadata for the user's active org if available
  let isDemo = false;
  let demoExpiresAt: string | undefined;

  const activeOrgId = (session as Record<string, unknown>).activeOrganizationId as string | undefined;
  if (activeOrgId) {
    const meta = await db
      .select()
      .from(orgMeta)
      .where(eq(orgMeta.orgId, activeOrgId))
      .limit(1);
    if (meta[0]?.isDemo) {
      isDemo = true;
      demoExpiresAt = meta[0].demoExpiresAt?.toISOString();
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar userRole={user.role} />
      <div className="flex-1 flex flex-col">
        <Header
          userName={session.user.name}
          userEmail={session.user.email}
          userRole={user.role}
          isDemo={isDemo}
          demoExpiresAt={demoExpiresAt}
        />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
