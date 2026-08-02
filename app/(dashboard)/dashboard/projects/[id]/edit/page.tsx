"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getProject, updateProject } from "@/lib/projects";

export default function EditProjectPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("draft");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const project = await getProject(id);
      if (!project) {
        router.push("/dashboard");
        return;
      }
      setName(project.name);
      setDescription(project.description || "");
      setPrompt(project.prompt || "");
      setStatus(project.status);
      setLoading(false);
    }
    load();
  }, [id, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const result = await updateProject(id, {
      name,
      description: description || null,
      prompt: prompt || null,
      status: status as "draft" | "generating" | "ready" | "error",
    });

    if (result.error) {
      const msg =
        typeof result.error === "object"
          ? Object.values(result.error).flat().join(", ")
          : "Failed to update";
      setError(msg);
      setSaving(false);
      return;
    }

    router.push(`/dashboard/projects/${id}`);
    router.refresh();
  }

  if (loading) {
    return (
      <div className="text-sm text-slate-500 py-12 text-center">Loading...</div>
    );
  }

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <Link
          href={`/dashboard/projects/${id}`}
          className="text-sm text-slate-500 hover:text-black transition"
        >
          ← Back to project
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-3">Edit project</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border rounded-2xl p-6 space-y-5"
      >
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            maxLength={5000}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 resize-y"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10"
          >
            <option value="draft">draft</option>
            <option value="generating">generating</option>
            <option value="ready">ready</option>
            <option value="error">error</option>
          </select>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="bg-black text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          <Link
            href={`/dashboard/projects/${id}`}
            className="text-sm text-slate-600 hover:text-black px-3 py-2"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
