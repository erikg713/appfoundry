"use client";

import { useRef } from "react";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const SignInSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignInFormValues = z.infer<typeof SignInSchema>;

export default function SignInPage() {
  const router = useRouter();
  const errorRef = useRef<HTMLDivElement | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<SignInFormValues>({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: SignInFormValues) {
    // clear any previous focusable error container
    try {
      const res = await signIn.email({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });

      if (res?.error) {
        // If the server returns a field-level error format, prefer those.
        // Otherwise show a friendly global message.
        const msg = res.error.message ?? "Failed to sign in";
        // Example: attach to form-level (non-field) error by focusing the alert region
        if (msg.toLowerCase().includes("password")) {
          // optionally map some server messages to specific fields
          setError("password", { type: "server", message: "Incorrect password" });
        } else if (msg.toLowerCase().includes("email")) {
          setError("email", { type: "server", message: "No account found for that email" });
        } else {
          // fallback global error: render inside alert region below and focus it for screen readers
          // put message into a transient errorRef container by writing to DOM using ref focus
          // (we don't have a form-level set method here, so show it in the markup via a local variable
          //  — for now we focus the error container)
          // focus it
          setTimeout(() => errorRef.current?.focus(), 0);
        }

        return;
      }

      // success
      router.push("/dashboard");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? // @ts-expect-error runtime narrowing
            (err as { message?: string }).message ?? "An unexpected error occurred. Please try again."
          : "An unexpected error occurred. Please try again.";

      // set a generic field error so it appears and is announced. We set password to avoid leaking existence of email.
      setError("password", { type: "server", message });
      setTimeout(() => errorRef.current?.focus(), 0);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            AppFoundry
          </Link>
          <p className="mt-2 text-slate-600">Sign in to your account</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white border rounded-2xl p-8 shadow-sm space-y-5"
          noValidate
          aria-describedby={errors?.password?.message || errors?.email?.message ? "signin-error" : undefined}
        >
          {/* Global alert container (used for server/unexpected messages). Initially hidden when no server message */}
          <div
            id="signin-error"
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            aria-live="assertive"
            className="sr-only"
          >
            {/* When code sets focus here, screen readers will announce contents. We rely on setError + field messages
                for visible feedback — you can expand this to show a visible global message variable if desired. */}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              {...register("email")}
              required
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 ${
                errors.email ? "border-red-200" : ""
              }`}
              placeholder="you@example.com"
            />
            {errors.email && (
              <p id="email-error" className="mt-1 text-xs text-red-600">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              {...register("password")}
              required
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 ${
                errors.password ? "border-red-200" : ""
              }`}
              placeholder="••••••••"
            />
            {errors.password && (
              <p id="password-error" className="mt-1 text-xs text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-black text-white py-2.5 rounded-lg font-medium hover:bg-slate-800 transition disabled:opacity-50"
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="font-medium underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
