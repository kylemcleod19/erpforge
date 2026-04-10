import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowLeft, Building2, Crown, Shield, User } from "lucide-react";
import { getSession } from "@/lib/session";
import { db } from "@/db/index";
import { organization, member, user, orgMeta } from "@/db/schema/index";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { InviteForm } from "@/components/orgs/invite-form";

const MEMBER_ROLE_ICONS = {
  owner: Crown,
  admin: Shield,
  member: User,
} as const;

const MEMBER_ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
} as const;

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const currentUser = session.user as typeof session.user & { role?: string };
  if (currentUser.role !== "platform_head") redirect("/dashboard");

  const { orgId } = await params;

  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);

  if (!org) notFound();

  const [meta] = await db
    .select()
    .from(orgMeta)
    .where(eq(orgMeta.orgId, orgId))
    .limit(1);

  const members = await db
    .select({
      memberId: member.id,
      role: member.role,
      joinedAt: member.createdAt,
      userId: user.id,
      name: user.name,
      email: user.email,
      globalRole: user.role,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, orgId))
    .orderBy(member.createdAt);

  const isDemo = meta?.isDemo ?? false;
  const expired =
    isDemo && meta?.demoExpiresAt && new Date(meta.demoExpiresAt) < new Date();

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Back nav */}
      <Link
        href="/orgs"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All organizations
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3">
        <Building2 className="h-6 w-6 text-muted-foreground mt-0.5 shrink-0" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{org.name}</h1>
            {isDemo && (
              <Badge variant={expired ? "destructive" : "secondary"}>
                {expired ? "expired demo" : "demo"}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {org.slug} · Created {new Date(org.createdAt).toLocaleDateString()}
          </p>
          {isDemo && meta?.demoExpiresAt && (
            <p className="text-xs text-muted-foreground">
              {expired
                ? `Expired ${new Date(meta.demoExpiresAt).toLocaleString()}`
                : `Expires ${new Date(meta.demoExpiresAt).toLocaleString()}`}
            </p>
          )}
        </div>
      </div>

      <Separator />

      {/* Members */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">
          Members ({members.length})
        </p>
        <div className="rounded-lg border divide-y">
          {members.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No members yet.</p>
          )}
          {members.map((m) => {
            const roleKey = (m.role ?? "member") as keyof typeof MEMBER_ROLE_ICONS;
            const Icon = MEMBER_ROLE_ICONS[roleKey] ?? User;
            return (
              <div key={m.memberId} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {m.globalRole && m.globalRole !== "client_user" && (
                    <Badge variant="outline" className="text-xs">
                      {m.globalRole}
                    </Badge>
                  )}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    {MEMBER_ROLE_LABELS[roleKey] ?? m.role}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Invite */}
      {!expired && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Invite Member</p>
          <InviteForm orgId={orgId} />
        </div>
      )}
    </div>
  );
}
