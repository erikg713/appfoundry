// lib/db.ts

import "server-only";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * ============================================================================
 * Environment
 * ============================================================================
 */

const DATABASE_URL = process.env.DATABASE_URL;

/**
 * ============================================================================
 * Pool configuration
 * ============================================================================
 */

const MAX_CONNECTIONS = Number(
  process.env.DB_POOL_MAX ?? 10,
);

const IDLE_TIMEOUT_MS = Number(
  process.env.DB_IDLE_TIMEOUT_MS ?? 30_000,
);

const CONNECTION_TIMEOUT_MS = Number(
  process.env.DB_CONNECTION_TIMEOUT_MS ?? 10_000,
);

const STATEMENT_TIMEOUT_MS = Number(
  process.env.DB_STATEMENT_TIMEOUT_MS ?? 30_000,
);

/**
 * Validate numeric configuration.
 */
function positiveInteger(
  value: number,
  fallback: number,
): number {
  return Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

const poolMax = positiveInteger(
  MAX_CONNECTIONS,
  10,
);

const idleTimeoutMillis = positiveInteger(
  IDLE_TIMEOUT_MS,
  30_000,
);

const connectionTimeoutMillis =
  positiveInteger(
    CONNECTION_TIMEOUT_MS,
    10_000,
);

const statementTimeout =
  positiveInteger(
    STATEMENT_TIMEOUT_MS,
    30_000,
  );

/**
 * ============================================================================
 * Database configuration
 * ============================================================================
 */

function getDatabaseUrl(): string {
  if (!DATABASE_URL) {
    throw new Error(
      [
        "Missing DATABASE_URL.",
        "",
        "Add DATABASE_URL to .env.local.",
        "",
        "Example:",
        "DATABASE_URL=postgresql://user:password@host:5432/database",
      ].join("\n"),
    );
  }

  return DATABASE_URL;
}

/**
 * ============================================================================
 * PostgreSQL Pool
 * ============================================================================
 *
 * The pool is intentionally created lazily.
 *
 * This prevents database connections from being opened merely because a
 * module was imported during a build or during an unrelated server request.
 */

let pool: Pool | undefined;

export function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString =
    getDatabaseUrl();

  pool = new Pool({
    connectionString,

    max: poolMax,

    idleTimeoutMillis,

    connectionTimeoutMillis,

    statement_timeout:
      statementTimeout,

    application_name:
      process.env.DB_APPLICATION_NAME ??
      "appfoundry",

    /**
     * SSL behavior can be controlled through the environment.
     *
     * For hosted PostgreSQL providers, DB_SSL=true can be used when
     * the provider requires TLS.
     */
    ssl:
      process.env.DB_SSL === "true"
        ? {
            rejectUnauthorized:
              process.env.DB_SSL_REJECT_UNAUTHORIZED !==
              "false",
          }
        : undefined,
  });

  /**
   * Pool-level errors can occur on idle clients.
   *
   * Never crash the entire application because an idle connection
   * encountered a network/database failure.
   */
  pool.on(
    "error",
    (error) => {
      console.error(
        "[DB] Unexpected PostgreSQL pool error:",
        error,
      );
    },
  );

  return pool;
}

/**
 * ============================================================================
 * Query
 * ============================================================================
 *
 * Parameterized SQL helper.
 *
 * Example:
 *
 * const users = await query<User>(
 *   `
 *     SELECT id, email
 *     FROM users
 *     WHERE id = $1
 *   `,
 *   [userId],
 * );
 *
 * Never interpolate user-controlled values directly into SQL.
 */
export async function query<
  T extends QueryResultRow = QueryResultRow,
>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const db = getPool();

  const result = await db.query<T>(
    text,
    values,
  );

  return result.rows;
}

/**
 * ============================================================================
 * Query One
 * ============================================================================
 *
 * Returns the first row or null.
 */
export async function queryOne<
  T extends QueryResultRow = QueryResultRow,
>(
  text: string,
  values: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(
    text,
    values,
  );

  return rows[0] ?? null;
}

/**
 * ============================================================================
 * Execute
 * ============================================================================
 *
 * Useful for INSERT/UPDATE/DELETE when the caller primarily cares about
 * affected rows rather than returned data.
 */
export async function execute(
  text: string,
  values: unknown[] = [],
): Promise<{
  rowCount: number;
}> {
  const db = getPool();

  const result = await db.query(
    text,
    values,
  );

  return {
    rowCount: result.rowCount ?? 0,
  };
}

/**
 * ============================================================================
 * Transaction
 * ============================================================================
 *
 * Runs a callback inside a PostgreSQL transaction.
 *
 * Automatically:
 *
 * BEGIN
 *   callback(client)
 * COMMIT
 *
 * or:
 *
 * BEGIN
 *   callback(client)
 * ROLLBACK
 */
export async function transaction<T>(
  callback: (
    client: PoolClient,
  ) => Promise<T>,
): Promise<T> {
  const db = getPool();

  const client =
    await db.connect();

  try {
    await client.query(
      "BEGIN",
    );

    const result =
      await callback(client);

    await client.query(
      "COMMIT",
    );

    return result;
  } catch (error) {
    try {
      await client.query(
        "ROLLBACK",
      );
    } catch (rollbackError) {
      console.error(
        "[DB] Transaction rollback failed:",
        rollbackError,
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

/**
 * ============================================================================
 * Transaction query helper
 * ============================================================================
 */

export async function transactionQuery<
  T extends QueryResultRow = QueryResultRow,
>(
  client: PoolClient,
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result =
    await client.query<T>(
      text,
      values,
    );

  return result.rows;
}

/**
 * ============================================================================
 * Health Check
 * ============================================================================
 */

export async function checkDatabase(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const startedAt =
    Date.now();

  try {
    await query(
      "SELECT 1 AS health",
    );

    return {
      ok: true,
      latencyMs:
        Date.now() - startedAt,
    };
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : "Database health check failed.";

    console.error(
      "[DB] Health check failed:",
      cause,
    );

    return {
      ok: false,
      latencyMs:
        Date.now() - startedAt,
      error: message,
    };
  }
}

/**
 * ============================================================================
 * Database statistics
 * ============================================================================
 */

export function getPoolStats() {
  const db = getPool();

  return {
    totalConnections:
      db.totalCount,

    idleConnections:
      db.idleCount,

    waitingClients:
      db.waitingCount,
  };
}

/**
 * ============================================================================
 * Graceful shutdown
 * ============================================================================
 *
 * Useful for scripts, workers, tests, and local development.
 *
 * Next.js normally owns the application lifecycle, so application code
 * should not call this after every request.
 */
export async function closeDatabase(): Promise<void> {
  if (!pool) {
    return;
  }

  const currentPool =
    pool;

  pool = undefined;

  await currentPool.end();
}

/**
 * ============================================================================
 * Default export
 * ============================================================================
 */

export default getPool;
