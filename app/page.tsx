import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-bold text-xl tracking-tight">AppFoundry</div>
          <nav className="flex items-center gap-6">
            <Link href="/sign-in" className="text-sm font-medium hover:underline">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="text-sm font-medium bg-black text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-24 pb-32">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-slate-900 leading-tight">
            Build apps with AI.
            <br />
            <span className="text-slate-500">Own them completely.</span>
          </h1>
          <p className="mt-6 text-lg text-slate-600 leading-relaxed">
            AppFoundry turns natural language into production-ready full-stack apps.
            Multi-tenant workspaces, real ownership, and tools to monetize what you ship.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-800 transition"
            >
              Start building free
            </Link>
            <Link
              href="#features"
              className="px-6 py-3 rounded-lg font-medium border border-slate-200 hover:bg-slate-50 transition"
            >
              See features
            </Link>
          </div>
        </div>

        <section id="features" className="mt-32 grid md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl border bg-white">
            <h3 className="font-semibold text-lg">True Ownership</h3>
            <p className="mt-2 text-slate-600 text-sm leading-relaxed">
              Full source export, clean architecture, and no lock-in. Your apps belong to you.
            </p>
          </div>
          <div className="p-6 rounded-2xl border bg-white">
            <h3 className="font-semibold text-lg">Multi-Tenant Workspaces</h3>
            <p className="mt-2 text-slate-600 text-sm leading-relaxed">
              Organizations, roles, invitations, and isolated projects powered by Better Auth.
            </p>
          </div>
          <div className="p-6 rounded-2xl border bg-white">
            <h3 className="font-semibold text-lg">Monetize What You Build</h3>
            <p className="mt-2 text-slate-600 text-sm leading-relaxed">
              Built-in payments, usage metering, and marketplace tools so you can earn from day one.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t py-10 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} AppFoundry. Built for builders who want ownership.
      </footer>
    </div>
  );
}
