"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteProject } from "@/lib/projects";
import Link from "next/link";

export function ProjectActions({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function handleDelete() {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setDeleting(true);
    const result = await deleteProject(projectId);
    if (result.success) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setDeleting(false);
      setConfirm(false);
      alert(result.error || "Failed to delete");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/dashboard/projects/${projectId}/edit`}
        className="text-sm border px-3 py-1.5 rounded-lg hover:bg-slate-50 transition"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className={`text-sm px-3 py-1.5 rounded-lg transition disabled:opacity-50 ${
          confirm
            ? "bg-red-600 text-white hover:bg-red-700"
            : "border text-red-600 hover:bg-red-50"
        }`}
      >
        {deleting ? "Deleting..." : confirm ? "Confirm delete" : "Delete"}
      </button>
      {confirm && !deleting && (
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="text-sm text-slate-500 hover:text-black"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
