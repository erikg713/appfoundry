"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);

  // Basic client-side email check
  const isEmailValid = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const isFormValid = () =>
    name.trim().length > 0 && isEmailValid(email) && password.length >= 8;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setErrorMessage("");
    if (!isFormValid()) {
      // Focus first invalid field
      if (!name.trim()) {
        nameRef.current?.focus();
        setErrorMessage("Please enter your name.");
        return;
      }
      if (!isEmailValid(email)) {
        setErrorMessage("Please enter a valid email address.");
        return;
      }
      if (password.length < 8) {
        setErrorMessage("Password must be at least 8 characters.");
        return;
      }
    }

    setLoading(true);

    try {
      // Avoid shadowing `error` state by naming the response `res`
      const res = await signUp.email({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      if (res?.error) {
        setErrorMessage(res.error.message || "Failed to create account");
        // move focus to the error region for screen readers
        errorRef.current?.focus();
        return;
      }

      // Success: navigate to dashboard
      router.push("/dashboard");
    } catch (err: any) {
      // Network/unexpected errors
      setErrorMessage(
        err?.message ?? "An unexpected error occurred. Please try again."
      );
      errorRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            AppFoundry
          </Link>
          <p className="mt-2 text-slate-600">Create your account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border rounded-2xl p-8 shadow-sm space-y-5"
          noValidate
          aria-describedby={errorMessage ? "signup-error" : undefined}
        >
          {errorMessage && (
            <div
              id="signup-error"
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              aria-live="assertive"
              className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3"
            >
              {errorMessage}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1.5">
              Name
            </label>
            <input
              id="name"
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10"
              placeholder="Jane Doe"
              autoComplete="name"
              aria-invalid={!!errorMessage && name.trim() === ""}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10"
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={!!errorMessage && !isEmailValid(email)}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 pr-12"
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={!!errorMessage && password.length < 8}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-slate-600 px-2 py-1 rounded"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Minimum 8 characters.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !isFormValid()}
            className="w-full bg-black text-white py-2.5 rounded-lg font-medium hover:bg-slate-800 transition disabled:opacity-50"
            aria-busy={loading}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
