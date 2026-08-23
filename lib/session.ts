import { cookies } from "next/headers";
import { cache } from "react";
import {
  prisma,
  validateServerToken,
  validateSessionCookie,
  getHardenedCookieOpts,
} from "@/lib/db";
import { redirect } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// AppFoundry Pi — Hardened Session Management
// ─────────────────────────────────────────────────────────────────────────────
//  • requireSession: validates session cookie + token, with bounded retries
//  • Token signature verification via lib/db.ts validateServerToken
//  • Session cookie security flag validation
//  • Sliding-window expiration refresh
//  • Graceful redirect on auth failure
// ─────────────────────────────────────────────────────────────────────────────

// ─── Configuration ───────────────────────────────────────────────────────────

const SESSION_CONFIG = {
  cookieName: "appfoundry.session",
  maxAgeSec: 60 * 60 * 24 * 7, // 7 days
  clockToleranceSec: 60,
  maxRetries: 3,
  baseDelayMs: 200,
  maxDelayMs: 3_000,
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

type SessionResult =
  | {
      ok: true;
      userId: string;
      activeOrganizationId: string | null;
      email: string | null;
      sessionToken: string;
    }
  | {
      ok: false;
      reason:
        | "no-cookie"
        | "invalid-token"
        | "session-expired"
        | "db-error"
        | "ip-mismatch";
      redirectTo: string;
    };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function jitteredDelay(attempt: number): number {
  const exp = Math.min(attempt, 5);
  const base = SESSION_CONFIG.baseDelayMs * 2 ** exp;
  const capped = Math.min(base, SESSION_CONFIG.maxDelayMs);
  const jitter = Math.random() * 0.25 * capped;
  return Math.floor(capped + jitter);
}

// ─── Cookie Parser ───────────────────────────────────────────────────────────

function getSessionCookie(): string | undefined {
  const store = cookies();
  return store.get(SESSION_CONFIG.cookieName)?.value;
}

// ─── Core Session Validation (with bounded retries) ──────────────────────────

async function resolveSession(): Promise<SessionResult> {
  const token = getSessionCookie();
  if (!token) {
    return { ok: false, reason: "no-cookie", redirectTo: "/login" };
  }

  // 1. Token structural + signature validation
  const secret = process.env.AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET or BETTER_AUTH_SECRET is not configured");
  }

  const tokenCheck = await validateServerToken(token, {
    secret,
    issuer: process.env.NEXT_PUBLIC_AUTH_URL,
    clockToleranceSec: SESSION_CONFIG.clockToleranceSec,
  });
  if (!tokenCheck.valid) {
    return {
      ok: false,
      reason: "invalid-token",
      redirectTo: "/login?error=invalid_session",
    };
  }

  // 2. Session cookie DB validation with bounded retries
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= SESSION_CONFIG.maxRetries; attempt++) {
    if (attempt > 0) {
      await sleep(jitteredDelay(attempt));
    }

    try {
      const sessionCheck = await validateSessionCookie(token, {
        maxAgeSec: SESSION_CONFIG.maxAgeSec,
        // Optional: enable IP binding in production
        // requireIpMatch: true,
        // requestIp: headers().get("x-forwarded-for") ?? undefined,
      });

      if (!sessionCheck.valid) {
        return {
          ok: false,
          reason: sessionCheck.error?.includes("expired")
            ? "session-expired"
            : "invalid-token",
          redirectTo: "/login?error=session_expired",
        };
      }

      const user = await prisma.user.findUnique({
        where: { id: sessionCheck.session!.userId },
        select: { id: true, email: true, activeOrganizationId: true },
      });

      if (!user) {
        return {
          ok: false,
          reason: "invalid-token",
          redirectTo: "/login?error=user_not_found",
        };
      }

      return {
        ok: true,
        userId: user.id,
        activeOrganizationId: user.activeOrganizationId,
        email: user.email,
        sessionToken: token,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isLastAttempt = attempt === SESSION_CONFIG.maxRetries;
      if (isLastAttempt) {
        return {
          ok: false,
          reason: "db-error",
          redirectTo: "/login?error=db_unavailable",
        };
      }
    }
  }

  // Unreachable
  return {
    ok: false,
    reason: "db-error",
    redirectTo: "/login?error=db_unavailable",
  };
}

// ─── Cached Session Resolver ─────────────────────────────────────────────────
// cache() ensures we only resolve once per request, even if called multiple times.

export const getSession = cache(resolveSession);

// ─── requireSession: throws on failure (for Server Actions / API routes) ─────

export async function requireSession() {
  const session = await getSession();
  if (!session.ok) {
    redirect(session.redirectTo);
  }
  return {
    userId: session.userId,
    activeOrganizationId: session.activeOrganizationId,
    email: session.email,
    sessionToken: session.sessionToken,
  };
}

// ─── optionalSession: returns null on failure (for public pages) ─────────────

export async function optionalSession() {
  const session = await getSession();
  if (!session.ok) return null;
  return {
    userId: session.userId,
    activeOrganizationId: session.activeOrganizationId,
    email: session.email,
    sessionToken: session.sessionToken,
  };
}

// ─── Session Refresh (sliding window) ────────────────────────────────────────

export async function refreshSession() {
  const session = await getSession();
  if (!session.ok) return { ok: false as const, reason: session.reason };

  const secret = process.env.AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET!;
  const tokenCheck = await validateServerToken(session.sessionToken, { secret });
  if (!tokenCheck.valid || !tokenCheck.payload) {
    return { ok: false as const, reason: "invalid-token" as const };
  }

  // Re-issue cookie with fresh maxAge
  const cookieOpts = getHardenedCookieOpts(SESSION_CONFIG.maxAgeSec);
  const store = cookies();
  store.set(cookieOpts.name, session.sessionToken, {
    ...cookieOpts.options,
    maxAge: SESSION_CONFIG.maxAgeSec,
  });

  return {
    ok: true as const,
    expiresAt: new Date(Date.now() + SESSION_CONFIG.maxAgeSec * 1000),
  };
}

// ─── Sign Out (hardened) ─────────────────────────────────────────────────────

export async function signOut() {
  const session = await getSession();
  if (session.ok) {
    // Delete session from DB
    await prisma.session.deleteMany({
      where: { sessionToken: session.sessionToken },
    });
  }

  const store = cookies();
  store.delete(SESSION_CONFIG.cookieName);
  redirect("/login");
}
