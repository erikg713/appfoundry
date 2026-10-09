import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, ArrowRight } from "lucide-react";
import { CreateOrganizationForm } from "./create-organization-form";
import { JoinByInviteForm } from "./join-by-invite-form";

export default async function OrganizationsPage() {
  const { userId } = await requireSession();

  const memberships = await prisma.member.findMany({
    where: { userId },
    include: {
      organization: {
        include: {
          _count: { select: { members: true, projects: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Organizations
        </h1>
        <p className="text-muted-foreground">
          Workspaces for teams — projects, members, and roles live here.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          <h2 className="font-semibold">Your organizations</h2>
          {memberships.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  You have not joined or created any organizations yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-3">
              {memberships.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/dashboard/organizations/${m.organizationId}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border bg-white px-5 py-4 hover:bg-slate-50 transition"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {m.organization.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        /{m.organization.slug} ·{" "}
                        {m.organization._count.members} member
                        {m.organization._count.members === 1 ? "" : "s"} ·{" "}
                        {m.organization._count.projects} project
                        {m.organization._count.projects === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize">
                        {m.role}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Have an invite code?</CardTitle>
              <CardDescription>
                If a teammate shared an invitation ID with you, paste it here to
                join their organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <JoinByInviteForm />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create organization</CardTitle>
              <CardDescription>
                A new workspace with you as the owner.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreateOrganizationForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
