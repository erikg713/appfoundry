"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * AuthContext
 *
 * Provides authentication state to the client-side application.
 *
 * Exposed values:
 * - user
 * - session
 * - loading
 * - error
 * - isAuthenticated
 * - refresh
 * - signOut
 */
const AuthContext = createContext(undefined);

/**
 * AuthProvider
 *
 * Wrap your application/dashboard with this provider:
 *
 * <AuthProvider>
 *   {children}
 * </AuthProvider>
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [initialized, setInitialized] = useState(false);

  /**
   * Create one browser Supabase client for this provider.
   *
   * This client is responsible for:
   * - authentication
   * - session persistence
   * - auth event subscriptions
   */
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch (err) {
      console.error(
        "[AuthProvider] Failed to initialize Supabase client:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to initialize authentication.",
      );

      return null;
    }
  }, []);

  /**
   * Apply a Supabase session to React state.
   */
  const applySession = useCallback((nextSession) => {
    setSession(nextSession ?? null);
    setUser(nextSession?.user ?? null);
  }, []);

  /**
   * Fetch the current authenticated session.
   *
   * This is intentionally separate from the auth listener so
   * components can explicitly request a session refresh.
   */
  const refresh = useCallback(async () => {
    if (!supabase) {
      return {
        session: null,
        user: null,
        error: new Error(
          "Authentication client is unavailable.",
        ),
      };
    }

    try {
      setError(null);

      const {
        data,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const nextSession = data?.session ?? null;

      applySession(nextSession);

      return {
        session: nextSession,
        user: nextSession?.user ?? null,
        error: null,
      };
    } catch (err) {
      console.error(
        "[AuthProvider] Failed to refresh session:",
        err,
      );

      const authError =
        err instanceof Error
          ? err
          : new Error("Unable to refresh authentication.");

      setSession(null);
      setUser(null);
      setError(authError.message);

      return {
        session: null,
        user: null,
        error: authError,
      };
    }
  }, [supabase, applySession]);

  /**
   * Sign out the current user.
   */
  const signOut = useCallback(async () => {
    if (!supabase) {
      const authError = new Error(
        "Authentication client is unavailable.",
      );

      setError(authError.message);

      return {
        error: authError,
      };
    }

    try {
      setError(null);

      const { error: signOutError } =
        await supabase.auth.signOut();

      if (signOutError) {
        throw signOutError;
      }

      setSession(null);
      setUser(null);

      return {
        error: null,
      };
    } catch (err) {
      console.error(
        "[AuthProvider] Sign out failed:",
        err,
      );

      const authError =
        err instanceof Error
          ? err
          : new Error("Unable to sign out.");

      setError(authError.message);

      return {
        error: authError,
      };
    }
  }, [supabase]);

  /**
   * Initialize authentication state and subscribe to
   * Supabase auth events.
   */
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setInitialized(true);
      return undefined;
    }

    let mounted = true;

    async function initialize() {
      try {
        setLoading(true);
        setError(null);

        const {
          data,
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!mounted) {
          return;
        }

        if (sessionError) {
          throw sessionError;
        }

        const currentSession =
          data?.session ?? null;

        applySession(currentSession);

        setInitialized(true);
      } catch (err) {
        if (!mounted) {
          return;
        }

        console.error(
          "[AuthProvider] Initialization failed:",
          err,
        );

        setSession(null);
        setUser(null);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to initialize authentication.",
        );

        setInitialized(true);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void initialize();

    /**
     * Subscribe to authentication changes.
     *
     * Handles:
     * - SIGNED_IN
     * - SIGNED_OUT
     * - TOKEN_REFRESHED
     * - USER_UPDATED
     * - PASSWORD_RECOVERY
     */
    const {
      data: subscriptionData,
    } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!mounted) {
          return;
        }

        console.debug(
          `[AuthProvider] Auth event: ${event}`,
        );

        applySession(nextSession);

        /**
         * An auth event represents a successful state
         * transition, so clear stale errors.
         */
        if (
          event === "SIGNED_IN" ||
          event === "SIGNED_OUT" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED" ||
          event === "PASSWORD_RECOVERY"
        ) {
          setError(null);
        }

        setLoading(false);
        setInitialized(true);
      },
    );

    return () => {
      mounted = false;

      subscriptionData?.subscription?.unsubscribe();
    };
  }, [supabase, applySession]);

  /**
   * Memoize the context value so consumers do not
   * unnecessarily re-render because of object identity.
   */
  const value = useMemo(
    () => ({
      user,
      session,

      loading,
      error,

      initialized,

      isAuthenticated: Boolean(user && session),

      refresh,
      signOut,
    }),
    [
      user,
      session,
      loading,
      error,
      initialized,
      refresh,
      signOut,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth
 *
 * Access authentication state from any client component.
 *
 * Example:
 *
 * const {
 *   user,
 *   session,
 *   loading,
 *   isAuthenticated,
 * } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error(
      "useAuth must be used inside an <AuthProvider>.",
    );
  }

  return context;
}

/**
 * Optional convenience hook.
 *
 * Returns only the current authenticated user.
 */
export function useUser() {
  const { user, loading } = useAuth();

  return {
    user,
    loading,
  };
}

/**
 * Optional convenience hook.
 *
 * Useful for components that only care whether
 * authentication has completed.
 */
export function useIsAuthenticated() {
  const {
    isAuthenticated,
    loading,
    initialized,
  } = useAuth();

  return {
    isAuthenticated,
    loading,
    initialized,
  };
}

/**
 * Optional convenience hook.
 *
 * Provides session information without exposing
 * the rest of the auth context.
 */
export function useSession() {
  const {
    session,
    loading,
    error,
    refresh,
  } = useAuth();

  return {
    session,
    loading,
    error,
    refresh,
  };
    }
