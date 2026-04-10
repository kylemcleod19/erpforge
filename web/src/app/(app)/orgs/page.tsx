import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { Building2, Users, Clock, Plus } from "lucide-react";
import { getSession } from "@/lib/session";
import { db } from "@/db/index";
import { organization, member, orgMeta } from "@/db/schema/index";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DemoCleanupButton } from "@/components/orgs/demo-cleanup-button";

export default async function OrgsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = session.user as typeof session.user & { role?: string };
  if (user.role !== "platform_head") redirect("/dashboard");

  const orgs = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      createdAt: organization.createdAt,
      memberCount: sql<number>`cast(count(${member.id}) as int)`,
      isDemo: orgMeta.isDemo,
      demoExpiresAt: orgMeta.demoExpiresAt,
    })
    .from(organization)
    .leftJoin(member, eq(member.organizationId, organization.id))
    .leftJoin(orgMeta, eq(orgMeta.orgId, organization.id))
    .groupBy(organization.id, orgMeta.isDemo, orgMeta.demoExpiresAt)
    .orderBy(organization.createdAt);

  const expiredCount = orgs.filter(
    (o) => o.isDemo && o.demoExpiresAt && new Date(o.demoExpiresAt) < new Date()
  ).length;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Organizations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {orgs.length} total · {orgs.filter((o) => !o.isDemo).length} real ·{" "}
            {orgs.filter((o) => o.isDemo).length} demo
          </p>
        </div>
        <div className="flex items-center gap-2">
          {expiredCount > 0 && <DemoCleanupButton expiredCount={expiredCount} />}
          <Button asChild size="sm">
            <Link href="/orgs/new">
              <Plus className="h-4 w-4" />
              New Org
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border divide-y">
        {orgs.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">No organizations yet.</p>
        )}
        {orgs.map((org) => {
          const expired =
            org.isDemo && org.demoExpiresAt && new Date(org.demoExpiresAt) < new Date();
          return (
            <Link
              key={org.id}
              href={`/orgs/${org.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{org.name}</span>
                    {org.isDemo && (
                      <Badge variant={expired ? "destructive" : "secondary"} className="text-xs">
                        {expired ? "expired" : "demo"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{org.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0 ml-4">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {org.memberCount}
                </span>
                {org.demoExpiresAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {expired
                      ? "Expired"
                      : `Expires ${new Date(org.demoExpiresAt).toLocaleDateString()}`}
                  </span>
                )}
                {!org.isDemo && (
                  <span>{new Date(org.createdAt).toLocaleDateString()}</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
