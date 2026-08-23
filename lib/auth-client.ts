import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

// ─────────────────────────────────────────────────────────────────────────────
// AppFoundry Pi — Hardened Authentication Client
// ─────────────────────────────────────────────────────────────────────────────
//  • Bounded retries with exponential backoff + jitter
//  • Per-request timeout handling via AbortController
//  • Explicit recovery states for observability & UX
//  • Server-side token validation & session-cookie hardening
// ─────────────────────────────────────────────────────────────────────────────

// ─── Configuration ───────────────────────────────────────────────────────────

const AUTH_BASE_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? "/api/auth";

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 300,
  maxDelayMs: 8_000,
  timeoutMs: 10_000,
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

type RecoveryState =
  | { status: "idle" }
  | { status: "authenticating"; attempt: number }
  | { status: "retrying"; attempt: number; max: number; error: Error }
  | { status: "authenticated"; sessionId: string; expiresAt: Date }
  | { status: "failed"; error: Error; recoverable: boolean }
  | { status: "recoverable"; error: Error; retryAfterMs: number };

type FetchInterceptor = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

// ─── State Observable ────────────────────────────────────────────────────────

let _recoveryState: RecoveryState = { status: "idle" };
const _listeners = new Set<(s: RecoveryState) => void>();

function setRecoveryState(next: RecoveryState) {
  _recoveryState = next;
  _listeners.forEach((cb) => cb(next));
}

export function getRecoveryState(): RecoveryState {
  return _recoveryState;
}

export function subscribeRecoveryState(cb: (s: RecoveryState) => void) {
  _listeners.add(cb);
  cb(_recoveryState);
  return () => _listeners.delete(cb);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function jitteredDelay(attempt: number): number {
  const exp = Math.min(attempt, 6);
  const base = RETRY_CONFIG.baseDelayMs * 2 ** exp;
  const capped = Math.min(base, RETRY_CONFIG.maxDelayMs);
  const jitter = Math.random() * 0.3 * capped; // ±30 % jitter
  return Math.floor(capped + jitter);
}

function isRecoverableError(err: unknown): boolean {
  if (err instanceof Response) {
    // 5xx or 429 are recoverable; 4xx (except 429) are not
    return err.status >= 500 || err.status === 429;
  }
  if (err instanceof TypeError || err instanceof DOMException) {
    // Network / timeout / abort → recoverable
    return true;
  }
  return false;
}

function extractRetryAfter(response: Response): number {
  const ra = response.headers.get("retry-after");
  if (!ra) return RETRY_CONFIG.baseDelayMs;
  const n = Number(ra);
  if (!Number.isNaN(n)) return n * 1000;
  const date = Date.parse(ra);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return RETRY_CONFIG.baseDelayMs;
}

// ─── Timeout Wrapper ─────────────────────────────────────────────────────────

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  signal?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), ms);

  const onAbort = () => controller.abort(signal?.reason ?? "parent-aborted");
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(
            new DOMException(
              `Request timed out after ${ms}ms`,
              "TimeoutError"
            )
          );
        });
      }),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

// ─── Bounded Retry Fetch Interceptor ─────────────────────────────────────────

const boundedRetryFetch: FetchInterceptor = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.toString();
  const isAuthEndpoint = url.includes("/sign-in") || url.includes("/sign-up");

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = jitteredDelay(attempt);
      setRecoveryState({
        status: "retrying",
        attempt,
        max: RETRY_CONFIG.maxRetries,
        error: lastError!,
      });
      await sleep(delay);
    }

    if (isAuthEndpoint) {
      setRecoveryState({ status: "authenticating", attempt: attempt + 1 });
    }

    try {
      const response = await withTimeout(
        fetch(input, {
          ...init,
          signal: init.signal, // forwarded so caller can still abort
          credentials: "include", // ensure cookies are sent
        }),
        RETRY_CONFIG.timeoutMs,
        init.signal
      );

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = extractRetryAfter(response);
          setRecoveryState({
            status: "recoverable",
            error: new Error(`Rate limited (429)`),
            retryAfterMs: retryAfter,
          });
          await sleep(retryAfter);
          // Don't count 429 against retry budget; retry immediately after wait
          attempt--;
          continue;
        }
        throw response;
      }

      // ─── Client-Side Token / Cookie Validation ────────────────────────────
      validateSessionHeaders(response);

      setRecoveryState({ status: "idle" });
      return response;
    } catch (err) {
      lastError =
        err instanceof Error ? err : new Error(String(err));

      const recoverable = isRecoverableError(err);

      if (!recoverable || attempt === RETRY_CONFIG.maxRetries) {
        setRecoveryState({
          status: "failed",
          error: lastError,
          recoverable,
        });
        throw lastError;
      }

      // Loop continues → will enter retry state on next iteration
    }
  }

  // Unreachable, but satisfies TS
  throw lastError ?? new Error("Unknown fetch failure");
};

// ─── Session / Cookie Validation ─────────────────────────────────────────────

function validateSessionHeaders(response: Response): void {
  // 1. Verify the server set hardened session cookies
  const setCookie = response.headers.get("set-cookie") ?? "";
  const cookies = setCookie.split(",").map((c) => c.trim());

  const sessionCookie = cookies.find((c) =>
    c.toLowerCase().startsWith("appfoundry.session")
  );

  if (sessionCookie) {
    const hasHttpOnly = /\bHttpOnly\b/i.test(sessionCookie);
    const hasSecure = /\bSecure\b/i.test(sessionCookie);
    const hasSameSite = /\bSameSite=(Strict|Lax)\b/i.test(sessionCookie);

    if (!hasHttpOnly || !hasSecure || !hasSameSite) {
      // eslint-disable-next-line no-console
      console.warn(
        "[auth-client] Session cookie missing security flags:",
        { hasHttpOnly, hasSecure, hasSameSite }
      );
    }
  }

  // 2. Validate Bearer token in Authorization header (if present)
  const authHeader = response.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    validateTokenShape(token);
  }
}

/**
 * Lightweight client-side token shape validation.
 * Full signature verification MUST happen server-side.
 */
function validateTokenShape(token: string): void {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed JWT: expected 3 parts");
  }

  try {
    const payload = JSON.parse(
      typeof window !== "undefined"
        ? atob(parts[1])
        : Buffer.from(parts[1], "base64").toString("utf-8")
    );

    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      throw new Error("Token expired");
    }
    if (payload.nbf && payload.nbf > now) {
      throw new Error("Token not yet valid");
    }
    if (payload.iss && payload.iss !== AUTH_BASE_URL) {
      throw new Error(`Invalid issuer: ${payload.iss}`);
    }
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error("Invalid token payload");
  }
}

// ─── Better-Auth Client Factory ──────────────────────────────────────────────

export const authClient = createAuthClient({
  baseURL: AUTH_BASE_URL,
  plugins: [organizationClient()],
  fetchOptions: {
    customFetchImpl: boundedRetryFetch as typeof fetch,
    // Ensure cookies are included on every request
    credentials: "include",
  },
});

// ─── Exported API ────────────────────────────────────────────────────────────

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  organization,
} = authClient;

// ─── Server-Side Validation Helpers (for API routes / middleware) ─────────────

/**
 * Server-side token validation checklist.
 * Call this inside your API route handlers or middleware.
 */
export async function validateServerToken(
  token: string,
  opts: {
    secret: string;
    issuer?: string;
    audience?: string;
    clockToleranceSec?: number;
  }
): Promise<{
  valid: boolean;
  payload?: Record<string, unknown>;
  error?: string;
}> {
  const { secret, issuer, audience, clockToleranceSec = 60 } = opts;

  try {
    // 1. Structural check
    const parts = token.split(".");
    if (parts.length !== 3) return { valid: false, error: "Malformed JWT" };

    const [headerB64, payloadB64, signatureB64] = parts;

    // 2. Decode header & payload
    const header = JSON.parse(
      Buffer.from(headerB64, "base64url").toString("utf-8")
    ) as Record<string, unknown>;
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8")
    ) as Record<string, unknown>;

    // 3. Algorithm whitelist
    const alg = header.alg;
    if (alg !== "HS256" && alg !== "RS256" && alg !== "ES256") {
      return { valid: false, error: `Unsupported algorithm: ${alg}` };
    }

    // 4. Signature verification (HMAC example)
    const crypto = await import("crypto");
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signatureB64, "base64url"),
        Buffer.from(expectedSig, "base64url")
      )
    ) {
      return { valid: false, error: "Invalid signature" };
    }

    // 5. Temporal claims
    const now = Math.floor(Date.now() / 1000);
    if (payload.iat && typeof payload.iat === "number") {
      if (payload.iat > now + clockToleranceSec) {
        return { valid: false, error: "Token issued in the future" };
      }
    }
    if (payload.exp && typeof payload.exp === "number") {
      if (payload.exp < now - clockToleranceSec) {
        return { valid: false, error: "Token expired" };
      }
    }
    if (payload.nbf && typeof payload.nbf === "number") {
      if (payload.nbf > now + clockToleranceSec) {
        return { valid: false, error: "Token not yet valid" };
      }
    }

    // 6. Issuer / Audience
    if (issuer && payload.iss !== issuer) {
      return { valid: false, error: `Invalid issuer: ${payload.iss}` };
    }
    if (audience && payload.aud !== audience) {
      return { valid: false, error: `Invalid audience: ${payload.aud}` };
    }

    return { valid: true, payload };
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : "Token validation error",
    };
  }
}

/**
 * Hardened session-cookie options for server-side cookie creation.
 * Use these when setting the session cookie in your auth API routes.
 */
export function getHardenedCookieOpts(
  maxAgeSec: number
): {
  name: string;
  value: string;
  options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "strict" | "lax" | "none";
    path: string;
    maxAge: number;
    domain?: string;
  };
} {
  const isProd = process.env.NODE_ENV === "production";
  return {
    name: "appfoundry.session",
    value: "", // caller must set the actual token
    options: {
      httpOnly: true,
      secure: isProd, // Secure in production; allow http in dev
      sameSite: "lax",
      path: "/",
      maxAge: maxAgeSec,
      // Restrict to your apex domain in production:
      // domain: isProd ? ".yourdomain.com" : undefined,
    },
  };
}
