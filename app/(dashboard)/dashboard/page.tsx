import Link from "next/link";
import { listProjects } from "@/lib/projects";
import { requireSession } from "@/lib/session";

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
  const { activeOrganizationId } = await requireSession();
  const projects = await listProjects();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-slate-600 mt-1">
            {activeOrganizationId
              ? "Projects in the current organization."
              : "Your personal projects."}
          </p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition"
        >
          New project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="border border-dashed rounded-2xl p-16 text-center bg-white">
          <h2 className="text-lg font-medium text-slate-900">No projects yet</h2>
          <p className="mt-2 text-slate-600 max-w-sm mx-auto">
            Describe what you want to build and AppFoundry will generate a
            full-stack app for you.
          </p>
          <Link
            href="/dashboard/projects/new"
            className="inline-block mt-6 bg-black text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition"
          >
            Create your first project
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="block bg-white border rounded-2xl p-5 hover:border-slate-300 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900 truncate">
                  {project.name}
                </h3>
                {statusBadge(project.status)}
              </div>
              {project.description && (
                <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                  {project.description}
                </p>
              )}
              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <span>{project.slug}</span>
                <span>
                  {new Date(project.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
