// lib/db.ts

import { PrismaClient, Prisma } from "@prisma/client";
import { createHmac, timingSafeEqual } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// AppFoundry Pi — Hardened Prisma Database Client
// ─────────────────────────────────────────────────────────────────────────────
//
// Features
//  • Prisma singleton / hot-reload protection
//  • Bounded connection retries
//  • Exponential backoff + jitter
//  • Query timeout wrapper
//  • Database health checks
//  • Observable database recovery state
//  • Authentication-sensitive audit logging
//  • Session-cookie validation
//  • Sliding session expiration
//  • Secure cookie defaults
//  • Constant-time HS256 JWT validation
//  • Graceful shutdown
//  • PostgreSQL-friendly server-side implementation
//
// IMPORTANT
//  • This module is SERVER-ONLY.
//  • Never import this module into a browser/client component.
//  • Never expose DATABASE_URL or other database secrets to the client.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prevent accidental client-side imports in environments that expose
 * `window`. This is intentionally non-throwing because some test runners
 * emulate browser globals.
 */
const IS_SERVER = typeof window === "undefined";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const DB_CONFIG = {
  maxConnectRetries: parsePositiveInt(
    process.env.DB_MAX_CONNECT_RETRIES,
    5
  ),

  baseDelayMs: parsePositiveInt(
    process.env.DB_RETRY_BASE_DELAY_MS,
    200
  ),

  maxDelayMs: parsePositiveInt(
    process.env.DB_RETRY_MAX_DELAY_MS,
    5_000
  ),

  queryTimeoutMs: parsePositiveInt(
    process.env.DB_QUERY_TIMEOUT_MS,
    8_000
  ),

  healthTimeoutMs: parsePositiveInt(
    process.env.DB_HEALTH_TIMEOUT_MS,
    3_000
  ),

  sessionMaxAgeSec: parsePositiveInt(
    process.env.SESSION_MAX_AGE_SEC,
    60 * 60 * 24 * 7
  ),

  clockToleranceSec: parsePositiveInt(
    process.env.JWT_CLOCK_TOLERANCE_SEC,
    60
  ),

  auditEnabled:
    process.env.DB_AUDIT_LOGGING !== "false",

  verbose:
    process.env.NODE_ENV === "development",

  log:
    process.env.NODE_ENV === "development"
      ? (["query", "error", "warn"] as const)
      : (["error"] as const),
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Environment helpers
// ─────────────────────────────────────────────────────────────────────────────

function parsePositiveInt(
  value: string | undefined,
  fallback: number
): number {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit tables
// ─────────────────────────────────────────────────────────────────────────────

const AUDIT_TABLES = new Set([
  "user",
  "session",
  "account",
  "verificationToken",
]);

const AUDIT_ACTIONS = new Set([
  "create",
  "update",
  "delete",
  "upsert",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DbRecoveryState =
  | {
      status: "idle";
    }
  | {
      status: "connecting";
      attempt: number;
    }
  | {
      status: "retrying";
      attempt: number;
      max: number;
      error: Error;
      delayMs: number;
    }
  | {
      status: "connected";
      poolSize: number;
    }
  | {
      status: "failed";
      error: Error;
      recoverable: boolean;
    }
  | {
      status: "query-timeout";
      query: string;
      durationMs: number;
    };

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "UPSERT";

export interface AuditEntry {
  id: string;
  table: string;
  action: AuditAction;
  recordId: string;
  actorId?: string | null;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface SessionValidationResult {
  valid: boolean;
  session?: {
    userId: string;
    expiresAt: Date;
    ip?: string | null;
  };
  error?: string;
}

export interface JwtValidationResult {
  valid: boolean;
  payload?: Record<string, unknown>;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Database state observer
// ─────────────────────────────────────────────────────────────────────────────

let _dbState: DbRecoveryState = {
  status: "idle",
};

const _dbListeners = new Set<
  (state: DbRecoveryState) => void
>();

function setDbState(next: DbRecoveryState): void {
  _dbState = next;

  for (const listener of _dbListeners) {
    try {
      listener(next);
    } catch {
      // Observability listeners must never break database operations.
    }
  }
}

export function getDbState(): DbRecoveryState {
  return _dbState;
}

export function subscribeDbState(
  callback: (state: DbRecoveryState) => void
): () => void {
  _dbListeners.add(callback);

  // Immediately provide current state.
  callback(_dbState);

  return () => {
    _dbListeners.delete(callback);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic helpers
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Exponential retry delay with positive jitter.
 *
 * Example:
 * 200ms
 * 400ms
 * 800ms
 * 1600ms
 * 3200ms
 *
 * Capped by DB_CONFIG.maxDelayMs.
 */
function jitteredDelay(attempt: number): number {
  const exponent = Math.min(Math.max(attempt - 1, 0), 6);

  const base =
    DB_CONFIG.baseDelayMs * 2 ** exponent;

  const capped = Math.min(
    base,
    DB_CONFIG.maxDelayMs
  );

  const jitter =
    capped * 0.3 * Math.random();

  return Math.floor(capped + jitter);
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

// ─────────────────────────────────────────────────────────────────────────────
// Prisma error classification
// ─────────────────────────────────────────────────────────────────────────────

function isRecoverableDbError(
  error: unknown
): boolean {
  if (
    error instanceof
    Prisma.PrismaClientInitializationError
  ) {
    return true;
  }

  if (
    error instanceof
    Prisma.PrismaClientKnownRequestError
  ) {
    return [
      "P1000", // Authentication failed
      "P1001", // Cannot reach database
      "P1002", // Database timeout
      "P1017", // Server closed connection
    ].includes(error.code);
  }

  if (
    error instanceof
    Prisma.PrismaClientRustPanicError
  ) {
    return false;
  }

  if (
    error instanceof
    Prisma.PrismaClientUnknownRequestError
  ) {
    return false;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Random ID
// ─────────────────────────────────────────────────────────────────────────────
//
// This ID is only used for audit correlation.
// It is NOT intended to replace database-generated UUIDs for application
// primary keys.
// ─────────────────────────────────────────────────────────────────────────────

function generateId(): string {
  const timestamp =
    Date.now().toString(36);

  const random =
    Math.random()
      .toString(36)
      .slice(2, 12);

  return `${timestamp}-${random}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeout wrapper
// ─────────────────────────────────────────────────────────────────────────────

export class DbTimeoutError extends Error {
  readonly code = "DB_QUERY_TIMEOUT";
  readonly durationMs: number;
  readonly operation: string;

  constructor(
    operation: string,
    durationMs: number
  ) {
    super(
      `Database operation timed out after ${durationMs}ms: ${operation}`
    );

    this.name = "DbTimeoutError";
    this.durationMs = durationMs;
    this.operation = operation;
  }
}

/**
 * Race an operation against a timeout.
 *
 * Important:
 * This prevents the caller from waiting forever, but it does NOT magically
 * cancel a query already executing inside PostgreSQL/Prisma.
 *
 * Actual database-level statement timeouts should also be configured at the
 * PostgreSQL/connection-pool level for strict cancellation semantics.
 */
async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise =
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new DbTimeoutError(
            label,
            timeoutMs
          )
        );
      }, timeoutMs);
    });

  try {
    return await Promise.race([
      operation,
      timeoutPromise,
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit sanitization
// ─────────────────────────────────────────────────────────────────────────────

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "hashedPassword",
  "secret",
  "token",
  "accessToken",
  "refreshToken",
  "sessionToken",
  "apiKey",
  "privateKey",
  "authorization",
  "cookie",
]);

function sanitizeAuditValue(
  value: unknown
): unknown {
  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (typeof value === "string") {
    if (value.length > 256) {
      return `${value.slice(0, 256)}…`;
    }

    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map(sanitizeAuditValue);
  }

  if (typeof value === "object") {
    const input =
      value as Record<string, unknown>;

    const output: Record<
      string,
      unknown
    > = {};

    for (const [key, item] of Object.entries(input)) {
      if (
        SENSITIVE_KEYS.has(key) ||
        SENSITIVE_KEYS.has(key.toLowerCase())
      ) {
        output[key] = "[REDACTED]";
      } else {
        output[key] =
          sanitizeAuditValue(item);
      }
    }

    return output;
  }

  return "[UNSERIALIZABLE]";
}

function sanitizeAuditObject(
  value: unknown
): Record<string, unknown> {
  const sanitized =
    sanitizeAuditValue(value);

  if (
    sanitized &&
    typeof sanitized === "object" &&
    !Array.isArray(sanitized)
  ) {
    return sanitized as Record<
      string,
      unknown
    >;
  }

  return {};
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit logging
// ─────────────────────────────────────────────────────────────────────────────
//
// The fallback logger intentionally uses structured JSON.
//
// Do NOT write audit records using the same Prisma middleware unless you
// explicitly exclude the AuditLog model. Otherwise you can create recursive
// middleware execution.
// ─────────────────────────────────────────────────────────────────────────────

async function writeAuditLog(
  _prisma: PrismaClient,
  entry: Omit<
    AuditEntry,
    "id" | "createdAt"
  >
): Promise<void> {
  if (!DB_CONFIG.auditEnabled) {
    return;
  }

  const audit: AuditEntry = {
    id: generateId(),
    ...entry,
    changes: entry.changes
      ? sanitizeAuditObject(entry.changes)
      : undefined,
    metadata: entry.metadata
      ? sanitizeAuditObject(entry.metadata)
      : undefined,
    createdAt: new Date(),
  };

  /**
   * This is deliberately a structured application log.
   *
   * If your Prisma schema contains an AuditLog model, this function can be
   * replaced with a direct create operation using a separate client or an
   * explicit recursion guard.
   */
  if (DB_CONFIG.verbose) {
    console.info(
      "[db:audit]",
      JSON.stringify(audit)
    );
  } else {
    console.info(
      "[db:audit]",
      JSON.stringify({
        id: audit.id,
        table: audit.table,
        action: audit.action,
        recordId: audit.recordId,
        actorId: audit.actorId ?? null,
        createdAt:
          audit.createdAt.toISOString(),
      })
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prisma client factory
// ─────────────────────────────────────────────────────────────────────────────

function createPrismaClient(): PrismaClient {
  if (!IS_SERVER) {
    throw new Error(
      "Prisma database client cannot be initialized in a browser environment."
    );
  }

  const client = new PrismaClient({
    log: DB_CONFIG.log,
  });

  /**
   * Prisma middleware.
   *
   * NOTE:
   * Prisma versions that remove `$use` should migrate this logic to
   * `$extends({ query: ... })`.
   *
   * This implementation remains compatible with Prisma versions exposing
   * `$use`.
   */
  client.$use(
    async (params, next) => {
      const start =
        performance.now();

      const model =
        params.model ?? "raw";

      const action =
        String(params.action);

      const operation =
        `${model}.${action}`;

      const isAuthTable =
        AUDIT_TABLES.has(model);

      try {
        const result =
          await withTimeout(
            next(params),
            DB_CONFIG.queryTimeoutMs,
            operation
          );

        const durationMs =
          Math.round(
            performance.now() - start
          );

        // ───────────────────────────────────────────────────────────────
        // Audit auth-sensitive mutations.
        // ───────────────────────────────────────────────────────────────

        if (
          isAuthTable &&
          AUDIT_ACTIONS.has(action)
        ) {
          const resultObject =
            result &&
            typeof result === "object"
              ? (result as Record<
                  string,
                  unknown
                >)
              : undefined;

          const recordId =
            typeof resultObject?.id ===
            "string"
              ? resultObject.id
              : typeof params.args
                    ?.where?.id ===
                  "string"
                ? params.args.where.id
                : "unknown";

          const actorId =
            typeof params.args
              ?.data?.updatedBy ===
            "string"
              ? params.args.data.updatedBy
              : typeof params.args
                    ?.data?.createdBy ===
                  "string"
                ? params.args.data.createdBy
                : null;

          /**
           * Do not persist complete query arguments.
           * They can contain passwords, tokens, and other secrets.
           */
          await writeAuditLog(
            client,
            {
              table: model,
              action:
                action.toUpperCase() as AuditAction,
              recordId,
              actorId,
              metadata: {
                queryDurationMs:
                  durationMs,
                action,
                model,
                argumentKeys:
                  Object.keys(
                    params.args ?? {}
                  ),
              },
            }
          );
        }

        return result;
      } catch (error) {
        const durationMs =
          Math.round(
            performance.now() - start
          );

        if (
          error instanceof
          DbTimeoutError
        ) {
          setDbState({
            status: "query-timeout",
            query: operation,
            durationMs,
          });
        }

        throw error;
      }
    }
  );

  return client;
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Prisma singleton
// ─────────────────────────────────────────────────────────────────────────────

const globalForPrisma =
  globalThis as unknown as {
    prisma?: PrismaClient;
  };

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

/**
 * Store the client globally during development so Next.js/Vite hot reloads
 * don't create hundreds of database connections.
 */
if (
  process.env.NODE_ENV !==
  "production"
) {
  globalForPrisma.prisma =
    prisma;
}

// ─────────────────────────────────────────────────────────────────────────────
// Connection management
// ─────────────────────────────────────────────────────────────────────────────

let connectPromise:
  | Promise<void>
  | null = null;

export async function connectWithRetry(): Promise<void> {
  /**
   * Prevent multiple simultaneous callers from creating competing connection
   * retry loops.
   */
  if (connectPromise) {
    return connectPromise;
  }

  connectPromise =
    connectWithRetryInternal();

  try {
    await connectPromise;
  } finally {
    connectPromise = null;
  }
}

async function connectWithRetryInternal(): Promise<void> {
  let lastError:
    | Error
    | undefined;

  for (
    let attempt = 1;
    attempt <=
    DB_CONFIG.maxConnectRetries + 1;
    attempt++
  ) {
    if (attempt > 1) {
      const delayMs =
        jitteredDelay(
          attempt - 1
        );

      setDbState({
        status: "retrying",
        attempt,
        max:
          DB_CONFIG.maxConnectRetries +
          1,
        error:
          lastError ??
          new Error(
            "Unknown connection error"
          ),
        delayMs,
      });

      await sleep(delayMs);
    }

    setDbState({
      status: "connecting",
      attempt,
    });

    try {
      await withTimeout(
        prisma.$connect(),
        DB_CONFIG.queryTimeoutMs,
        "prisma.$connect"
      );

      setDbState({
        status: "connected",
        poolSize: 1,
      });

      return;
    } catch (error) {
      lastError =
        toError(error);

      const recoverable =
        isRecoverableDbError(
          error
        );

      const finalAttempt =
        attempt >=
        DB_CONFIG.maxConnectRetries +
          1;

      if (
        !recoverable ||
        finalAttempt
      ) {
        setDbState({
          status: "failed",
          error: lastError,
          recoverable,
        });

        throw lastError;
      }
    }
  }

  throw (
    lastError ??
    new Error(
      "Unknown database connection failure"
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Disconnect
// ─────────────────────────────────────────────────────────────────────────────

let disconnectPromise:
  | Promise<void>
  | null = null;

export async function disconnect(): Promise<void> {
  if (disconnectPromise) {
    return disconnectPromise;
  }

  disconnectPromise =
    (async () => {
      try {
        await prisma.$disconnect();
      } finally {
        setDbState({
          status: "idle",
        });
      }
    })();

  try {
    await disconnectPromise;
  } finally {
    disconnectPromise = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT helpers
// ─────────────────────────────────────────────────────────────────────────────

function decodeBase64UrlJson(
  value: string
): Record<string, unknown> {
  const decoded =
    Buffer.from(
      value,
      "base64url"
    ).toString("utf8");

  const parsed =
    JSON.parse(decoded);

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      "JWT JSON value is not an object"
    );
  }

  return parsed as Record<
    string,
    unknown
  >;
}

function safeTimingSafeEqual(
  a: Buffer,
  b: Buffer
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

/**
 * Validate an HS256 JWT.
 *
 * SECURITY:
 * The previous implementation accepted RS256/ES256 but still calculated
 * an HMAC signature. That is cryptographically incorrect.
 *
 * This implementation explicitly supports HS256 only.
 *
 * If your identity provider signs tokens with RS256/ES256, use a proper JWT
 * library such as `jose` with the provider's JWKS/public key instead.
 */
export async function validateServerToken(
  token: string,
  opts: {
    secret: string;
    issuer?: string;
    audience?: string;
    clockToleranceSec?: number;
    requireExpiration?: boolean;
    maxTokenLifetimeSec?: number;
  }
): Promise<JwtValidationResult> {
  const {
    secret,
    issuer,
    audience,
    clockToleranceSec =
      DB_CONFIG.clockToleranceSec,
    requireExpiration = true,
    maxTokenLifetimeSec,
  } = opts;

  if (!secret) {
    return {
      valid: false,
      error:
        "JWT validation secret is missing",
    };
  }

  if (!token) {
    return {
      valid: false,
      error: "Token is missing",
    };
  }

  try {
    // ───────────────────────────────────────────────────────────────
    // Structural validation
    // ───────────────────────────────────────────────────────────────

    const parts =
      token.split(".");

    if (parts.length !== 3) {
      return {
        valid: false,
        error: "Malformed JWT",
      };
    }

    const [
      headerB64,
      payloadB64,
      signatureB64,
    ] = parts;

    if (
      !headerB64 ||
      !payloadB64 ||
      !signatureB64
    ) {
      return {
        valid: false,
        error: "Malformed JWT",
      };
    }

    // ───────────────────────────────────────────────────────────────
    // Decode
    // ───────────────────────────────────────────────────────────────

    const header =
      decodeBase64UrlJson(
        headerB64
      );

    const payload =
      decodeBase64UrlJson(
        payloadB64
      );

    // ───────────────────────────────────────────────────────────────
    // Algorithm enforcement
    // ───────────────────────────────────────────────────────────────

    if (header.alg !== "HS256") {
      return {
        valid: false,
        error:
          "Unsupported JWT algorithm",
      };
    }

    if (
      header.typ !== undefined &&
      header.typ !== "JWT"
    ) {
      return {
        valid: false,
        error:
          "Invalid JWT type",
      };
    }

    // ───────────────────────────────────────────────────────────────
    // Signature
    // ───────────────────────────────────────────────────────────────

    const signingInput =
      `${headerB64}.${payloadB64}`;

    const expectedSignature =
      createHmac(
        "sha256",
        secret
      )
        .update(signingInput)
        .digest();

    const providedSignature =
      Buffer.from(
        signatureB64,
        "base64url"
      );

    if (
      !safeTimingSafeEqual(
        providedSignature,
        expectedSignature
      )
    ) {
      return {
        valid: false,
        error:
          "Invalid signature",
      };
    }

    // ───────────────────────────────────────────────────────────────
    // Temporal claims
    // ───────────────────────────────────────────────────────────────

    const now =
      Math.floor(
        Date.now() / 1000
      );

    const iat =
      payload.iat;

    const exp =
      payload.exp;

    const nbf =
      payload.nbf;

    if (
      iat !== undefined &&
      typeof iat !== "number"
    ) {
      return {
        valid: false,
        error:
          "Invalid iat claim",
      };
    }

    if (
      exp !== undefined &&
      typeof exp !== "number"
    ) {
      return {
        valid: false,
        error:
          "Invalid exp claim",
      };
    }

    if (
      nbf !== undefined &&
      typeof nbf !== "number"
    ) {
      return {
        valid: false,
        error:
          "Invalid nbf claim",
      };
    }

    if (
      iat !== undefined &&
      typeof iat === "number" &&
      iat >
        now +
          clockToleranceSec
    ) {
      return {
        valid: false,
        error:
          "Token issued in the future",
      };
    }

    if (
      requireExpiration &&
      typeof exp !== "number"
    ) {
      return {
        valid: false,
        error:
          "Token expiration is required",
      };
    }

    if (
      typeof exp === "number" &&
      exp <
        now -
          clockToleranceSec
    ) {
      return {
        valid: false,
        error:
          "Token expired",
      };
    }

    if (
      typeof nbf === "number" &&
      nbf >
        now +
          clockToleranceSec
    ) {
      return {
        valid: false,
        error:
          "Token not yet valid",
      };
    }

    if (
      maxTokenLifetimeSec !==
        undefined &&
      typeof iat === "number" &&
      typeof exp === "number"
    ) {
      if (
        exp - iat >
        maxTokenLifetimeSec
      ) {
        return {
          valid: false,
          error:
            "Token lifetime exceeds allowed maximum",
        };
      }
    }

    // ───────────────────────────────────────────────────────────────
    // Issuer
    // ───────────────────────────────────────────────────────────────

    if (
      issuer !== undefined &&
      payload.iss !== issuer
    ) {
      return {
        valid: false,
        error:
          "Invalid issuer",
      };
    }

    // ───────────────────────────────────────────────────────────────
    // Audience
    // ───────────────────────────────────────────────────────────────

    if (
      audience !== undefined
    ) {
      const tokenAudience =
        payload.aud;

      const audienceValid =
        typeof tokenAudience ===
          "string"
          ? tokenAudience ===
            audience
          : Array.isArray(
                tokenAudience
              )
            ? tokenAudience.includes(
                audience
              )
            : false;

      if (!audienceValid) {
        return {
          valid: false,
          error:
            "Invalid audience",
        };
      }
    }

    return {
      valid: true,
      payload,
    };
  } catch (error) {
    return {
      valid: false,
      error:
        error instanceof Error
          ? error.message
          : "Token validation error",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Session token hashing helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hashing is optional.
 *
 * If your database stores raw session tokens, call
 * validateSessionCookie() directly.
 *
 * If your database stores SHA-256 hashes of session tokens, use:
 *
 * hashSessionToken(sessionToken)
 */
export function hashSessionToken(
  sessionToken: string
): string {
  return createHmac(
    "sha256",
    process.env.SESSION_TOKEN_PEPPER ??
      ""
  )
    .update(sessionToken)
    .digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// Session validation
// ─────────────────────────────────────────────────────────────────────────────

export async function validateSessionCookie(
  sessionToken: string,
  opts?: {
    maxAgeSec?: number;
    requireIpMatch?: boolean;
    requestIp?: string;
    refresh?: boolean;
  }
): Promise<SessionValidationResult> {
  const {
    maxAgeSec =
      DB_CONFIG.sessionMaxAgeSec,

    requireIpMatch = false,

    requestIp,

    refresh = true,
  } = opts ?? {};

  if (!sessionToken) {
    return {
      valid: false,
      error:
        "Session token is missing",
    };
  }

  if (
    sessionToken.length < 16 ||
    sessionToken.length > 512
  ) {
    return {
      valid: false,
      error:
        "Invalid session token format",
    };
  }

  try {
    const session =
      await withTimeout(
        prisma.session.findUnique({
          where: {
            sessionToken,
          },

          include: {
            user: {
              select: {
                id: true,
              },
            },
          },
        }),

        DB_CONFIG.queryTimeoutMs,

        "session.findUnique"
      );

    if (!session) {
      return {
        valid: false,
        error:
          "Session not found",
      };
    }

    const now =
      new Date();

    if (
      session.expires <= now
    ) {
      return {
        valid: false,
        error:
          "Session expired",
      };
    }

    // ───────────────────────────────────────────────────────────────
    // Optional IP binding
    // ───────────────────────────────────────────────────────────────

    if (
      requireIpMatch &&
      requestIp
    ) {
      const sessionIp =
        "ipAddress" in session
          ? (
              session as typeof session & {
                ipAddress?: string | null;
              }
            ).ipAddress
          : null;

      if (
        !sessionIp ||
        sessionIp !== requestIp
      ) {
        return {
          valid: false,
          error:
            "IP mismatch",
        };
      }
    }

    // ───────────────────────────────────────────────────────────────
    // Sliding expiration
    // ───────────────────────────────────────────────────────────────
    //
    // Only refresh once the remaining lifetime has fallen below half of
    // the configured maximum.
    //
    // This avoids updating the database on every request.
    // ───────────────────────────────────────────────────────────────

    let effectiveExpires =
      session.expires;

    if (refresh) {
      const refreshThreshold =
        new Date(
          Date.now() +
            (maxAgeSec *
              1000) /
              2
        );

      if (
        session.expires <=
        refreshThreshold
      ) {
        effectiveExpires =
          new Date(
            Date.now() +
              maxAgeSec *
                1000
          );

        await withTimeout(
          prisma.session.update({
            where: {
              sessionToken,
            },

            data: {
              expires:
                effectiveExpires,
            },
          }),

          DB_CONFIG.queryTimeoutMs,

          "session.update"
        );
      }
    }

    return {
      valid: true,

      session: {
        userId:
          session.userId,

        expiresAt:
          effectiveExpires,

        ip:
          "ipAddress" in session
            ? (
                session as typeof session & {
                  ipAddress?: string | null;
                }
              ).ipAddress ??
              null
            : null,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error:
        error instanceof Error
          ? error.message
          : "Session validation error",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Secure cookie configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface HardenedCookieOptions {
  name: string;

  options: {
    httpOnly: true;
    secure: boolean;
    sameSite:
      | "strict"
      | "lax"
      | "none";
    path: "/";
    maxAge: number;
    domain?: string;
  };
}

export function getHardenedCookieOpts(
  maxAgeSec: number,
  overrides?: Partial<{
    name: string;
    sameSite:
      | "strict"
      | "lax"
      | "none";
    domain:
      | string
      | undefined;
  }>
): HardenedCookieOptions {
  const isProd =
    process.env.NODE_ENV ===
    "production";

  const sameSite =
    overrides?.sameSite ??
    "lax";

  /**
   * SameSite=None requires Secure cookies.
   */
  const secure =
    isProd ||
    sameSite === "none";

  return {
    name:
      overrides?.name ??
      "appfoundry.session",

    options: {
      httpOnly: true,

      secure,

      sameSite,

      path: "/",

      maxAge: Math.max(
        1,
        Math.floor(maxAgeSec)
      ),

      domain:
        overrides?.domain ??
        undefined,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience cookie configuration
// ─────────────────────────────────────────────────────────────────────────────

export function getDefaultSessionCookieOpts(): HardenedCookieOptions {
  return getHardenedCookieOpts(
    DB_CONFIG.sessionMaxAgeSec
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Database health check
// ─────────────────────────────────────────────────────────────────────────────

export async function dbHealthCheck(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start =
    performance.now();

  try {
    await withTimeout(
      prisma.$queryRaw<
        Array<{ result: number }>
      >`SELECT 1 AS result`,

      DB_CONFIG.healthTimeoutMs,

      "health-check"
    );

    const latencyMs =
      Math.round(
        performance.now() -
          start
      );

    return {
      ok: true,
      latencyMs,
    };
  } catch (error) {
    const latencyMs =
      Math.round(
        performance.now() -
          start
      );

    return {
      ok: false,
      latencyMs,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Database readiness helper
// ─────────────────────────────────────────────────────────────────────────────

export async function isDatabaseReady(): Promise<boolean> {
  const result =
    await dbHealthCheck();

  return result.ok;
}

// ─────────────────────────────────────────────────────────────────────────────
// Assert database readiness
// ─────────────────────────────────────────────────────────────────────────────

export async function assertDatabaseReady(): Promise<void> {
  const result =
    await dbHealthCheck();

  if (!result.ok) {
    throw new Error(
      `Database is unavailable: ${
        result.error ??
        "unknown error"
      }`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Graceful process shutdown
// ─────────────────────────────────────────────────────────────────────────────
//
// Node-only process hooks.
// Guarded so importing/testing the module doesn't crash non-Node runtimes.
// ─────────────────────────────────────────────────────────────────────────────

function registerShutdownHandlers(): void {
  if (
    typeof process ===
    "undefined"
  ) {
    return;
  }

  if (
    process.env.NODE_ENV ===
    "test"
  ) {
    return;
  }

  let shuttingDown =
    false;

  const shutdown =
    async (
      signal: string
    ) => {
      if (shuttingDown) {
        return;
      }

      shuttingDown = true;

      if (DB_CONFIG.verbose) {
        console.info(
          `[db] received ${signal}; disconnecting Prisma`
        );
      }

      try {
        await disconnect();
      } catch (error) {
        console.error(
          "[db] disconnect error",
          error
        );
      }
    };

  process.once(
    "SIGINT",
    () => {
      void shutdown("SIGINT");
    }
  );

  process.once(
    "SIGTERM",
    () => {
      void shutdown("SIGTERM");
    }
  );
}

registerShutdownHandlers();

// ─────────────────────────────────────────────────────────────────────────────
// Public configuration
// ─────────────────────────────────────────────────────────────────────────────

export const dbConfig = {
  queryTimeoutMs:
    DB_CONFIG.queryTimeoutMs,

  healthTimeoutMs:
    DB_CONFIG.healthTimeoutMs,

  maxConnectRetries:
    DB_CONFIG.maxConnectRetries,

  sessionMaxAgeSec:
    DB_CONFIG.sessionMaxAgeSec,

  auditEnabled:
    DB_CONFIG.auditEnabled,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Prisma namespace
// ─────────────────────────────────────────────────────────────────────────────

export { Prisma };

// ─────────────────────────────────────────────────────────────────────────────
// Default export
// ─────────────────────────────────────────────────────────────────────────────

export default prisma;
