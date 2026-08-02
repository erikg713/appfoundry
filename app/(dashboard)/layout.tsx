import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="font-bold tracking-tight">
              AppFoundry
            </Link>
            <nav className="hidden sm:flex items-center gap-5 text-sm">
              <Link href="/dashboard" className="text-slate-600 hover:text-black">
                Projects
              </Link>
              <Link
                href="/dashboard/organizations"
                className="text-slate-600 hover:text-black"
              >
                Organizations
              </Link>
              <Link
                href="/dashboard/settings"
                className="text-slate-600 hover:text-black"
              >
                Settings
              </Link>
            </nav>
          </div>
          <div className="text-sm text-slate-600">
            {session.user.name || session.user.email}
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
