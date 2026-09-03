// lib/agents/utils.ts

import { createHash } from "node:crypto";

export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

export function createRunIdempotencyKey(
  userId: string,
  projectId: string | undefined,
  prompt: string,
): string {
  return createHash("sha256")
    .update(userId)
    .update("\0")
    .update(projectId ?? "")
    .update("\0")
    .update(prompt.trim())
    .digest("hex");
}

export function safeJsonParse<T = unknown>(
  value: string,
  fallback: T,
): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function serializeAgentError(error: unknown): {
  name: string;
  message: string;
  code?: string;
  stack?: string;
} {
  if (error instanceof Error) {
    const result: {
      name: string;
      message: string;
      code?: string;
      stack?: string;
    } = {
      name: error.name,
      message: error.message,
    };

    if ("code" in error && typeof error.code === "string") {
      result.code = error.code;
    }

    if (process.env.NODE_ENV !== "production" && error.stack) {
      result.stack = error.stack;
    }

    return result;
  }

  return {
    name: "UnknownError",
    message: typeof error === "string"
      ? error
      : "An unknown agent error occurred",
  };
}
