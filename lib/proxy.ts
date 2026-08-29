// lib/proxy.ts

import "server-only";

import {
  createServerClient,
} from "@supabase/ssr";

import type {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  NextResponse as NextResponseImpl,
} from "next/server";

/**
 * ============================================================================
 * Configuration
 * ============================================================================
 */

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Routes that require an authenticated user.
 */
const PROTECTED_ROUTES = [
  "/dashboard",
  "/settings",
  "/account",
  "/projects",
] as const;

/**
 * Routes that should redirect authenticated users away
 * from authentication pages.
 */
const AUTH_ROUTES = [
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
] as const;

/**
 * Public routes that are explicitly allowed through.
 *
 * Next.js static assets/API/etc. are excluded by the root
 * proxy matcher, so this list only concerns application routes.
 */
const PUBLIC_ROUTES = [
  "/",
  "/auth",
  "/auth/callback",
] as const;

/**
 * ============================================================================
 * Helpers
 * ============================================================================
 */

function isPathMatch(
  pathname: string,
  route: string,
): boolean {
  return (
    pathname === route ||
    pathname.startsWith(`${route}/`)
  );
}

function matchesAnyRoute(
  pathname: string,
  routes: readonly string[],
): boolean {
  return routes.some((route) =>
    isPathMatch(pathname, route),
  );
}

function validateEnvironment() {
  if (!SUPABASE_URL) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL.",
    );
  }

  if (!SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  try {
    new URL(SUPABASE_URL);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is invalid.",
    );
  }

  return {
    url: SUPABASE_URL,
    key: SUPABASE_PUBLISHABLE_KEY,
  };
}

/**
 * Preserve the URL the user originally requested.
 */
function buildLoginRedirect(
  request: NextRequest,
): URL {
  const loginUrl = new URL(
    "/auth/login",
    request.url,
  );

  const requestedPath =
    `${request.nextUrl.pathname}${request.nextUrl.search}`;

  loginUrl.searchParams.set(
    "redirectTo",
    requestedPath,
  );

  return loginUrl;
}

/**
 * ============================================================================
 * updateSession
 * ============================================================================
 *
 * This function:
 *
 * 1. Creates a Supabase SSR client.
 * 2. Reads the current auth cookies.
 * 3. Allows Supabase to refresh the session.
 * 4. Copies refreshed cookies onto the response.
 * 5. Determines whether the requested route requires authentication.
 * 6. Redirects unauthenticated users to login.
 * 7. Redirects authenticated users away from auth pages.
 *
 * IMPORTANT:
 *
 * Do not remove the getUser() call below and replace it with a
 * client-controlled authentication check.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  const {
    url,
    key,
  } = validateEnvironment();

  /**
   * Start with a response that forwards the request.
   */
  let response =
    NextResponseImpl.next({
      request,
    });

  const supabase =
    createServerClient(
      url,
      key,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(cookiesToSet) {
            /**
             * Update the request cookie state first.
             *
             * This ensures downstream server code can see the
             * refreshed authentication cookies during this request.
             */
            cookiesToSet.forEach(
              ({
                name,
                value,
              }) => {
                request.cookies.set(
                  name,
                  value,
                );
              },
            );

            /**
             * Recreate the response so it contains the same
             * request object with the updated cookies.
             */
            response =
              NextResponseImpl.next({
                request,
              });

            /**
             * Persist refreshed cookies on the outgoing response.
             */
            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                response.cookies.set(
                  name,
                  value,
                  options,
                );
              },
            );
          },
        },
      },
    );

  /**
   * IMPORTANT:
   *
   * Use getUser() for authorization decisions.
   *
   * Do not use getSession() as the sole security check here.
   */
  const {
    data: {
      user,
    },
    error,
  } = await supabase.auth.getUser();

  const pathname =
    request.nextUrl.pathname;

  const isProtectedRoute =
    matchesAnyRoute(
      pathname,
      PROTECTED_ROUTES,
    );

  const isAuthRoute =
    matchesAnyRoute(
      pathname,
      AUTH_ROUTES,
    );

  const isPublicRoute =
    matchesAnyRoute(
      pathname,
      PUBLIC_ROUTES,
    );

  /**
   * --------------------------------------------------------------------------
   * Authentication failure
   * --------------------------------------------------------------------------
   *
   * If Supabase cannot verify the user, treat the request as
   * unauthenticated for protected routes.
   */
  if (
    error &&
    isProtectedRoute
  ) {
    const loginUrl =
      buildLoginRedirect(request);

    const redirectResponse =
      NextResponseImpl.redirect(
        loginUrl,
      );

    /**
     * Preserve refreshed cookies when Supabase produced any.
     */
    response.cookies
      .getAll()
      .forEach((cookie) => {
        redirectResponse.cookies.set(
          cookie.name,
          cookie.value,
          cookie,
        );
      });

    return redirectResponse;
  }

  /**
   * --------------------------------------------------------------------------
   * Protected route
   * --------------------------------------------------------------------------
   */

  if (
    isProtectedRoute &&
    !user
  ) {
    return NextResponseImpl.redirect(
      buildLoginRedirect(request),
    );
  }

  /**
   * --------------------------------------------------------------------------
   * Auth pages
   * --------------------------------------------------------------------------
   *
   * Authenticated users generally shouldn't see login/signup pages.
   */
  if (
    isAuthRoute &&
    user
  ) {
    const dashboardUrl =
      new URL(
        "/dashboard",
        request.url,
      );

    return NextResponseImpl.redirect(
      dashboardUrl,
    );
  }

  /**
   * --------------------------------------------------------------------------
   * Public route
   * --------------------------------------------------------------------------
   */

  if (isPublicRoute) {
    return response;
  }

  /**
   * --------------------------------------------------------------------------
   * Default
   * --------------------------------------------------------------------------
   */

  return response;
}

/**
 * ============================================================================
 * Route configuration
 * ============================================================================
 *
 * Useful if your root proxy.ts wants to import the route definitions.
 */

export const authRoutes = {
  protected: PROTECTED_ROUTES,
  authentication: AUTH_ROUTES,
  public: PUBLIC_ROUTES,
} as const;

export default updateSession;
