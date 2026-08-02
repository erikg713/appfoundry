"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createProject } from "@/lib/projects";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await createProject({
      name,
      description: description || undefined,
      prompt: prompt || undefined,
    });

    if (result.error) {
      const msg =
        typeof result.error === "object"
          ? Object.values(result.error).flat().join(", ")
          : "Failed to create project";
      setError(msg);
      setLoading(false);
      return;
    }

    if (result.data) {
      router.push(`/dashboard/projects/${result.data.id}`);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="text-sm text-slate-500 hover:text-black transition"
        >
          ← Back to projects
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-3">New project</h1>
        <p className="text-slate-600 mt-1">
          Create a project in the current workspace. You can describe the app
          you want to build.
        </p>
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
          <label className="block text-sm font-medium mb-1.5">
            Project name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10"
            placeholder="My SaaS Dashboard"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Short description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10"
            placeholder="Internal tool for managing customer feedback"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            What do you want to build?
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            maxLength={5000}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 resize-y"
            placeholder="A simple CRM with contacts, deals, and a pipeline board. Users should be able to invite teammates..."
          />
          <p className="mt-1.5 text-xs text-slate-500">
            This prompt will later drive the AI agents that generate your app.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="bg-black text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create project"}
          </button>
          <Link
            href="/dashboard"
            className="text-sm text-slate-600 hover:text-black px-3 py-2"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
