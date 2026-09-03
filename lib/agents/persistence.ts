// lib/agents/persistence.ts

import { db } from "@/lib/db";

import type {
  AgentInput,
  AgentOutput,
  AgentRunResult,
  AgentStatus,
} from "@/lib/agents/runner";

import {
  AgentPersistenceError,
  serializeAgentError,
} from "@/lib/agents/errors";

// ─────────────────────────────────────────────────────────────────────────────
// AppFoundry — Agent Persistence
// ─────────────────────────────────────────────────────────────────────────────
// Responsibilities:
//   • Persist AgentRun lifecycle state
//   • Keep database failures from crashing agent execution
//   • Normalize JSON before Prisma writes
//   • Provide read/update helpers for agent runs
//   • Support cancellation / failure / completion updates
//
// Expected lifecycle:
//
//   queued → running → completed
//                    ↘ failed
//                    ↘ cancelled
//                    ↘ timed_out
// ─────────────────────────────────────────────────────────────────────────────

export type PersistAgentRunInput = {
  id: string;
  agentName: string;
  projectId?: string;
  userId?: string;

  status?: AgentStatus;

  input?: AgentInput;
  output?: AgentOutput;

  error?: unknown;

  startedAt?: Date;
  completedAt?: Date;

  durationMs?: number;

  metadata?: Record<string, unknown>;
};

export type UpdateAgentRunInput = {
  status?: AgentStatus;
  output?: AgentOutput;
  error?: unknown;
  completedAt?: Date;
  durationMs?: number;
  metadata?: Record<string, unknown>;
};

export type AgentRunRecord = {
  id: string;
  agentName: string;
  projectId?: string | null;
  userId?: string | null;
  status: string;

  input?: unknown;
  output?: unknown;
  error?: unknown;
  metadata?: unknown;

  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  durationMs?: number | null;

  createdAt?: Date | string;
  updatedAt?: Date | string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Prisma model access
// ─────────────────────────────────────────────────────────────────────────────

type AgentRunDelegate = {
  create?: (args: {
    data: Record<string, unknown>;
  }) => Promise<unknown>;

  findUnique?: (args: {
    where: Record<string, unknown>;
  }) => Promise<unknown>;

  findMany?: (args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
    take?: number;
    skip?: number;
  }) => Promise<unknown[]>;

  update?: (args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<unknown>;

  delete?: (args: {
    where: Record<string, unknown>;
  }) => Promise<unknown>;
};

function getAgentRunDelegate(): AgentRunDelegate {
  const client =
    db as unknown as Record<string, unknown>;

  const model =
    client.agentRun ??
    client.AgentRun;

  if (
    !model ||
    typeof model !== "object"
  ) {
    throw new AgentPersistenceError(
      "Prisma AgentRun model is not available.",
      {
        details: {
          model: "AgentRun",
        },
      },
    );
  }

  return model as AgentRunDelegate;
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON normalization
// ─────────────────────────────────────────────────────────────────────────────

function normalizeForJson(
  value: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      return null;
    }

    if (!Number.isFinite(value)) {
      return String(value);
    }

    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return serializeAgentError(value);
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) =>
        normalizeForJson(item, seen),
      )
      .filter(
        (item) => item !== undefined,
      );
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);

    const result: Record<
      string,
      unknown
    > = {};

    for (const [
      key,
      item,
    ] of Object.entries(value)) {
      const normalized =
        normalizeForJson(
          item,
          seen,
        );

      if (
        normalized !== undefined
      ) {
        result[key] = normalized;
      }
    }

    seen.delete(value);

    return result;
  }

  return String(value);
}

function jsonValue(
  value: unknown,
): unknown {
  return normalizeForJson(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Data sanitization
// ─────────────────────────────────────────────────────────────────────────────

function cleanRecord(
  record: Record<string, unknown>,
) {
  const cleaned: Record<
    string,
    unknown
  > = {};

  for (const [
    key,
    value,
  ] of Object.entries(record)) {
    if (value !== undefined) {
      cleaned[key] = jsonValue(value);
    }
  }

  return cleaned;
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence service
// ─────────────────────────────────────────────────────────────────────────────

export class AgentPersistence {
  /**
   * Create a new AgentRun record.
   */
  async create(
    input: PersistAgentRunInput,
  ): Promise<AgentRunRecord> {
    if (!input.id) {
      throw new AgentPersistenceError(
        "AgentRun id is required.",
      );
    }

    if (!input.agentName) {
      throw new AgentPersistenceError(
        "AgentRun agentName is required.",
      );
    }

    const delegate =
      getAgentRunDelegate();

    if (!delegate.create) {
      throw new AgentPersistenceError(
        "AgentRun.create is unavailable.",
      );
    }

    const data = cleanRecord({
      id: input.id,
      agentName: input.agentName,

      projectId: input.projectId,
      userId: input.userId,

      status:
        input.status ??
        "queued",

      input: input.input ?? {},
      output: input.output,

      error:
        input.error !== undefined
          ? serializeAgentError(
              input.error,
              {
                includeStack:
                  process.env
                    .NODE_ENV !==
                  "production",
                agentName:
                  input.agentName,
                runId: input.id,
              },
            )
          : undefined,

      metadata:
        input.metadata ?? {},

      startedAt:
        input.startedAt,

      completedAt:
        input.completedAt,

      durationMs:
        input.durationMs,
    });

    try {
      const record =
        await delegate.create({
          data,
        });

      return record as AgentRunRecord;
    } catch (error) {
      throw new AgentPersistenceError(
        "Failed to create AgentRun record.",
        {
          runId: input.id,
          cause: error,
          details: {
            operation: "create",
            agentName:
              input.agentName,
          },
        },
      );
    }
  }

  /**
   * Mark an AgentRun as running.
   */
  async markRunning(
    runId: string,
  ): Promise<AgentRunRecord> {
    return this.update(runId, {
      status: "running",
      completedAt: undefined,
      durationMs: undefined,
    });
  }

  /**
   * Mark an AgentRun as queued.
   */
  async markQueued(
    runId: string,
  ): Promise<AgentRunRecord> {
    return this.update(runId, {
      status: "queued",
    });
  }

  /**
   * Mark an AgentRun as completed.
   */
  async markCompleted(
    runId: string,
    result: AgentRunResult,
  ): Promise<AgentRunRecord> {
    return this.update(runId, {
      status: "completed",
      output: result.output,
      completedAt:
        result.completedAt,
      durationMs:
        result.durationMs,
      metadata: result.metadata,
    });
  }

  /**
   * Mark an AgentRun as failed.
   */
  async markFailed(
    runId: string,
    error: unknown,
    metadata?: Record<
      string,
      unknown
    >,
  ): Promise<AgentRunRecord> {
    return this.update(runId, {
      status: "failed",
      error,
      completedAt: new Date(),
      metadata,
    });
  }

  /**
   * Mark an AgentRun as cancelled.
   */
  async markCancelled(
    runId: string,
    error?: unknown,
  ): Promise<AgentRunRecord> {
    return this.update(runId, {
      status: "cancelled",
      error,
      completedAt: new Date(),
    });
  }

  /**
   * Mark an AgentRun as timed out.
   */
  async markTimedOut(
    runId: string,
    error?: unknown,
  ): Promise<AgentRunRecord> {
    return this.update(runId, {
      status: "timed_out",
      error,
      completedAt: new Date(),
    });
  }

  /**
   * Update an existing AgentRun.
   */
  async update(
    runId: string,
    input: UpdateAgentRunInput,
  ): Promise<AgentRunRecord> {
    if (!runId) {
      throw new AgentPersistenceError(
        "AgentRun id is required.",
      );
    }

    const delegate =
      getAgentRunDelegate();

    if (!delegate.update) {
      throw new AgentPersistenceError(
        "AgentRun.update is unavailable.",
        {
          runId,
        },
      );
    }

    const data = cleanRecord({
      status: input.status,

      output:
        input.output !== undefined
          ? input.output
          : undefined,

      error:
        input.error !== undefined
          ? serializeAgentError(
              input.error,
              {
                includeStack:
                  process.env
                    .NODE_ENV !==
                  "production",
                runId,
              },
            )
          : undefined,

      completedAt:
        input.completedAt,

      durationMs:
        input.durationMs,

      metadata:
        input.metadata,
    });

    try {
      const record =
        await delegate.update({
          where: {
            id: runId,
          },
          data,
        });

      return record as AgentRunRecord;
    } catch (error) {
      throw new AgentPersistenceError(
        "Failed to update AgentRun record.",
        {
          runId,
          cause: error,
          details: {
            operation: "update",
          },
        },
      );
    }
  }

  /**
   * Fetch a single AgentRun.
   */
  async get(
    runId: string,
  ): Promise<AgentRunRecord | null> {
    if (!runId) {
      return null;
    }

    const delegate =
      getAgentRunDelegate();

    if (!delegate.findUnique) {
      throw new AgentPersistenceError(
        "AgentRun.findUnique is unavailable.",
        {
          runId,
        },
      );
    }

    try {
      const record =
        await delegate.findUnique({
          where: {
            id: runId,
          },
        });

      return record as
        | AgentRunRecord
        | null;
    } catch (error) {
      throw new AgentPersistenceError(
        "Failed to retrieve AgentRun.",
        {
          runId,
          cause: error,
          details: {
            operation:
              "findUnique",
          },
        },
      );
    }
  }

  /**
   * List recent runs.
   */
  async list(options: {
    projectId?: string;
    userId?: string;
    agentName?: string;
    status?: AgentStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<
    AgentRunRecord[]
  > {
    const delegate =
      getAgentRunDelegate();

    if (!delegate.findMany) {
      throw new AgentPersistenceError(
        "AgentRun.findMany is unavailable.",
      );
    }

    const limit = Math.min(
      Math.max(
        options.limit ?? 50,
        1,
      ),
      200,
    );

    const offset = Math.max(
      options.offset ?? 0,
      0,
    );

    const where =
      cleanRecord({
        projectId:
          options.projectId,

        userId:
          options.userId,

        agentName:
          options.agentName,

        status:
          options.status,
      });

    try {
      const records =
        await delegate.findMany({
          where,
          orderBy: {
            startedAt: "desc",
          },
          take: limit,
          skip: offset,
        });

      return records as AgentRunRecord[];
    } catch (error) {
      throw new AgentPersistenceError(
        "Failed to list AgentRun records.",
        {
          cause: error,
          details: {
            operation:
              "findMany",
          },
        },
      );
    }
  }

  /**
   * Delete a run.
   *
   * This should generally be reserved for administrative cleanup.
   */
  async delete(
    runId: string,
  ): Promise<void> {
    if (!runId) {
      return;
    }

    const delegate =
      getAgentRunDelegate();

    if (!delegate.delete) {
      throw new AgentPersistenceError(
        "AgentRun.delete is unavailable.",
        {
          runId,
        },
      );
    }

    try {
      await delegate.delete({
        where: {
          id: runId,
        },
      });
    } catch (error) {
      throw new AgentPersistenceError(
        "Failed to delete AgentRun.",
        {
          runId,
          cause: error,
          details: {
            operation:
              "delete",
          },
        },
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Resilient persistence helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Best-effort persistence.
 *
 * Useful from the runner because a database outage should not automatically
 * destroy an otherwise successful agent execution.
 */
export async function tryPersist(
  operation: () => Promise<unknown>,
  context?: {
    runId?: string;
    operationName?: string;
  },
): Promise<boolean> {
  try {
    await operation();
    return true;
  } catch (error) {
    console.error(
      "[AgentPersistence] Best-effort persistence failed:",
      {
        runId: context?.runId,
        operation:
          context?.operationName,
        error:
          serializeAgentError(error),
      },
    );

    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton
// ─────────────────────────────────────────────────────────────────────────────

export const agentPersistence =
  new AgentPersistence();

export default agentPersistence;
