import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold tracking-tight text-slate-200">404</p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          Page not found
        </h1>
        <p className="mt-2 text-slate-600">
          The page you&apos;re looking for doesn&apos;t exist or was moved.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto bg-black text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition text-center"
          >
            Go to dashboard
          </Link>
          <Link
            href="/"
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-medium border hover:bg-white transition text-center"
          >
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
