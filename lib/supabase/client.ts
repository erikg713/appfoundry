// lib/supabase/client.ts

import {
  createBrowserClient,
} from "@supabase/ssr";

import type {
  SupabaseClient,
  User,
  Session,
} from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

/**
 * --------------------------------------------------------------------------
 * Environment
 * --------------------------------------------------------------------------
 */

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * --------------------------------------------------------------------------
 * Browser client singleton
 * --------------------------------------------------------------------------
 *
 * Next.js Client Components can be rendered many times during the lifetime
 * of an application. Reusing the browser client prevents unnecessary
 * Supabase client instances and duplicate auth listeners.
 */

let supabaseBrowserClient:
  | SupabaseClient<Database>
  | undefined;

/**
 * Validate the public Supabase configuration.
 *
 * These variables are intentionally public.
 *
 * NEVER put:
 * - service role keys
 * - database passwords
 * - secret API keys
 *
 * in NEXT_PUBLIC_* variables.
 */
function validateConfiguration(): {
  url: string;
  key: string;
} {
  if (!SUPABASE_URL) {
    throw new Error(
      [
        "Missing Supabase configuration.",
        "",
        "Required:",
        "NEXT_PUBLIC_SUPABASE_URL",
        "",
        "Add it to .env.local and restart the Next.js server.",
      ].join("\n"),
    );
  }

  if (!SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      [
        "Missing Supabase public key.",
        "",
        "Required:",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        "",
        "Legacy projects may use:",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "",
        "Add the key to .env.local and restart the Next.js server.",
      ].join("\n"),
    );
  }

  /**
   * Basic URL validation catches common configuration mistakes
   * without making assumptions about Supabase's deployment model.
   */
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
 * --------------------------------------------------------------------------
 * createClient
 * --------------------------------------------------------------------------
 *
 * Main browser-side Supabase client factory.
 *
 * Usage:
 *
 * const supabase = createClient();
 *
 * const {
 *   data: { user },
 * } = await supabase.auth.getUser();
 */
export function createClient(): SupabaseClient<Database> {
  if (supabaseBrowserClient) {
    return supabaseBrowserClient;
  }

  const { url, key } = validateConfiguration();

  supabaseBrowserClient =
    createBrowserClient<Database>(
      url,
      key,
    );

  return supabaseBrowserClient;
}

/**
 * --------------------------------------------------------------------------
 * Auth helpers
 * --------------------------------------------------------------------------
 */

/**
 * Get the current client-side session.
 *
 * Note:
 * getSession() reads the locally persisted session.
 * For security-sensitive server authorization, use
 * server-side session verification instead.
 */
export async function getSession(): Promise<{
  session: Session | null;
  error: Error | null;
}> {
  try {
    const supabase = createClient();

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
 * Get the currently authenticated user.
 *
 * Supabase performs a server-backed user lookup rather than
 * simply trusting locally decoded session data.
 */
export async function getUser(): Promise<{
  user: User | null;
  error: Error | null;
}> {
  try {
    const supabase = createClient();

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
 * --------------------------------------------------------------------------
 * Auth state subscription
 * --------------------------------------------------------------------------
 *
 * Convenience wrapper around Supabase's auth listener.
 *
 * Usage:
 *
 * const unsubscribe = subscribeToAuthChanges(
 *   (event, session) => {
 *     console.log(event, session);
 *   },
 * );
 *
 * return unsubscribe;
 */
export function subscribeToAuthChanges(
  callback: (
    event: Parameters<
      Parameters<
        SupabaseClient<Database>["auth"]["onAuthStateChange"]
      >[0]
    >[0],
    session: Session | null,
  ) => void,
): () => void {
  const supabase = createClient();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(
    (event, session) => {
      callback(event, session);
    },
  );

  return () => {
    subscription.unsubscribe();
  };
}

/**
 * --------------------------------------------------------------------------
 * Storage helper
 * --------------------------------------------------------------------------
 */

export function getStorageBucket(
  bucket: string,
) {
  if (!bucket?.trim()) {
    throw new Error(
      "A Supabase Storage bucket name is required.",
    );
  }

  return createClient().storage.from(bucket);
}

/**
 * --------------------------------------------------------------------------
 * Realtime helper
 * --------------------------------------------------------------------------
 */

export function createRealtimeChannel(
  channelName: string,
) {
  if (!channelName?.trim()) {
    throw new Error(
      "A Supabase Realtime channel name is required.",
    );
  }

  return createClient().channel(channelName);
}

/**
 * --------------------------------------------------------------------------
 * Default export
 * --------------------------------------------------------------------------
 */

export default createClient;
