// lib/agents/context.ts

import "server-only";

import type {
  AgentType,
  AgentRunStatus,
} from "@prisma/client";

export interface AgentExecutionContext {
  runId: string;
  userId: string;
  projectId?: string;
  projectVersionId?: string;

  agent: AgentType;
  status: AgentRunStatus;

  prompt: string;

  iteration: number;
  maxIterations: number;

  signal?: AbortSignal;

  metadata: Record<string, unknown>;

  startedAt: Date;
}

export interface CreateAgentContextOptions {
  runId: string;
  userId: string;
  prompt: string;

  agent: AgentType;
  status?: AgentRunStatus;

  projectId?: string;
  projectVersionId?: string;

  iteration?: number;
  maxIterations?: number;

  signal?: AbortSignal;

  metadata?: Record<string, unknown>;
}

export function createAgentContext(
  options: CreateAgentContextOptions,
): AgentExecutionContext {
  if (!options.runId.trim()) {
    throw new Error("runId is required");
  }

  if (!options.userId.trim()) {
    throw new Error("userId is required");
  }

  if (!options.prompt.trim()) {
    throw new Error("prompt is required");
  }

  if (options.iteration !== undefined && options.iteration < 0) {
    throw new Error("iteration cannot be negative");
  }

  const maxIterations = options.maxIterations ?? 3;

  if (maxIterations < 1) {
    throw new Error("maxIterations must be at least 1");
  }

  return {
    runId: options.runId,
    userId: options.userId,
    projectId: options.projectId,
    projectVersionId: options.projectVersionId,

    agent: options.agent,
    status: options.status ?? "QUEUED",

    prompt: options.prompt,

    iteration: options.iteration ?? 0,
    maxIterations,

    signal: options.signal,

    metadata: {
      ...(options.metadata ?? {}),
    },

    startedAt: new Date(),
  };
}
