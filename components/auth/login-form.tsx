// components/auth/login-form.tsx

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  EyeOff,
  Github,
  Loader2,
  LockKeyhole,
  LogIn,
  Mail,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { AuthError } from "@/components/auth/auth-error";
import { AuthDivider } from "@/components/auth/auth-divider";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * ============================================================================
 * Types
 * ============================================================================
 */

type LoginFormProps = {
  className?: string;

  /**
   * Optional default email.
   */
  defaultEmail?: string;

  /**
   * Optional callback after successful authentication.
   */
  onSuccess?: (user: unknown) => void;

  /**
   * Optional callback after authentication failure.
   */
  onError?: (error: Error) => void;

  /**
   * OAuth providers to display.
   */
  oauthProviders?: Array<"google" | "github">;

  /**
   * Default redirect after login.
   */
  redirectTo?: string;
};

type FieldErrors = {
  email?: string;
  password?: string;
};

/**
 * ============================================================================
 * Constants
 * ============================================================================
 */

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const OAUTH_LABELS = {
  google: "Google",
  github: "GitHub",
} as const;

/**
 * ============================================================================
 * Helpers
 * ============================================================================
 */

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
) {
  return classes.filter(Boolean).join(" ");
}

function normalizeEmail(
  value: string,
) {
  return value
    .trim()
    .toLowerCase();
}

function validateEmail(
  value: string,
) {
  if (!value) {
    return "Email address is required.";
  }

  if (!EMAIL_PATTERN.test(value)) {
    return "Enter a valid email address.";
  }

  return undefined;
}

function validatePassword(
  value: string,
) {
  if (!value) {
    return "Password is required.";
  }

  return undefined;
}

/**
 * Prevent an attacker-controlled redirect from turning
 * into an external URL.
 *
 * Allowed:
 *
 * /dashboard
 * /projects/123
 * /dashboard?tab=activity
 *
 * Rejected:
 *
 * https://evil.example
 * //evil.example
 */
function getSafeRedirect(
  requestedRedirect: string | null,
  fallback: string,
) {
  if (!requestedRedirect) {
    return fallback;
  }

  try {
    const url = new URL(
      requestedRedirect,
      window.location.origin,
    );

    if (
      url.origin !==
      window.location.origin
    ) {
      return fallback;
    }

    return (
      url.pathname +
      url.search +
      url.hash
    );
  } catch {
    return fallback;
  }
}

/**
 * ============================================================================
 * OAuth Button
 * ============================================================================
 */

function OAuthButton({
  provider,
  disabled,
  loading,
  onClick,
}: {
  provider: "google" | "github";
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={disabled}
      onClick={onClick}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : provider === "github" ? (
        <Github className="mr-2 h-4 w-4" />
      ) : (
        <svg
          aria-hidden="true"
          className="mr-2 h-4 w-4"
          viewBox="0 0 24 24"
        >
          <path
            fill="currentColor"
            d="M21.35 12.2c0-.72-.06-1.42-.18-2.1H12v3.98h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.27Z"
          />
          <path
            fill="currentColor"
            d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.93-3.31.93-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.75 9.75 0 0 0 12 21.5Z"
          />
          <path
            fill="currentColor"
            d="M6.54 13.59a5.87 5.87 0 0 1 0-3.18V7.88H3.3a9.75 9.75 0 0 0 0 8.24l3.24-2.53Z"
          />
          <path
            fill="currentColor"
            d="M12 6.38c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.43 14.63 2.5 12 2.5a9.75 9.75 0 0 0-8.7 5.38l3.24 2.53C7.31 8.1 9.46 6.38 12 6.38Z"
          />
        </svg>
      )}

      Continue with {OAUTH_LABELS[provider]}
    </Button>
  );
}

/**
 * ============================================================================
 * LoginForm
 * ============================================================================
 */

export function LoginForm({
  className,
  defaultEmail = "",
  onSuccess,
  onError,
  oauthProviders = ["google", "github"],
  redirectTo = "/dashboard",
}: LoginFormProps) {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const {
    isAuthenticated,
    loading: authLoading,
    refresh,
  } = useAuth();

  const emailRef =
    React.useRef<HTMLInputElement>(null);

  const passwordRef =
    React.useRef<HTMLInputElement>(null);

  const [email, setEmail] =
    React.useState(defaultEmail);

  const [password, setPassword] =
    React.useState("");

  const [showPassword, setShowPassword] =
    React.useState(false);

  const [fieldErrors, setFieldErrors] =
    React.useState<FieldErrors>({});

  const [error, setError] =
    React.useState<string | null>(null);

  const [submitting, setSubmitting] =
    React.useState(false);

  const [oauthLoading, setOauthLoading] =
    React.useState<
      "google" | "github" | null
    >(null);

  /**
   * If the user arrives with an existing session,
   * send them directly to the dashboard.
   */
  React.useEffect(() => {
    if (
      !authLoading &&
      isAuthenticated
    ) {
      const destination =
        getSafeRedirect(
          searchParams.get(
            "redirectTo",
          ),
          redirectTo,
        );

      router.replace(
        destination,
      );
    }
  }, [
    authLoading,
    isAuthenticated,
    redirectTo,
    router,
    searchParams,
  ]);

  /**
   * Auto-focus email.
   */
  React.useEffect(() => {
    emailRef.current?.focus();
  }, []);

  /**
   * Clear field-specific error when user edits.
   */
  function handleEmailChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    setEmail(event.target.value);

    if (fieldErrors.email) {
      setFieldErrors(
        (current) => ({
          ...current,
          email: undefined,
        }),
      );
    }

    if (error) {
      setError(null);
    }
  }

  function handlePasswordChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    setPassword(
      event.target.value,
    );

    if (fieldErrors.password) {
      setFieldErrors(
        (current) => ({
          ...current,
          password: undefined,
        }),
      );
    }

    if (error) {
      setError(null);
    }
  }

  /**
   * Validate the complete form.
   */
  function validateForm() {
    const normalizedEmail =
      normalizeEmail(email);

    const nextErrors: FieldErrors = {
      email:
        validateEmail(
          normalizedEmail,
        ),
      password:
        validatePassword(
          password,
        ),
    };

    setFieldErrors(
      nextErrors,
    );

    return {
      valid:
        !nextErrors.email &&
        !nextErrors.password,

      email:
        normalizedEmail,
    };
  }

  /**
   * Password login.
   */
  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError(null);

    const validation =
      validateForm();

    if (!validation.valid) {
      if (
        validation.valid ===
        false
      ) {
        if (
          validation.email &&
          fieldErrors.email
        ) {
          emailRef.current?.focus();
        } else {
          passwordRef.current?.focus();
        }
      }

      return;
    }

    setSubmitting(true);

    try {
      const supabase =
        createClient();

      const {
        data,
        error: signInError,
      } =
        await supabase.auth.signInWithPassword(
          {
            email:
              validation.email,
            password,
          },
        );

      if (signInError) {
        throw signInError;
      }

      if (!data.user) {
        throw new Error(
          "Authentication succeeded but no user was returned.",
        );
      }

      /**
       * Synchronize AuthProvider immediately instead of
       * waiting for a later render.
       */
      await refresh();

      onSuccess?.(
        data.user,
      );

      const destination =
        getSafeRedirect(
          searchParams.get(
            "redirectTo",
          ),
          redirectTo,
        );

      router.replace(
        destination,
      );

      router.refresh();
    } catch (cause) {
      const authError =
        cause instanceof Error
          ? cause
          : new Error(
              "Unable to sign in.",
            );

      console.error(
        "[LoginForm]",
        authError,
      );

      /**
       * Keep the UI generic rather than exposing
       * implementation-specific authentication details.
       */
      setError(
        "Unable to sign in with those credentials. Please check your email and password and try again.",
      );

      onError?.(
        authError,
      );
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * OAuth login.
   */
  async function handleOAuth(
    provider:
      | "google"
      | "github",
  ) {
    if (
      submitting ||
      oauthLoading
    ) {
      return;
    }

    setError(null);
    setOauthLoading(
      provider,
    );

    try {
      const supabase =
        createClient();

      const destination =
        getSafeRedirect(
          searchParams.get(
            "redirectTo",
          ),
          redirectTo,
        );

      const callbackUrl =
        new URL(
          "/auth/callback",
          window.location.origin,
        );

      callbackUrl.searchParams.set(
        "next",
        destination,
      );

      const {
        error: oauthError,
      } =
        await supabase.auth.signInWithOAuth(
          {
            provider,
            options: {
              redirectTo:
                callbackUrl.toString(),
            },
          },
        );

      if (oauthError) {
        throw oauthError;
      }

      /**
       * Supabase redirects the browser to the OAuth
       * provider. The loading state remains active while
       * navigation occurs.
       */
    } catch (cause) {
      const authError =
        cause instanceof Error
          ? cause
          : new Error(
              `Unable to continue with ${provider}.`,
            );

      console.error(
        "[LoginForm] OAuth error:",
        authError,
      );

      setError(
        `Unable to continue with ${OAUTH_LABELS[provider]}. Please try again.`,
      );

      onError?.(
        authError,
      );

      setOauthLoading(
        null,
      );
    }
  }

  const isBusy =
    submitting ||
    oauthLoading !== null;

  return (
    <div
      className={cn(
        "w-full space-y-6",
        className,
      )}
    >
      {/* OAuth */}
      {oauthProviders.length > 0 && (
        <>
          <div className="grid gap-3">
            {oauthProviders.map(
              (provider) => (
                <OAuthButton
                  key={provider}
                  provider={
                    provider
                  }
                  disabled={
                    isBusy
                  }
                  loading={
                    oauthLoading ===
                    provider
                  }
                  onClick={() =>
                    handleOAuth(
                      provider,
                    )
                  }
                />
              ),
            )}
          </div>

          <AuthDivider>
            <span>
              or continue with email
            </span>
          </AuthDivider>
        </>
      )}

      {/* Error */}
      {error && (
        <AuthError
          title="Sign in failed"
          message={error}
          autoFocus
        />
      )}

      {/* Form */}
      <form
        onSubmit={
          handleSubmit
        }
        noValidate
        aria-busy={isBusy}
        className="space-y-5"
      >
        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="login-email">
            Email address
          </Label>

          <div className="relative">
            <Mail
              aria-hidden="true"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />

            <Input
              ref={emailRef}
              id="login-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="you@example.com"
              value={email}
              onChange={
                handleEmailChange
              }
              disabled={isBusy}
              aria-invalid={
                Boolean(
                  fieldErrors.email,
                )
              }
              aria-describedby={
                fieldErrors.email
                  ? "login-email-error"
                  : undefined
              }
              className="pl-10"
              required
            />
          </div>

          {fieldErrors.email && (
            <p
              id="login-email-error"
              className="text-xs text-destructive"
            >
              {fieldErrors.email}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">
              Password
            </Label>

            <Link
              href="/auth/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <div className="relative">
            <LockKeyhole
              aria-hidden="true"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />

            <Input
              ref={passwordRef}
              id="login-password"
              name="password"
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={
                handlePasswordChange
              }
              disabled={isBusy}
              aria-invalid={
                Boolean(
                  fieldErrors.password,
                )
              }
              aria-describedby={
                fieldErrors.password
                  ? "login-password-error"
                  : undefined
              }
              className="pl-10 pr-10"
              required
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(
                  (current) =>
                    !current,
                )
              }
              disabled={isBusy}
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            >
              {showPassword ? (
                <EyeOff
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              ) : (
                <Eye
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              )}
            </button>
          </div>

          {fieldErrors.password && (
            <p
              id="login-password-error"
              className="text-xs text-destructive"
            >
              {fieldErrors.password}
            </p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full"
          disabled={isBusy}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              <LogIn className="mr-2 h-4 w-4" />
              Sign in
            </>
          )}
        </Button>
      </form>

      {/* Sign up */}
      <p className="text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Link
          href="/auth/signup"
          className="font-medium text-primary hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}

export default LoginForm;
