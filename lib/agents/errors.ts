// lib/agents/errors.ts

// ─────────────────────────────────────────────────────────────────────────────
// AppFoundry — Agent Error System
// ─────────────────────────────────────────────────────────────────────────────
// Centralized error types for the agent execution layer.
//
// Design goals:
//   • Consistent machine-readable error codes
//   • Safe serialization for API responses / AgentRun persistence
//   • Preserve original causes without leaking secrets
//   • Distinguish validation, execution, timeout, cancellation,
//     dependency, and pipeline failures
//   • Compatible with lib/agents/runner.ts
// ─────────────────────────────────────────────────────────────────────────────

export const AGENT_ERROR_CODES = {
  UNKNOWN: "AGENT_UNKNOWN_ERROR",

  INVALID_AGENT: "AGENT_INVALID",
  AGENT_NOT_FOUND: "AGENT_NOT_FOUND",
  AGENT_ALREADY_REGISTERED: "AGENT_ALREADY_REGISTERED",
  INVALID_HANDLER: "AGENT_INVALID_HANDLER",

  INVALID_INPUT: "AGENT_INVALID_INPUT",
  INVALID_OUTPUT: "AGENT_INVALID_OUTPUT",

  EXECUTION_FAILED: "AGENT_EXECUTION_FAILED",
  TIMEOUT: "AGENT_TIMEOUT",
  CANCELLED: "AGENT_CANCELLED",

  PIPELINE_FAILED: "AGENT_PIPELINE_FAILED",
  PIPELINE_EMPTY: "AGENT_PIPELINE_EMPTY",
  PIPELINE_INVALID: "AGENT_PIPELINE_INVALID",

  DATABASE_ERROR: "AGENT_DATABASE_ERROR",
  PERSISTENCE_ERROR: "AGENT_PERSISTENCE_ERROR",

  DEPENDENCY_ERROR: "AGENT_DEPENDENCY_ERROR",
  RATE_LIMITED: "AGENT_RATE_LIMITED",

  PERMISSION_DENIED: "AGENT_PERMISSION_DENIED",
  CONFIGURATION_ERROR: "AGENT_CONFIGURATION_ERROR",

  NETWORK_ERROR: "AGENT_NETWORK_ERROR",
  PROVIDER_ERROR: "AGENT_PROVIDER_ERROR",

  ABORTED: "AGENT_ABORTED",
} as const;

export type AgentErrorCode =
  (typeof AGENT_ERROR_CODES)[keyof typeof AGENT_ERROR_CODES];

// ─────────────────────────────────────────────────────────────────────────────
// Serialized error
// ─────────────────────────────────────────────────────────────────────────────

export type SerializedAgentError = {
  name: string;
  message: string;
  code: AgentErrorCode | string;

  agentName?: string;
  runId?: string;
  pipelineId?: string;

  statusCode?: number;
  retryable?: boolean;

  details?: Record<string, unknown>;

  /**
   * Stack traces should normally only be exposed in development.
   */
  stack?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Base AgentError
// ─────────────────────────────────────────────────────────────────────────────

export class AgentError extends Error {
  readonly code: AgentErrorCode | string;
  readonly agentName?: string;
  readonly runId?: string;
  readonly pipelineId?: string;
  readonly statusCode?: number;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      code?: AgentErrorCode | string;
      agentName?: string;
      runId?: string;
      pipelineId?: string;
      statusCode?: number;
      retryable?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
    } = {},
  ) {
    super(message);

    this.name = "AgentError";

    this.code =
      options.code ??
      AGENT_ERROR_CODES.UNKNOWN;

    this.agentName = options.agentName;
    this.runId = options.runId;
    this.pipelineId = options.pipelineId;
    this.statusCode = options.statusCode;
    this.retryable =
      options.retryable ?? false;
    this.details = options.details;

    if (options.cause !== undefined) {
      Object.defineProperty(this, "cause", {
        value: options.cause,
        enumerable: false,
        configurable: true,
      });
    }

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }

  /**
   * Convert the error into a safe object suitable for:
   *   • API responses
   *   • database persistence
   *   • logging
   *   • UI error handling
   */
  toJSON(
    includeStack = process.env.NODE_ENV !== "production",
  ): SerializedAgentError {
    const serialized: SerializedAgentError = {
      name: this.name,
      message: this.message,
      code: this.code,
      agentName: this.agentName,
      runId: this.runId,
      pipelineId: this.pipelineId,
      statusCode: this.statusCode,
      retryable: this.retryable,
      details: this.details,
    };

    if (includeStack && this.stack) {
      serialized.stack = this.stack;
    }

    return serialized;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

export class AgentValidationError extends AgentError {
  constructor(
    message: string,
    options: {
      agentName?: string;
      runId?: string;
      details?: Record<string, unknown>;
    } = {},
  ) {
    super(message, {
      ...options,
      code: AGENT_ERROR_CODES.INVALID_INPUT,
      statusCode: 400,
      retryable: false,
    });

    this.name = "AgentValidationError";
  }
}

export class AgentOutputError extends AgentError {
  constructor(
    message: string,
    options: {
      agentName?: string;
      runId?: string;
      details?: Record<string, unknown>;
    } = {},
  ) {
    super(message, {
      ...options,
      code: AGENT_ERROR_CODES.INVALID_OUTPUT,
      statusCode: 500,
      retryable: false,
    });

    this.name = "AgentOutputError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent registration
// ─────────────────────────────────────────────────────────────────────────────

export class AgentNotFoundError extends AgentError {
  constructor(agentName: string) {
    super(
      `Agent "${agentName}" is not registered.`,
      {
        code: AGENT_ERROR_CODES.AGENT_NOT_FOUND,
        agentName,
        statusCode: 404,
        retryable: false,
      },
    );

    this.name = "AgentNotFoundError";
  }
}

export class AgentAlreadyRegisteredError
  extends AgentError
{
  constructor(agentName: string) {
    super(
      `Agent "${agentName}" is already registered.`,
      {
        code:
          AGENT_ERROR_CODES.AGENT_ALREADY_REGISTERED,
        agentName,
        statusCode: 409,
        retryable: false,
      },
    );

    this.name =
      "AgentAlreadyRegisteredError";
  }
}

export class InvalidAgentError extends AgentError {
  constructor(
    message: string,
    agentName?: string,
  ) {
    super(message, {
      code: AGENT_ERROR_CODES.INVALID_AGENT,
      agentName,
      statusCode: 400,
      retryable: false,
    });

    this.name = "InvalidAgentError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Execution errors
// ─────────────────────────────────────────────────────────────────────────────

export class AgentExecutionError extends AgentError {
  constructor(
    message: string,
    options: {
      agentName?: string;
      runId?: string;
      cause?: unknown;
      retryable?: boolean;
      details?: Record<string, unknown>;
    } = {},
  ) {
    super(message, {
      ...options,
      code:
        AGENT_ERROR_CODES.EXECUTION_FAILED,
      statusCode: 500,
      retryable:
        options.retryable ?? true,
    });

    this.name = "AgentExecutionError";
  }
}

export class AgentTimeoutError extends AgentError {
  readonly timeoutMs: number;

  constructor(
    agentName: string,
    timeoutMs: number,
    runId?: string,
  ) {
    super(
      `Agent "${agentName}" exceeded its ${timeoutMs}ms execution timeout.`,
      {
        code: AGENT_ERROR_CODES.TIMEOUT,
        agentName,
        runId,
        statusCode: 504,
        retryable: true,
        details: {
          timeoutMs,
        },
      },
    );

    this.name = "AgentTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class AgentCancelledError
  extends AgentError
{
  constructor(
    agentName?: string,
    runId?: string,
  ) {
    super(
      agentName
        ? `Agent "${agentName}" execution was cancelled.`
        : "Agent execution was cancelled.",
      {
        code: AGENT_ERROR_CODES.CANCELLED,
        agentName,
        runId,
        statusCode: 499,
        retryable: false,
      },
    );

    this.name = "AgentCancelledError";
  }
}

export class AgentAbortedError extends AgentError {
  constructor(
    agentName?: string,
    runId?: string,
  ) {
    super(
      "Agent execution was aborted.",
      {
        code: AGENT_ERROR_CODES.ABORTED,
        agentName,
        runId,
        statusCode: 499,
        retryable: false,
      },
    );

    this.name = "AgentAbortedError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline errors
// ─────────────────────────────────────────────────────────────────────────────

export class AgentPipelineError extends AgentError {
  readonly failedAgent?: string;

  constructor(
    message: string,
    options: {
      pipelineId?: string;
      failedAgent?: string;
      runId?: string;
      cause?: unknown;
      details?: Record<string, unknown>;
      retryable?: boolean;
    } = {},
  ) {
    super(message, {
      ...options,
      code:
        AGENT_ERROR_CODES.PIPELINE_FAILED,
      statusCode: 500,
      retryable:
        options.retryable ?? false,
    });

    this.name = "AgentPipelineError";
    this.failedAgent = options.failedAgent;
  }
}

export class EmptyPipelineError
  extends AgentPipelineError
{
  constructor() {
    super(
      "Agent pipeline must contain at least one agent.",
      {
        details: {
          reason: "empty_pipeline",
        },
      },
    );

    this.name = "EmptyPipelineError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider / dependency errors
// ─────────────────────────────────────────────────────────────────────────────

export class AgentDependencyError
  extends AgentError
{
  readonly dependency: string;

  constructor(
    dependency: string,
    message?: string,
    options: {
      agentName?: string;
      runId?: string;
      cause?: unknown;
      retryable?: boolean;
    } = {},
  ) {
    super(
      message ??
        `Agent dependency "${dependency}" is unavailable.`,
      {
        ...options,
        code:
          AGENT_ERROR_CODES.DEPENDENCY_ERROR,
        statusCode: 503,
        retryable:
          options.retryable ?? true,
        details: {
          dependency,
        },
      },
    );

    this.name = "AgentDependencyError";
    this.dependency = dependency;
  }
}

export class AgentProviderError
  extends AgentError
{
  constructor(
    provider: string,
    message: string,
    options: {
      agentName?: string;
      runId?: string;
      retryable?: boolean;
      cause?: unknown;
      details?: Record<string, unknown>;
    } = {},
  ) {
    super(message, {
      ...options,
      code:
        AGENT_ERROR_CODES.PROVIDER_ERROR,
      statusCode: 502,
      retryable:
        options.retryable ?? true,
      details: {
        provider,
        ...options.details,
      },
    });

    this.name = "AgentProviderError";
  }
}

export class AgentRateLimitError
  extends AgentError
{
  readonly retryAfterMs?: number;

  constructor(
    message = "Agent provider rate limit exceeded.",
    options: {
      agentName?: string;
      runId?: string;
      retryAfterMs?: number;
    } = {},
  ) {
    super(message, {
      code:
        AGENT_ERROR_CODES.RATE_LIMITED,
      agentName: options.agentName,
      runId: options.runId,
      statusCode: 429,
      retryable: true,
      details: {
        retryAfterMs:
          options.retryAfterMs,
      },
    });

    this.name = "AgentRateLimitError";
    this.retryAfterMs =
      options.retryAfterMs;
  }
}

export class AgentNetworkError
  extends AgentError
{
  constructor(
    message = "Agent network request failed.",
    options: {
      agentName?: string;
      runId?: string;
      cause?: unknown;
      details?: Record<string, unknown>;
    } = {},
  ) {
    super(message, {
      ...options,
      code:
        AGENT_ERROR_CODES.NETWORK_ERROR,
      statusCode: 503,
      retryable: true,
    });

    this.name = "AgentNetworkError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Database / persistence errors
// ─────────────────────────────────────────────────────────────────────────────

export class AgentDatabaseError
  extends AgentError
{
  constructor(
    message: string,
    options: {
      agentName?: string;
      runId?: string;
      cause?: unknown;
      retryable?: boolean;
      details?: Record<string, unknown>;
    } = {},
  ) {
    super(message, {
      ...options,
      code:
        AGENT_ERROR_CODES.DATABASE_ERROR,
      statusCode: 503,
      retryable:
        options.retryable ?? true,
    });

    this.name = "AgentDatabaseError";
  }
}

export class AgentPersistenceError
  extends AgentError
{
  constructor(
    message: string,
    options: {
      runId?: string;
      cause?: unknown;
      details?: Record<string, unknown>;
    } = {},
  ) {
    super(message, {
      ...options,
      code:
        AGENT_ERROR_CODES.PERSISTENCE_ERROR,
      statusCode: 500,
      retryable: true,
    });

    this.name = "AgentPersistenceError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission / configuration
// ─────────────────────────────────────────────────────────────────────────────

export class AgentPermissionError
  extends AgentError
{
  constructor(
    message = "Agent is not permitted to perform this operation.",
    options: {
      agentName?: string;
      userId?: string;
      details?: Record<string, unknown>;
    } = {},
  ) {
    super(message, {
      code:
        AGENT_ERROR_CODES.PERMISSION_DENIED,
      agentName: options.agentName,
      statusCode: 403,
      retryable: false,
      details: {
        // Deliberately do not store userId.
        ...options.details,
      },
    });

    this.name = "AgentPermissionError";
  }
}

export class AgentConfigurationError
  extends AgentError
{
  constructor(
    message: string,
    options: {
      agentName?: string;
      details?: Record<string, unknown>;
    } = {},
  ) {
    super(message, {
      ...options,
      code:
        AGENT_ERROR_CODES.CONFIGURATION_ERROR,
      statusCode: 500,
      retryable: false,
    });

    this.name = "AgentConfigurationError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversion / normalization helpers
// ─────────────────────────────────────────────────────────────────────────────

export function isAgentError(
  error: unknown,
): error is AgentError {
  return (
    error instanceof AgentError ||
    (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      "message" in error
    )
  );
}

export function normalizeAgentError(
  error: unknown,
  context: {
    agentName?: string;
    runId?: string;
    pipelineId?: string;
  } = {},
): AgentError {
  if (error instanceof AgentError) {
    return error;
  }

  if (error instanceof Error) {
    return new AgentExecutionError(
      error.message,
      {
        ...context,
        cause: error,
      },
    );
  }

  return new AgentError(
    String(error),
    {
      ...context,
      code: AGENT_ERROR_CODES.UNKNOWN,
    },
  );
}

export function serializeAgentError(
  error: unknown,
  options: {
    includeStack?: boolean;
    agentName?: string;
    runId?: string;
    pipelineId?: string;
  } = {},
): SerializedAgentError {
  const normalized =
    normalizeAgentError(error, {
      agentName:
        options.agentName,
      runId: options.runId,
      pipelineId:
        options.pipelineId,
    });

  return normalized.toJSON(
    options.includeStack ??
      process.env.NODE_ENV !==
        "production",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP status helper
// ─────────────────────────────────────────────────────────────────────────────

export function getAgentErrorStatus(
  error: unknown,
): number {
  const normalized =
    normalizeAgentError(error);

  return (
    normalized.statusCode ??
    500
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry helper
// ─────────────────────────────────────────────────────────────────────────────

export function isRetryableAgentError(
  error: unknown,
): boolean {
  const normalized =
    normalizeAgentError(error);

  return normalized.retryable;
}

// ─────────────────────────────────────────────────────────────────────────────
// Safe error message
// ─────────────────────────────────────────────────────────────────────────────

export function getSafeAgentErrorMessage(
  error: unknown,
): string {
  const normalized =
    normalizeAgentError(error);

  if (
    normalized.code ===
    AGENT_ERROR_CODES.UNKNOWN
  ) {
    return "The agent encountered an unexpected error.";
  }

  return normalized.message;
  }
