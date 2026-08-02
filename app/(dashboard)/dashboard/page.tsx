import Link from "next/link";

export default function DashboardPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-slate-600 mt-1">
            Create and manage your AI-built applications.
          </p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition"
        >
          New project
        </Link>
      </div>

      <div className="border border-dashed rounded-2xl p-16 text-center bg-white">
        <h2 className="text-lg font-medium text-slate-900">No projects yet</h2>
        <p className="mt-2 text-slate-600 max-w-sm mx-auto">
          Describe what you want to build and AppFoundry will generate a full-stack app for you.
        </p>
        <Link
          href="/dashboard/projects/new"
          className="inline-block mt-6 bg-black text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition"
        >
          Create your first project
        </Link>
      </div>
    </div>
  );
}
