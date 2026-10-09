import { notFound } from "next/navigation";
import Link from "next/link";
import { getProject } from "@/lib/projects";
import { getLatestRun, getGenerationRuns } from "@/lib/generation";
import { ProjectActions } from "./project-actions";
import { GenerationWorkspace } from "@/components/projects/generation-workspace";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sparkles,
  FileCode2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
} from "lucide-react";

// getProject asserts project access (lib/projects); run helpers live in
// lib/generation.ts alongside the run lifecycle.

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    generating: "bg-amber-50 text-amber-700",
    ready: "bg-emerald-50 text-emerald-700",
    error: "bg-red-50 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        styles[status] || styles.draft
      }`}
    >
      {status}
    </span>
  );
}

function runStatusIcon(status: string) {
  if (status === "completed")
    return <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />;
  if (status === "failed" || status === "error")
    return <XCircle className="h-4 w-4 text-red-600 shrink-0" />;
  if (status === "running" || status === "pending")
    return <Loader2 className="h-4 w-4 text-amber-600 animate-spin shrink-0" />;
  return <Circle className="h-4 w-4 text-slate-300 shrink-0" />;
}

function formatDuration(startedAt: Date | null, completedAt: Date | null) {
  if (!startedAt) return "—";
  const end = completedAt ?? new Date();
  const secs = Math.max(0, Math.round((end.getTime() - startedAt.getTime()) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  const [latestRun, runs] = await Promise.all([
    getLatestRun(id),
    getGenerationRuns(id),
  ]);

  const totalFiles = runs.reduce((sum, r) => sum + r.files.length, 0);

  const stats = [
    {
      label: "Generations",
      value: String(runs.length),
      icon: Sparkles,
    },
    {
      label: "Files generated",
      value: String(totalFiles),
      icon: FileCode2,
    },
    {
      label: "Last run",
      value: latestRun ? latestRun.status : "never",
      icon: Clock,
    },
  ];

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <Link
          href="/dashboard/projects"
          className="text-sm text-slate-500 hover:text-black transition"
        >
          ← Back to projects
        </Link>
      </div>

      <div className="bg-white border rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight break-words">
                {project.name}
              </h1>
              {statusBadge(project.status)}
            </div>
            <p className="text-sm text-slate-500 mt-1">/{project.slug}</p>
          </div>
          <ProjectActions projectId={project.id} />
        </div>

        {project.description && (
          <p className="mt-6 text-slate-700 leading-relaxed">
            {project.description}
          </p>
        )}

        {project.prompt && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-slate-500 mb-2">
              Original prompt
            </h2>
            <div className="bg-slate-50 border rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap">
              {project.prompt}
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border bg-slate-50/60 px-4 py-3"
            >
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <s.icon className="h-3.5 w-3.5" />
                {s.label}
              </div>
              <div className="mt-1 text-lg font-semibold capitalize">
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-slate-500">Created</div>
            <div className="font-medium mt-0.5">
              {new Date(project.createdAt).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Last updated</div>
            <div className="font-medium mt-0.5">
              {new Date(project.updatedAt).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Generation history */}
      {runs.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Generation history</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {runs.map((run) => (
                <li
                  key={run.id}
                  className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm"
                >
                  {runStatusIcon(run.status)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {run.prompt.length > 80
                        ? run.prompt.slice(0, 80) + "…"
                        : run.prompt}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {run.files.length} file{run.files.length === 1 ? "" : "s"} ·{" "}
                      {formatDuration(run.startedAt, run.completedAt)} ·{" "}
                      {new Date(run.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs font-medium capitalize text-muted-foreground shrink-0">
                    {run.status}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <GenerationWorkspace
        project={{
          id: project.id,
          name: project.name,
          prompt: project.prompt,
          status: project.status,
        }}
        initialRun={
          latestRun
            ? {
                id: latestRun.id,
                prompt: latestRun.prompt,
                status: latestRun.status,
                error: latestRun.error,
                startedAt: latestRun.startedAt,
                completedAt: latestRun.completedAt,
                steps: latestRun.steps,
                files: latestRun.files,
              }
            : null
        }
      />
    </div>
  );
}
