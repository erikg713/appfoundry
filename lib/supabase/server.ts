// lib/supabase/server.ts

import "server-only";

import {
  createServerClient,
} from "@supabase/ssr";

import type {
  SupabaseClient,
  Session,
  User,
} from "@supabase/supabase-js";

import type {
  Database,
} from "@/lib/supabase/database.types";

import {
  cookies,
} from "next/headers";

/**
 * ============================================================================
 * Environment
 * ============================================================================
 */

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * ============================================================================
 * Configuration validation
 * ============================================================================
 */

function getSupabaseConfig(): {
  url: string;
  key: string;
} {
  if (!SUPABASE_URL) {
    throw new Error(
      [
        "Missing Supabase configuration.",
        "",
        "Required environment variable:",
        "NEXT_PUBLIC_SUPABASE_URL",
        "",
        "Add it to .env.local and restart Next.js.",
      ].join("\n"),
    );
  }

  if (!SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      [
        "Missing Supabase publishable key.",
        "",
        "Required:",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        "",
        "Legacy projects may use:",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "",
        "Add it to .env.local and restart Next.js.",
      ].join("\n"),
    );
  }

  try {
    new URL(SUPABASE_URL);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not a valid URL.",
    );
  }

  return {
    url: SUPABASE_URL,
    key: SUPABASE_PUBLISHABLE_KEY,
  };
}

/**
 * ============================================================================
 * Server Supabase client
 * ============================================================================
 *
 * Creates a cookie-aware Supabase client for:
 *
 * - Server Components
 * - Server Actions
 * - Route Handlers
 * - Server-side authentication checks
 * - Database queries protected by RLS
 *
 * IMPORTANT:
 *
 * This is NOT an admin client.
 *
 * It uses the user's authenticated session and therefore respects
 * Supabase Row Level Security.
 */
export async function createClient(): Promise<
  SupabaseClient<Database>
> {
  const {
    url,
    key,
  } = getSupabaseConfig();

  const cookieStore = await cookies();

  return createServerClient<Database>(
    url,
    key,
    {
      cookies: {
        /**
         * Read authentication cookies.
         */
        getAll() {
          return cookieStore.getAll();
        },

        /**
         * Write refreshed authentication cookies.
         *
         * Some Server Component contexts are read-only. In those
         * situations Next.js can throw when attempting to mutate
         * cookies. The Supabase SSR package can still read the
         * existing session; middleware/proxy should handle refresh.
         */
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                cookieStore.set(
                  name,
                  value,
                  options,
                );
              },
            );
          } catch {
            /**
             * Ignore cookie mutation errors in contexts where
             * Next.js does not permit response-cookie mutation.
             *
             * Session refresh should be handled by the
             * application's proxy/middleware layer.
             */
          }
        },
      },
    },
  );
}

/**
 * ============================================================================
 * Current session
 * ============================================================================
 *
 * Retrieves the session associated with the current request.
 *
 * Use this when you need session information, but remember:
 *
 * `getSession()` should not be treated as the strongest authorization
 * primitive. For security-sensitive authorization, prefer getUser().
 */
export async function getSession(): Promise<{
  session: Session | null;
  error: Error | null;
}> {
  try {
    const supabase = await createClient();

    const {
      data,
      error,
    } = await supabase.auth.getSession();

    if (error) {
      return {
        session: null,
        error,
      };
    }

    return {
      session: data.session ?? null,
      error: null,
    };
  } catch (cause) {
    return {
      session: null,
      error:
        cause instanceof Error
          ? cause
          : new Error(
              "Unable to retrieve the current session.",
            ),
    };
  }
}

/**
 * ============================================================================
 * Current user
 * ============================================================================
 *
 * Security-sensitive server-side user lookup.
 *
 * This asks Supabase Auth for the authenticated user instead of simply
 * trusting locally stored session information.
 */
export async function getUser(): Promise<{
  user: User | null;
  error: Error | null;
}> {
  try {
    const supabase = await createClient();

    const {
      data,
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return {
        user: null,
        error,
      };
    }

    return {
      user: data.user ?? null,
      error: null,
    };
  } catch (cause) {
    return {
      user: null,
      error:
        cause instanceof Error
          ? cause
          : new Error(
              "Unable to retrieve the authenticated user.",
            ),
    };
  }
}

/**
 * ============================================================================
 * Require authenticated user
 * ============================================================================
 *
 * Useful inside Server Components, Server Actions, and Route Handlers.
 *
 * Example:
 *
 * const user = await requireUser();
 *
 * If no valid authenticated user exists, this throws.
 *
 * The caller can catch the error or allow its framework-level error
 * handling to process it.
 */
export async function requireUser(): Promise<User> {
  const {
    user,
    error,
  } = await getUser();

  if (error) {
    throw new Error(
      "Authentication verification failed.",
    );
  }

  if (!user) {
    throw new Error(
      "Authentication required.",
    );
  }

  return user;
}

/**
 * ============================================================================
 * Optional user helper
 * ============================================================================
 *
 * Returns null instead of throwing.
 */
export async function getOptionalUser(): Promise<User | null> {
  const {
    user,
  } = await getUser();

  return user;
}

/**
 * ============================================================================
 * Storage helper
 * ============================================================================
 */

export async function getStorageBucket(
  bucket: string,
) {
  if (!bucket?.trim()) {
    throw new Error(
      "A Supabase Storage bucket name is required.",
    );
  }

  const supabase = await createClient();

  return supabase.storage.from(bucket);
}

/**
 * ============================================================================
 * Realtime helper
 * ============================================================================
 */

export async function createRealtimeChannel(
  channelName: string,
) {
  if (!channelName?.trim()) {
    throw new Error(
      "A Supabase Realtime channel name is required.",
    );
  }

  const supabase = await createClient();

  return supabase.channel(channelName);
}

/**
 * ============================================================================
 * Default export
 * ============================================================================
 */

export default createClient;
