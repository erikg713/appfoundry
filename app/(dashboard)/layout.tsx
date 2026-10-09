import { requireSession } from "@/lib/session";
import { DashboardHeader } from "@/components/dashboard-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, activeOrganizationId } = await requireSession();

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardHeader
        userName={user.name}
        userEmail={user.email}
        activeOrganizationId={activeOrganizationId}
      />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
