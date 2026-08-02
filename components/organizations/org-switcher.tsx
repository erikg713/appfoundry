"use client";

import { useEffect, useState } from "react";
import { organization } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

type Org = {
  id: string;
  name: string;
  slug: string;
};

export function OrgSwitcher({
  activeOrganizationId,
}: {
  activeOrganizationId: string | null;
}) {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await organization.list();
      setOrgs((data as Org[]) || []);
    }
    load();
  }, []);

  const activeOrg = orgs.find((o) => o.id === activeOrganizationId);

  async function switchTo(orgId: string | null) {
    setLoading(true);
    try {
      if (orgId) {
        await organization.setActive({ organizationId: orgId });
      } else {
        // Switch to personal workspace (clear active org)
        await organization.setActive({ organizationId: null as any });
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      console.error("Failed to switch organization", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className="flex items-center gap-2 text-sm border rounded-lg px-3 py-1.5 hover:bg-slate-50 transition disabled:opacity-50"
      >
        <span className="max-w-[140px] truncate">
          {activeOrg ? activeOrg.name : "Personal"}
        </span>
        <svg
          className="w-3.5 h-3.5 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-1.5 w-56 bg-white border rounded-xl shadow-lg z-50 py-1">
            <button
              type="button"
              onClick={() => switchTo(null)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${
                !activeOrganizationId ? "bg-slate-50 font-medium" : ""
              }`}
            >
              Personal workspace
            </button>
            {orgs.length > 0 && (
              <div className="border-t my-1" />
            )}
            {orgs.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => switchTo(org.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${
                  activeOrganizationId === org.id
                    ? "bg-slate-50 font-medium"
                    : ""
                }`}
              >
                {org.name}
              </button>
            ))}
            <div className="border-t my-1" />
            <a
              href="/dashboard/organizations"
              className="block px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Manage organizations →
            </a>
          </div>
        </>
      )}
    </div>
  );
}
