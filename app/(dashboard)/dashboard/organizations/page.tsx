"use client";

import { useEffect, useState } from "react";
import { organization } from "@/lib/auth-client";

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await organization.list();
      setOrgs(data || []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const { data, error } = await organization.create({
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, "-"),
    });
    if (!error && data) {
      setOrgs((prev) => [...prev, data]);
      setName("");
      setSlug("");
    }
    setCreating(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">Organizations</h1>
      <p className="text-slate-600 mb-8">
        Manage workspaces and team access.
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white border rounded-2xl p-6">
          <h2 className="font-semibold mb-4">Your organizations</h2>
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : orgs.length === 0 ? (
            <p className="text-sm text-slate-500">No organizations yet.</p>
          ) : (
            <ul className="space-y-3">
              {orgs.map((org) => (
                <li
                  key={org.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <div className="font-medium">{org.name}</div>
                    <div className="text-xs text-slate-500">{org.slug}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border rounded-2xl p-6">
          <h2 className="font-semibold mb-4">Create organization</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Acme Agency"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Slug</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="acme-agency"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="w-full bg-black text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
