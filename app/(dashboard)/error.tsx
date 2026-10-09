"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="max-w-xl mx-auto py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-600">
        We hit an unexpected error loading this page. Your data is safe — try
        again or head back to the dashboard.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="w-full sm:w-auto bg-black text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-medium border bg-white hover:bg-slate-50 transition text-center"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
