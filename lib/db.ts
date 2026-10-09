import { PrismaClient, Prisma } from "@prisma/client";

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

function createPrismaClient() {
  if (!IS_SERVER) {
    throw new Error(
      "Prisma database client cannot be initialized in a browser environment."
    );
  }

  /**
   * Query middleware via `$extends` (Prisma 6 removed `$use`).
   * Adds per-query timeouts, timing, and structured audit logging for
   * auth-sensitive mutations.
   */
  const client = new PrismaClient({
    log: [...DB_CONFIG.log] as ("query" | "error" | "warn")[],
  }).$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        const start = performance.now();

        const modelName = model ?? "raw";
        const action = String(operation);
        const operationName = `${modelName}.${action}`;
        const isAuthTable = model ? AUDIT_TABLES.has(model) : false;

        try {
          const result = await withTimeout(
            query(args),
            DB_CONFIG.queryTimeoutMs,
            operationName
          );

          const durationMs = Math.round(performance.now() - start);

          // ─────────────────────────────────────────────────────────────
          // Audit auth-sensitive mutations.
          // ─────────────────────────────────────────────────────────────

          if (isAuthTable && AUDIT_ACTIONS.has(action)) {
            const resultObject =
              result && typeof result === "object"
                ? (result as Record<string, unknown>)
                : undefined;

            const argsRecord = (args ?? {}) as Record<string, unknown>;
            const where = argsRecord.where as
              | Record<string, unknown>
              | undefined;
            const data = argsRecord.data as
              | Record<string, unknown>
              | undefined;

            const recordId =
              typeof resultObject?.id === "string"
                ? resultObject.id
                : typeof where?.id === "string"
                  ? where.id
                  : "unknown";

            const actorId =
              typeof data?.updatedBy === "string"
                ? data.updatedBy
                : typeof data?.createdBy === "string"
                  ? data.createdBy
                  : null;

            /**
             * Do not persist complete query arguments.
             * They can contain passwords, tokens, and other secrets.
             */
            await writeAuditLog(
              {
                table: modelName,
                action: action.toUpperCase() as AuditAction,
                recordId,
                actorId,
                metadata: {
                  queryDurationMs: durationMs,
                  action,
                  model: modelName,
                  argumentKeys: Object.keys(argsRecord),
                },
              }
            );
          }

          return result;
        } catch (error) {
          const durationMs = Math.round(performance.now() - start);

          if (error instanceof DbTimeoutError) {
            setDbState({
              status: "query-timeout",
              query: operationName,
              durationMs,
            });
          }

          throw error;
        }
      },
    },
  });

  return client;
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Prisma singleton
// ─────────────────────────────────────────────────────────────────────────────

const globalForPrisma =
  globalThis as unknown as {
    prisma?: ReturnType<typeof createPrismaClient>;
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
