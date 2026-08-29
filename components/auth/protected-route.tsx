// components/auth/protected-route.tsx

"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import { Button } from "@/components/ui/button";
import { AuthError } from "@/components/auth/auth-error";

/**
 * ============================================================================
 * Types
 * ============================================================================
 */

type ProtectedRouteProps = {
  children: React.ReactNode;

  /**
   * Destination for unauthenticated users.
   *
   * Defaults to /auth/login.
   */
  loginPath?: string;

  /**
   * Optional loading UI.
   */
  loadingFallback?: React.ReactNode;

  /**
   * Optional fallback shown if authentication initialization fails.
   */
  errorFallback?: React.ReactNode;

  /**
   * Optional custom unauthorized UI.
   */
  unauthorizedFallback?: React.ReactNode;

  /**
   * If true, redirect users even when the auth provider reports
   * an authentication initialization error.
   *
   * Defaults to false so infrastructure errors aren't silently
   * converted into authentication failures.
   */
  redirectOnAuthError?: boolean;

  /**
   * Optional callback before redirecting.
   */
  onUnauthorized?: () => void;

  /**
   * Optional callback when an authentication error occurs.
   */
  onAuthError?: (error: string) => void;

  className?: string;
};

/**
 * ============================================================================
 * Utilities
 * ============================================================================
 */

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Build a safe login redirect.
 *
 * Only the current pathname/query is stored. The destination itself
 * remains same-origin because it is later consumed as a relative
 * application path.
 */
function buildLoginUrl(
  loginPath: string,
  pathname: string,
): string {
  const separator =
    loginPath.includes("?")
      ? "&"
      : "?";

  return `${loginPath}${separator}redirectTo=${encodeURIComponent(
    pathname,
  )}`;
}

/**
 * ============================================================================
 * Default Loading UI
 * ============================================================================
 */

function DefaultLoadingFallback() {
  return (
    <div
      className="flex min-h-[240px] w-full items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="Checking authentication"
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2
          aria-hidden="true"
          className="h-6 w-6 animate-spin text-primary"
        />

        <p className="text-sm text-muted-foreground">
          Checking your session...
        </p>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * Default Authentication Error UI
 * ============================================================================
 */

function DefaultErrorFallback({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[320px] w-full max-w-md items-center justify-center p-6">
      <div className="w-full space-y-5">
        <AuthError
          title="Authentication unavailable"
          message={message}
          severity="error"
        />

        <Button
          type="button"
          className="w-full"
          onClick={onRetry}
        >
          Try again
        </Button>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * Default Unauthorized UI
 * ============================================================================
 */

function DefaultUnauthorizedFallback({
  onLogin,
}: {
  onLogin: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[320px] w-full max-w-md items-center justify-center p-6">
      <div className="w-full space-y-5 text-center">
        <div
          aria-hidden="true"
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted"
        >
          <ShieldAlert className="h-6 w-6 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">
            Authentication required
          </h2>

          <p className="text-sm leading-6 text-muted-foreground">
            Please sign in to continue.
          </p>
        </div>

        <Button
          type="button"
          className="w-full"
          onClick={onLogin}
        >
          Sign in
        </Button>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * ProtectedRoute
 * ============================================================================
 *
 * Client-side protection layer.
 *
 * Flow:
 *
 * loading
 *    │
 *    ▼
 * wait for AuthProvider
 *    │
 *    ├── auth error ──────► error UI
 *    │
 *    ├── no user ─────────► /auth/login
 *    │
 *    └── user ────────────► children
 *
 * IMPORTANT:
 *
 * This component is UX protection, not the final security boundary.
 *
 * Server-side protection should still be enforced by:
 *
 * proxy.ts
 *     ↓
 * lib/supabase/server.ts
 *     ↓
 * Supabase RLS
 */
export function ProtectedRoute({
  children,
  loginPath = "/auth/login",
  loadingFallback,
  errorFallback,
  unauthorizedFallback,
  redirectOnAuthError = false,
  onUnauthorized,
  onAuthError,
  className,
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();

  const {
    user,
    loading,
    error,
    initialized,
    isAuthenticated,
    refresh,
  } = useAuth();

  const redirectStarted =
    React.useRef(false);

  /**
   * Prevent redirects while the provider is still
   * determining the initial session.
   */
  React.useEffect(() => {
    if (!initialized || loading) {
      return;
    }

    if (
      error &&
      !redirectOnAuthError
    ) {
      onAuthError?.(error);
      return;
    }

    if (
      isAuthenticated &&
      user
    ) {
      return;
    }

    if (redirectStarted.current) {
      return;
    }

    redirectStarted.current = true;

    onUnauthorized?.();

    const currentPath =
      pathname || "/dashboard";

    const loginUrl =
      buildLoginUrl(
        loginPath,
        currentPath,
      );

    router.replace(loginUrl);
  }, [
    initialized,
    loading,
    error,
    redirectOnAuthError,
    isAuthenticated,
    user,
    pathname,
    loginPath,
    router,
    onUnauthorized,
    onAuthError,
  ]);

  /**
   * Reset redirect lock if authentication becomes valid again.
   *
   * This matters when a user signs in without a full page reload.
   */
  React.useEffect(() => {
    if (
      initialized &&
      isAuthenticated &&
      user
    ) {
      redirectStarted.current = false;
    }
  }, [
    initialized,
    isAuthenticated,
    user,
  ]);

  /**
   * --------------------------------------------------------------------------
   * Loading
   * --------------------------------------------------------------------------
   */

  if (
    loading ||
    !initialized
  ) {
    return (
      loadingFallback ?? (
        <DefaultLoadingFallback />
      )
    );
  }

  /**
   * --------------------------------------------------------------------------
   * Auth provider error
   * --------------------------------------------------------------------------
   */

  if (
    error &&
    !redirectOnAuthError
  ) {
    if (errorFallback) {
      return (
        <div
          className={cn(
            "w-full",
            className,
          )}
        >
          {errorFallback}
        </div>
      );
    }

    return (
      <div
        className={cn(
          "w-full",
          className,
        )}
      >
        <DefaultErrorFallback
          message={error}
          onRetry={() => {
            redirectStarted.current =
              false;

            void refresh();
          }}
        />
      </div>
    );
  }

  /**
   * --------------------------------------------------------------------------
   * Unauthorized
   * --------------------------------------------------------------------------
   *
   * The redirect effect above handles navigation.
   *
   * While Next.js processes router.replace(), don't render the
   * protected content.
   */
  if (
    !isAuthenticated ||
    !user
  ) {
    if (unauthorizedFallback) {
      return (
        <div
          className={cn(
            "w-full",
            className,
          )}
        >
          {unauthorizedFallback}
        </div>
      );
    }

    return (
      <div
        className={cn(
          "w-full",
          className,
        )}
      >
        <DefaultUnauthorizedFallback
          onLogin={() => {
            redirectStarted.current =
              false;

            const currentPath =
              pathname ||
              "/dashboard";

            router.replace(
              buildLoginUrl(
                loginPath,
                currentPath,
              ),
            );
          }}
        />
      </div>
    );
  }

  /**
   * --------------------------------------------------------------------------
   * Authorized
   * --------------------------------------------------------------------------
   */

  return (
    <div
      className={cn(
        "w-full",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * ============================================================================
 * RequireAuth
 * ============================================================================
 *
 * Alias for applications that prefer semantic naming.
 */
export const RequireAuth =
  ProtectedRoute;

export default ProtectedRoute;
