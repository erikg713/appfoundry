// app/agents/memory.ts

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * AppFoundry Agent Memory
 *
 * Responsibilities:
 * - Persist agent observations, decisions, artifacts, and errors.
 * - Retrieve relevant memory for subsequent agent runs.
 * - Keep memory scoped to a project and optionally an agent/run.
 * - Avoid leaking one project's memory into another project.
 *
 * This module intentionally does not contain orchestration logic.
 */

export type AgentMemoryType =
  | "context"
  | "observation"
  | "decision"
  | "artifact"
  | "error"
  | "instruction"
  | "result"
  | "summary";

export interface AgentMemory {
  id: string;
  projectId: string;
  agentId?: string | null;
  runId?: string | null;
  type: AgentMemoryType;
  key?: string | null;
  content: string;
  metadata?: Record<string, unknown> | null;
  importance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMemoryInput {
  projectId: string;
  agentId?: string | null;
  runId?: string | null;
  type: AgentMemoryType;
  key?: string | null;
  content: string;
  metadata?: Record<string, unknown> | null;
  importance?: number;
}

export interface MemoryQuery {
  projectId: string;
  agentId?: string | null;
  runId?: string | null;
  type?: AgentMemoryType | AgentMemoryType[];
  key?: string;
  query?: string;
  limit?: number;
  minImportance?: number;
}

export interface MemoryContext {
  memories: AgentMemory[];
  text: string;
}

/**
 * Runtime-safe limits.
 */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_CONTENT_LENGTH = 100_000;
const MAX_KEY_LENGTH = 500;

function clampLimit(limit?: number): number {
  if (!Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    MAX_LIMIT,
    Math.max(1, Math.floor(limit as number)),
  );
}

function clampImportance(value?: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }

  return Math.min(1, Math.max(0, value as number));
}

function normalizeContent(content: string): string {
  return content.trim().slice(0, MAX_CONTENT_LENGTH);
}

function normalizeKey(key?: string | null): string | null {
  if (!key) {
    return null;
  }

  const value = key.trim();

  return value.length > 0 ? value.slice(0, MAX_KEY_LENGTH) : null;
}

function normalizeMetadata(
  metadata?: Record<string, unknown> | null,
): Prisma.InputJsonValue | null {
  if (!metadata) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue;
  } catch {
    return {
      serializationError: true,
    };
  }
}

/**
 * Convert a Prisma memory record into the public application shape.
 *
 * This deliberately avoids exposing Prisma-specific types to consumers.
 */
function toMemory(record: {
  id: string;
  projectId: string;
  agentId: string | null;
  runId: string | null;
  type: string;
  key: string | null;
  content: string;
  metadata: Prisma.JsonValue | null;
  importance: number;
  createdAt: Date;
  updatedAt: Date;
}): AgentMemory {
  return {
    id: record.id,
    projectId: record.projectId,
    agentId: record.agentId,
    runId: record.runId,
    type: record.type as AgentMemoryType,
    key: record.key,
    content: record.content,
    metadata:
      record.metadata &&
      typeof record.metadata === "object" &&
      !Array.isArray(record.metadata)
        ? (record.metadata as Record<string, unknown>)
        : null,
    importance: record.importance,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Store a new memory.
 */
export async function createMemory(
  input: CreateMemoryInput,
): Promise<AgentMemory> {
  const projectId = input.projectId.trim();
  const content = normalizeContent(input.content);

  if (!projectId) {
    throw new Error("projectId is required");
  }

  if (!content) {
    throw new Error("Memory content is required");
  }

  const record = await db.agentMemory.create({
    data: {
      projectId,
      agentId: input.agentId?.trim() || null,
      runId: input.runId?.trim() || null,
      type: input.type,
      key: normalizeKey(input.key),
      content,
      metadata: normalizeMetadata(input.metadata),
      importance: clampImportance(input.importance),
    },
  });

  return toMemory(record);
}

/**
 * Store multiple memories efficiently.
 */
export async function createMemories(
  memories: CreateMemoryInput[],
): Promise<number> {
  if (memories.length === 0) {
    return 0;
  }

  const data = memories
    .map((memory) => {
      const projectId = memory.projectId.trim();
      const content = normalizeContent(memory.content);

      if (!projectId || !content) {
        return null;
      }

      return {
        projectId,
        agentId: memory.agentId?.trim() || null,
        runId: memory.runId?.trim() || null,
        type: memory.type,
        key: normalizeKey(memory.key),
        content,
        metadata: normalizeMetadata(memory.metadata),
        importance: clampImportance(memory.importance),
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);

  if (data.length === 0) {
    return 0;
  }

  const result = await db.agentMemory.createMany({
    data,
  });

  return result.count;
}

/**
 * Retrieve memories belonging to a project.
 *
 * Project isolation is mandatory.
 */
export async function getMemories(
  query: MemoryQuery,
): Promise<AgentMemory[]> {
  const projectId = query.projectId.trim();

  if (!projectId) {
    throw new Error("projectId is required");
  }

  const limit = clampLimit(query.limit);

  const where: Prisma.AgentMemoryWhereInput = {
    projectId,
  };

  if (query.agentId) {
    where.agentId = query.agentId;
  }

  if (query.runId) {
    where.runId = query.runId;
  }

  if (query.key) {
    where.key = query.key;
  }

  if (query.minImportance !== undefined) {
    where.importance = {
      gte: clampImportance(query.minImportance),
    };
  }

  if (query.type) {
    where.type = Array.isArray(query.type)
      ? {
          in: query.type,
        }
      : query.type;
  }

  /**
   * PostgreSQL case-insensitive search.
   *
   * `query` is intentionally limited to the memory content field.
   */
  if (query.query?.trim()) {
    where.content = {
      contains: query.query.trim().slice(0, 2_000),
      mode: "insensitive",
    };
  }

  const records = await db.agentMemory.findMany({
    where,
    orderBy: [
      {
        importance: "desc",
      },
      {
        updatedAt: "desc",
      },
    ],
    take: limit,
  });

  return records.map(toMemory);
}

/**
 * Retrieve the most recent memories for a project.
 */
export async function getRecentMemories(
  projectId: string,
  options?: {
    agentId?: string;
    runId?: string;
    limit?: number;
  },
): Promise<AgentMemory[]> {
  const records = await db.agentMemory.findMany({
    where: {
      projectId: projectId.trim(),
      ...(options?.agentId
        ? {
            agentId: options.agentId,
          }
        : {}),
      ...(options?.runId
        ? {
            runId: options.runId,
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    take: clampLimit(options?.limit),
  });

  return records.map(toMemory);
}

/**
 * Retrieve one memory by ID while enforcing project isolation.
 */
export async function getMemory(
  projectId: string,
  memoryId: string,
): Promise<AgentMemory | null> {
  const record = await db.agentMemory.findFirst({
    where: {
      id: memoryId,
      projectId: projectId.trim(),
    },
  });

  return record ? toMemory(record) : null;
}

/**
 * Retrieve a keyed memory.
 *
 * Useful for persistent state such as:
 *
 * - current_architecture
 * - project_requirements
 * - coding_conventions
 * - known_errors
 * - deployment_status
 */
export async function getMemoryByKey(
  projectId: string,
  key: string,
  options?: {
    agentId?: string;
    type?: AgentMemoryType;
  },
): Promise<AgentMemory | null> {
  const record = await db.agentMemory.findFirst({
    where: {
      projectId: projectId.trim(),
      key: key.trim(),
      ...(options?.agentId
        ? {
            agentId: options.agentId,
          }
        : {}),
      ...(options?.type
        ? {
            type: options.type,
          }
        : {}),
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return record ? toMemory(record) : null;
}

/**
 * Update an existing memory.
 */
export async function updateMemory(
  projectId: string,
  memoryId: string,
  update: Partial<
    Pick<
      CreateMemoryInput,
      "type" | "key" | "content" | "metadata" | "importance"
    >
  >,
): Promise<AgentMemory | null> {
  const existing = await db.agentMemory.findFirst({
    where: {
      id: memoryId,
      projectId: projectId.trim(),
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    return null;
  }

  const data: Prisma.AgentMemoryUpdateInput = {};

  if (update.type !== undefined) {
    data.type = update.type;
  }

  if (update.key !== undefined) {
    data.key = normalizeKey(update.key);
  }

  if (update.content !== undefined) {
    const content = normalizeContent(update.content);

    if (!content) {
      throw new Error("Memory content cannot be empty");
    }

    data.content = content;
  }

  if (update.metadata !== undefined) {
    data.metadata = normalizeMetadata(update.metadata);
  }

  if (update.importance !== undefined) {
    data.importance = clampImportance(update.importance);
  }

  const record = await db.agentMemory.update({
    where: {
      id: existing.id,
    },
    data,
  });

  return toMemory(record);
}

/**
 * Delete a memory while enforcing project isolation.
 */
export async function deleteMemory(
  projectId: string,
  memoryId: string,
): Promise<boolean> {
  const result = await db.agentMemory.deleteMany({
    where: {
      id: memoryId,
      projectId: projectId.trim(),
    },
  });

  return result.count > 0;
}

/**
 * Delete all memories for a specific agent run.
 */
export async function deleteRunMemories(
  projectId: string,
  runId: string,
): Promise<number> {
  const result = await db.agentMemory.deleteMany({
    where: {
      projectId: projectId.trim(),
      runId: runId.trim(),
    },
  });

  return result.count;
}

/**
 * Build a compact context string suitable for an LLM/agent.
 *
 * Higher-importance memories appear first.
 */
export function formatMemoryContext(
  memories: AgentMemory[],
  options?: {
    maxCharacters?: number;
  },
): string {
  const maxCharacters = Math.max(
    1_000,
    options?.maxCharacters ?? 20_000,
  );

  const sorted = [...memories].sort(
    (a, b) =>
      b.importance - a.importance ||
      b.updatedAt.getTime() - a.updatedAt.getTime(),
  );

  const sections: string[] = [];
  let total = 0;

  for (const memory of sorted) {
    const metadata =
      memory.metadata && Object.keys(memory.metadata).length > 0
        ? `\nMetadata: ${JSON.stringify(memory.metadata)}`
        : "";

    const section = [
      `[${memory.type}]`,
      memory.key ? `Key: ${memory.key}` : null,
      `Importance: ${memory.importance.toFixed(2)}`,
      memory.content,
      metadata,
    ]
      .filter(Boolean)
      .join("\n");

    const nextSize = total + section.length + 2;

    if (nextSize > maxCharacters) {
      break;
    }

    sections.push(section);
    total = nextSize;
  }

  return sections.join("\n\n---\n\n");
}

/**
 * Retrieve and format memory in one operation.
 */
export async function buildMemoryContext(
  query: MemoryQuery,
  options?: {
    maxCharacters?: number;
  },
): Promise<MemoryContext> {
  const memories = await getMemories(query);

  return {
    memories,
    text: formatMemoryContext(memories, options),
  };
}

/**
 * Convenience helper for recording an agent observation.
 */
export async function rememberObservation(
  projectId: string,
  content: string,
  options?: {
    agentId?: string;
    runId?: string;
    importance?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<AgentMemory> {
  return createMemory({
    projectId,
    agentId: options?.agentId,
    runId: options?.runId,
    type: "observation",
    content,
    importance: options?.importance ?? 0.5,
    metadata: options?.metadata,
  });
}

/**
 * Convenience helper for recording an agent decision.
 */
export async function rememberDecision(
  projectId: string,
  content: string,
  options?: {
    agentId?: string;
    runId?: string;
    key?: string;
    importance?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<AgentMemory> {
  return createMemory({
    projectId,
    agentId: options?.agentId,
    runId: options?.runId,
    type: "decision",
    key: options?.key,
    content,
    importance: options?.importance ?? 0.8,
    metadata: options?.metadata,
  });
}

/**
 * Convenience helper for recording an agent error.
 */
export async function rememberError(
  projectId: string,
  content: string,
  options?: {
    agentId?: string;
    runId?: string;
    importance?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<AgentMemory> {
  return createMemory({
    projectId,
    agentId: options?.agentId,
    runId: options?.runId,
    type: "error",
    content,
    importance: options?.importance ?? 0.9,
    metadata: options?.metadata,
  });
}

/**
 * Convenience helper for storing a persistent project fact.
 *
 * If a key already exists, update it instead of creating duplicates.
 */
export async function rememberProjectFact(
  projectId: string,
  key: string,
  content: string,
  options?: {
    agentId?: string;
    importance?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<AgentMemory> {
  const existing = await getMemoryByKey(projectId, key);

  if (existing) {
    const updated = await updateMemory(projectId, existing.id, {
      content,
      importance: options?.importance ?? existing.importance,
      metadata: options?.metadata,
    });

    if (updated) {
      return updated;
    }
  }

  return createMemory({
    projectId,
    agentId: options?.agentId,
    type: "context",
    key,
    content,
    importance: options?.importance ?? 0.8,
    metadata: options?.metadata,
  });
}

/**
 * Remove low-value memories.
 *
 * Useful as a maintenance operation once projects accumulate
 * large numbers of transient observations.
 */
export async function pruneMemories(
  projectId: string,
  options?: {
    maxAgeDays?: number;
    maxImportance?: number;
    limit?: number;
  },
): Promise<number> {
  const maxAgeDays = Math.max(1, options?.maxAgeDays ?? 30);
  const maxImportance = clampImportance(
    options?.maxImportance ?? 0.2,
  );

  const cutoff = new Date(
    Date.now() - maxAgeDays * 24 * 60 * 60 * 1_000,
  );

  const result = await db.agentMemory.deleteMany({
    where: {
      projectId: projectId.trim(),
      importance: {
        lte: maxImportance,
      },
      updatedAt: {
        lt: cutoff,
      },
      ...(options?.limit
        ? {
            id: {
              in: (
                await db.agentMemory.findMany({
                  where: {
                    projectId: projectId.trim(),
                    importance: {
                      lte: maxImportance,
                    },
                    updatedAt: {
                      lt: cutoff,
                    },
                  },
                  select: {
                    id: true,
                  },
                  orderBy: {
                    updatedAt: "asc",
                  },
                  take: Math.max(1, Math.floor(options.limit)),
                })
              ).map((item) => item.id),
            },
          }
        : {}),
    },
  });

  return result.count;
}

/**
 * Default memory service.
 *
 * This provides a clean object-oriented interface for the orchestrator
 * while retaining the standalone functions above for simple imports.
 */
export const agentMemory = {
  create: createMemory,
  createMany: createMemories,
  get: getMemory,
  getByKey: getMemoryByKey,
  list: getMemories,
  recent: getRecentMemories,
  update: updateMemory,
  delete: deleteMemory,
  deleteRun: deleteRunMemories,
  buildContext: buildMemoryContext,
  formatContext: formatMemoryContext,
  observation: rememberObservation,
  decision: rememberDecision,
  error: rememberError,
  projectFact: rememberProjectFact,
  prune: pruneMemories,
};

export default agentMemory;
