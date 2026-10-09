import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ProjectListClient } from "./project-list-client";

export default async function ProjectsPage() {
  const { userId, activeOrganizationId } = await requireSession();

  const projectScope = activeOrganizationId
    ? { organizationId: activeOrganizationId }
    : { organizationId: null, createdById: userId };

  const projects = await prisma.project.findMany({
    where: projectScope,
    orderBy: { updatedAt: "desc" },
    include: {
      organization: { select: { name: true } },
      _count: { select: { generationRuns: true } },
      generationRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          createdAt: true,
          _count: { select: { files: true } },
        },
      },
    },
  });

  // Serialize for the client component
  const serialized = projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    slug: p.slug,
    status: p.status,
    organizationName: p.organization?.name ?? null,
    updatedAt: p.updatedAt.toISOString(),
    generationCount: p._count.generationRuns,
    latestRun: p.generationRuns[0]
      ? {
          status: p.generationRuns[0].status,
          createdAt: p.generationRuns[0].createdAt.toISOString(),
          fileCount: p.generationRuns[0]._count.files,
        }
      : null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            {projects.length} project{projects.length === 1 ? "" : "s"} in this
            workspace
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/projects/new">
            <Plus className="mr-1.5 h-4 w-4" />
            New project
          </Link>
        </Button>
      </div>

      <ProjectListClient projects={serialized} />
    </div>
  );
}
