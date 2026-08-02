import { requireSession } from "@/lib/session";
import Link from "next/link";
import { OrgSwitcher } from "@/components/organizations/org-switcher";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, activeOrganizationId } = await requireSession();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="font-bold tracking-tight">
              AppFoundry
            </Link>
            <nav className="hidden sm:flex items-center gap-5 text-sm">
              <Link
                href="/dashboard"
                className="text-slate-600 hover:text-black transition"
              >
                Projects
              </Link>
              <Link
                href="/dashboard/organizations"
                className="text-slate-600 hover:text-black transition"
              >
                Organizations
              </Link>
              <Link
                href="/dashboard/settings"
                className="text-slate-600 hover:text-black transition"
              >
                Settings
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <OrgSwitcher activeOrganizationId={activeOrganizationId} />
            <div className="text-sm text-slate-600 hidden sm:block">
              {user.name || user.email}
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
