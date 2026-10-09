"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FolderKanban, Plus, Search, Sparkles } from "lucide-react";

type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  status: string;
  organizationName: string | null;
  updatedAt: string;
  generationCount: number;
  latestRun: {
    status: string;
    createdAt: string;
    fileCount: number;
  } | null;
};

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

export function ProjectListClient({ projects }: { projects: ProjectSummary[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q)
    );
  }, [projects, query]);

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <FolderKanban className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-lg font-semibold">No projects yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create your first project, describe the app you want, and let the AI
            agents generate it for you.
          </p>
          <Button className="mt-6" asChild>
            <Link href="/dashboard/projects/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Create your first project
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects…"
          className="pl-9"
          aria-label="Search projects"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No projects match “{query}”.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="block"
            >
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-semibold truncate">{project.name}</h2>
                      <p className="text-xs text-muted-foreground truncate">
                        /{project.slug}
                        {project.organizationName
                          ? ` · ${project.organizationName}`
                          : ""}
                      </p>
                    </div>
                    {statusBadge(project.status)}
                  </div>

                  {project.description && (
                    <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" />
                      {project.generationCount} run
                      {project.generationCount === 1 ? "" : "s"}
                    </span>
                    {project.latestRun && (
                      <span>
                        Last: {project.latestRun.status} ·{" "}
                        {project.latestRun.fileCount} file
                        {project.latestRun.fileCount === 1 ? "" : "s"}
                      </span>
                    )}
                    <span className="ml-auto">
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
