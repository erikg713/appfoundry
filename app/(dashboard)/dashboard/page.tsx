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
  Users,
  Activity,
  ArrowRight,
} from "lucide-react";

async function getDashboardMetrics(userId: string) {
  const [projectCount, memberships, recentProjects] = await Promise.all([
    prisma.project.count({
      where: {
        organization: {
          members: {
            some: { userId },
          },
        },
      },
    }),
    prisma.member.findMany({
      where: { userId },
      include: {
        organization: true,
      },
    }),
    prisma.project.findMany({
      where: {
        organization: {
          members: {
            some: { userId },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        organization: {
          select: { name: true, slug: true },
        },
      },
    }),
  ]);

  const organizationCount = memberships.length;
  const ownedOrganizations = memberships.filter((m) => m.role === "owner").length;

  return {
    projectCount,
    organizationCount,
    ownedOrganizations,
    memberships,
    recentProjects,
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
  href?: string;
}) {
  const content = (
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
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return null; // Layout already redirects
  }

  const metrics = await getDashboardMetrics(session.user.id);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {session.user.name || "Creator"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/organizations">Manage Organizations</Link>
          </Button>
          <Button disabled>New Project</Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Projects"
          value={metrics.projectCount}
          description="Across all organizations"
          icon={FolderKanban}
          href="/projects"
        />
        <MetricCard
          title="Organizations"
          value={metrics.organizationCount}
          description={`${metrics.ownedOrganizations} owned by you`}
          icon={Building2}
          href="/organizations"
        />
        <MetricCard
          title="Team Members"
          value="—"
          description="Coming soon"
          icon={Users}
        />
        <MetricCard
          title="Activity"
          value="—"
          description="Last 7 days"
          icon={Activity}
        />
      </div>

      {/* Recent Projects & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Projects</CardTitle>
              <CardDescription>Your most recently updated projects</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/projects">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {metrics.recentProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FolderKanban className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No projects yet. Create your first project to get started.
                </p>
                <Button className="mt-4" size="sm" disabled>
                  New Project
                </Button>
              </div>
            ) : (
              <ul className="space-y-3">
                {metrics.recentProjects.map((project) => (
                  <li
                    key={project.id}
                    className="flex items-center justify-between rounded-lg border px-4 py-3"
                  >
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {project.organization.name} · {project.status}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Organizations Snapshot */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Your Organizations</CardTitle>
              <CardDescription>Workspaces you belong to</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/organizations">
                Manage
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {metrics.memberships.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Building2 className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  You have not joined or created any organizations yet.
                </p>
                <Button className="mt-4" size="sm" asChild>
                  <Link href="/organizations">Create Organization</Link>
                </Button>
              </div>
            ) : (
              <ul className="space-y-3">
                {metrics.memberships.map((membership) => (
                  <li
                    key={membership.id}
                    className="flex items-center justify-between rounded-lg border px-4 py-3"
                  >
                    <div>
                      <p className="font-medium">{membership.organization.name}</p>
                      <p className="text-sm text-muted-foreground">
                        /{membership.organization.slug}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize">
                      {membership.role}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Coming Soon Banner */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Coming soon</CardTitle>
          <CardDescription>
            AI-assisted project scaffolding, multi-agent code generation, deploy
            previews, and usage analytics will appear here as they ship.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
