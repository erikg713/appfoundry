import { notFound } from "next/navigation";
import Link from "next/link";
import { getProject } from "@/lib/projects";
import { ProjectActions } from "./project-actions";

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

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-slate-500 hover:text-black transition"
        >
          ← Back to projects
        </Link>
      </div>

      <div className="bg-white border rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {project.name}
              </h1>
              {statusBadge(project.status)}
            </div>
            <p className="text-sm text-slate-500 mt-1">{project.slug}</p>
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

        <div className="mt-8 pt-6 border-t grid grid-cols-2 gap-4 text-sm">
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

        <div className="mt-8 p-4 border border-dashed rounded-xl bg-slate-50 text-center">
          <p className="text-sm text-slate-600">
            AI generation workspace coming next — this is where agents will
            plan, code, and deploy your app.
          </p>
        </div>
      </div>
    </div>
  );
}
