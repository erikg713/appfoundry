import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FolderKanban,
  Building2,
  Sparkles,
  FileCode2,
  ArrowRight,
  Plus,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
} from "lucide-react";

type ProjectScope =
  | { organizationId: string }
  | { organizationId: null; createdById: string };

async function getDashboardData(userId: string, activeOrganizationId: string | null) {
  // Projects visible in the current workspace: org projects, or the user's
  // personal projects when no org is active.
  const projectScope = activeOrganizationId
    ? { organizationId: activeOrganizationId }
    : { organizationId: null, createdById: userId };

  const [projectCount, generationCount, fileCount, memberships, recentProjects, recentRuns] =
    await Promise.all([
      prisma.project.count({ where: projectScope }),
      prisma.generationRun.count({ where: { project: projectScope } }),
      prisma.generatedFile.count({ where: { run: { project: projectScope } } }),
      prisma.member.findMany({
        where: { userId },
        include: { organization: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.project.findMany({
        where: projectScope,
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          organization: { select: { name: true } },
          _count: { select: { generationRuns: true } },
        },
      }),
      prisma.generationRun.findMany({
        where: { project: projectScope },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          status: true,
          createdAt: true,
          projectId: true,
          project: { select: { name: true } },
        },
      }),
    ]);

  return {
    projectCount,
    generationCount,
    fileCount,
    organizationCount: memberships.length,
    memberships,
    recentProjects,
    recentRuns,
  };
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  href,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="transition-colors hover:bg-muted/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function runStatusIcon(status: string) {
  if (status === "completed")
    return <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />;
  if (status === "failed")
    return <XCircle className="h-4 w-4 text-red-600 shrink-0" />;
  if (status === "running" || status === "pending")
    return <Loader2 className="h-4 w-4 text-amber-600 animate-spin shrink-0" />;
  return <Circle className="h-4 w-4 text-slate-300 shrink-0" />;
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    generating: "bg-amber-50 text-amber-700",
    ready: "bg-emerald-50 text-emerald-700",
    error: "bg-red-50 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        styles[status] || styles.draft
      }`}
    >
      {status}
    </span>
  );
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return null; // Layout already redirects
  }

  const activeOrganizationId =
    (session.session as { activeOrganizationId?: string | null } | null)
      ?.activeOrganizationId ?? null;

  const data = await getDashboardData(session.user.id, activeOrganizationId);
  const activeOrg = data.memberships.find(
    (m) => m.organizationId === activeOrganizationId
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {activeOrg ? activeOrg.organization.name : "Personal workspace"}
          </h1>
          <p className="text-muted-foreground">
            Welcome back, {session.user.name || "Creator"} — here&apos;s what&apos;s
            happening.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/projects/new">
            <Plus className="mr-1.5 h-4 w-4" />
            New project
          </Link>
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          title="Projects"
          value={data.projectCount}
          description="In this workspace"
          icon={FolderKanban}
          href="/dashboard/projects"
        />
        <MetricCard
          title="Generations"
          value={data.generationCount}
          description="AI runs started"
          icon={Sparkles}
          href="/dashboard/projects"
        />
        <MetricCard
          title="Files generated"
          value={data.fileCount}
          description="Across all runs"
          icon={FileCode2}
          href="/dashboard/projects"
        />
        <MetricCard
          title="Organizations"
          value={data.organizationCount}
          description="Workspaces you belong to"
          icon={Building2}
          href="/dashboard/organizations"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent projects</CardTitle>
              <CardDescription>Your most recently updated projects</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/projects">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FolderKanban className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No projects yet. Describe an app and let the agents build it.
                </p>
                <Button className="mt-4" size="sm" asChild>
                  <Link href="/dashboard/projects/new">
                    <Plus className="mr-1.5 h-4 w-4" />
                    New project
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="space-y-2">
                {data.recentProjects.map((project) => (
                  <li key={project.id}>
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 hover:bg-muted/50 transition"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{project.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {project._count.generationRuns} generation
                          {project._count.generationRuns === 1 ? "" : "s"} ·{" "}
                          {new Date(project.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      {statusBadge(project.status)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest AI generation runs</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentRuns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Sparkles className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No generations yet. Open a project and start your first run.
                </p>
              </div>
            ) : (
              <ul className="space-y-1">
                {data.recentRuns.map((run) => (
                  <li key={run.id}>
                    <Link
                      href={`/dashboard/projects/${run.projectId}`}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition"
                    >
                      {runStatusIcon(run.status)}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {run.project.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Generation {run.status} ·{" "}
                          {new Date(run.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Organizations snapshot */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Your organizations</CardTitle>
            <CardDescription>Workspaces you belong to</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/organizations">
              Manage
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {data.memberships.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Building2 className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                You have not joined or created any organizations yet.
              </p>
              <Button className="mt-4" size="sm" asChild>
                <Link href="/dashboard/organizations">Create organization</Link>
              </Button>
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.memberships.map((membership) => (
                <li key={membership.id}>
                  <Link
                    href={`/dashboard/organizations/${membership.organizationId}`}
                    className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 hover:bg-muted/50 transition"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {membership.organization.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        /{membership.organization.slug}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize shrink-0">
                      {membership.role}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
