"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { organization } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function CreateOrganizationForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const { data, error } = await organization.create({
      name: name.trim(),
      slug: slug.trim() || name.trim().toLowerCase().replace(/\s+/g, "-"),
    });
    setCreating(false);
    if (error) {
      setError(error.message || "Failed to create organization");
      return;
    }
    if (data) {
      setName("");
      setSlug("");
      router.push(`/dashboard/organizations/${data.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleCreate} className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      <div>
        <Label htmlFor="org-name" className="mb-1.5 block">
          Name
        </Label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          placeholder="Acme Agency"
        />
      </div>
      <div>
        <Label htmlFor="org-slug" className="mb-1.5 block">
          Slug
        </Label>
        <Input
          id="org-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          maxLength={80}
          placeholder="acme-agency"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Optional — generated from the name if left blank.
        </p>
      </div>
      <Button type="submit" disabled={creating || !name.trim()} className="w-full">
        {creating ? "Creating…" : "Create organization"}
      </Button>
    </form>
  );
}
