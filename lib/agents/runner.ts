// lib/agents/runner.ts

import crypto from "node:crypto";

import { db } from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// AppFoundry — Agent Runner
// ─────────────────────────────────────────────────────────────────────────────
// Responsibilities:
//   • Execute individual agents safely
//   • Execute multi-agent pipelines
//   • Persist AgentRun records when the Prisma model is available
//   • Enforce timeouts
//   • Support cancellation via AbortSignal
//   • Normalize agent output
//   • Provide structured execution metadata
//   • Keep agent failures isolated and observable
//
// Expected agent flow:
//
//   Planner → Architect → Coder → Reviewer → Tester → Deployer
//
// The runner intentionally contains no agent-specific business logic.
// Individual agents should implement the AgentDefinition contract below.
// ─────────────────────────────────────────────────────────────────────────────

export type AgentStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out";

export type AgentInput = Record<string, unknown>;

export type AgentOutput = {
  result?: unknown;
  files?: Record<string, string>;
  artifacts?: unknown[];
  messages?: string[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AgentContext = {
  runId: string;
  projectId?: string;
  userId?: string;
  agentName: string;
  signal: AbortSignal;
  startedAt: Date;

  /**
   * Data produced by previous agents in the same pipeline.
   */
  previousResults: Record<string, AgentOutput>;

  /**
   * Shared metadata available to all agents.
   */
  metadata: Record<string, unknown>;

  /**
   * Emit structured progress information.
   */
  reportProgress: (
    progress: number,
    message?: string,
  ) => Promise<void>;
};

export type AgentHandler = (
  input: AgentInput,
  context: AgentContext,
) => Promise<AgentOutput> | AgentOutput;

export type AgentDefinition = {
  name: string;
  description?: string;
  handler: AgentHandler;

  /**
   * Maximum execution time for this agent.
   */
  timeoutMs?: number;

  /**
   * Whether a failure should stop a pipeline.
   */
  critical?: boolean;
};

export type AgentRunOptions = {
  projectId?: string;
  userId?: string;
  input?: AgentInput;
  metadata?: Record<string, unknown>;

  /**
   * Override the agent's default timeout.
   */
  timeoutMs?: number;

  /**
   * Abort execution externally.
   */
  signal?: AbortSignal;

  /**
   * Persist execution information when possible.
   */
  persist?: boolean;

  /**
   * Called whenever execution progress changes.
   */
  onProgress?: (progress: number, message?: string) => void | Promise<void>;
};

export type AgentRunResult = {
  runId: string;
  agentName: string;
  status: AgentStatus;

  output?: AgentOutput;
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
  };

  startedAt: Date;
  completedAt: Date;
  durationMs: number;

  metadata: Record<string, unknown>;
};

export type PipelineAgent = AgentDefinition & {
  enabled?: boolean;
};

export type PipelineOptions = {
  projectId?: string;
  userId?: string;
  input?: AgentInput;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
  persist?: boolean;
  stopOnFailure?: boolean;
  onProgress?: (
    agent: string,
    progress: number,
    message?: string,
  ) => void | Promise<void>;
};

export type PipelineResult = {
  pipelineId: string;
  status: "completed" | "failed" | "cancelled";
  runs: AgentRunResult[];
  finalOutput?: AgentOutput;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

const MAX_TIMEOUT_MS = 30 * 60 * 1000;

const MAX_PROGRESS = 100;

const MIN_PROGRESS = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

export class AgentRunnerError extends Error {
  readonly code: string;
  readonly agentName?: string;

  constructor(
    message: string,
    options?: {
      code?: string;
      agentName?: string;
      cause?: unknown;
    },
  ) {
    super(message);

    this.name = "AgentRunnerError";
    this.code = options?.code ?? "AGENT_RUNNER_ERROR";
    this.agentName = options?.agentName;

    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

class AgentTimeoutError extends AgentRunnerError {
  constructor(agentName: string, timeoutMs: number) {
    super(
      `Agent "${agentName}" exceeded its ${timeoutMs}ms execution timeout.`,
      {
        code: "AGENT_TIMEOUT",
        agentName,
      },
    );

    this.name = "AgentTimeoutError";
  }
}

class AgentCancelledError extends AgentRunnerError {
  constructor(agentName: string) {
    super(`Agent "${agentName}" execution was cancelled.`, {
      code: "AGENT_CANCELLED",
      agentName,
    });

    this.name = "AgentCancelledError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function createRunId(): string {
  return `run_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

function createPipelineId(): string {
  return `pipeline_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(MAX_PROGRESS, Math.max(MIN_PROGRESS, value));
}

function normalizeOutput(output: unknown): AgentOutput {
  if (output === undefined || output === null) {
    return {};
  }

  if (typeof output === "object" && !Array.isArray(output)) {
    return output as AgentOutput;
  }

  return {
    result: output,
  };
}

function serializeError(error: unknown) {
  if (error instanceof AgentRunnerError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

function getTimeout(timeoutMs?: number): number {
  const requested = timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!Number.isFinite(requested) || requested <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(requested, MAX_TIMEOUT_MS);
}

function isAbortError(error: unknown): boolean {
  if (error instanceof AgentCancelledError) {
    return true;
  }

  if (error instanceof Error) {
    return error.name === "AbortError";
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prisma persistence
// ─────────────────────────────────────────────────────────────────────────────

type AgentRunPersistence = {
  create?: (args: {
    data: Record<string, unknown>;
  }) => Promise<unknown>;

  update?: (args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<unknown>;
};

function getAgentRunModel(): AgentRunPersistence | undefined {
  const client = db as unknown as Record<string, unknown>;

  const model = client.AgentRun;

  if (!model || typeof model !== "object") {
    return undefined;
  }

  return model as AgentRunPersistence;
}

async function persistRunStart(args: {
  runId: string;
  agentName: string;
  projectId?: string;
  userId?: string;
  input: AgentInput;
  startedAt: Date;
}) {
  const model = getAgentRunModel();

  if (!model?.create) {
    return;
  }

  try {
    await model.create({
      data: {
        id: args.runId,
        agentName: args.agentName,
        projectId: args.projectId,
        userId: args.userId,
        status: "running",
        input: args.input,
        startedAt: args.startedAt,
      },
    });
  } catch (error) {
    // Persistence must never prevent an agent from running.
    console.error("[AgentRunner] Failed to persist run start:", error);
  }
}

async function persistRunCompletion(args: {
  runId: string;
  status: AgentStatus;
  output?: AgentOutput;
  error?: AgentRunResult["error"];
  completedAt: Date;
  durationMs: number;
}) {
  const model = getAgentRunModel();

  if (!model?.update) {
    return;
  }

  try {
    await model.update({
      where: {
        id: args.runId,
      },
      data: {
        status: args.status,
        output: args.output,
        error: args.error,
        completedAt: args.completedAt,
        durationMs: args.durationMs,
      },
    });
  } catch (error) {
    console.error(
      "[AgentRunner] Failed to persist run completion:",
      error,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Abort / timeout handling
// ─────────────────────────────────────────────────────────────────────────────

function createExecutionController(
  externalSignal?: AbortSignal,
): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();

  if (!externalSignal) {
    return {
      controller,
      cleanup: () => undefined,
    };
  }

  if (externalSignal.aborted) {
    controller.abort(externalSignal.reason);
  }

  const abortHandler = () => {
    controller.abort(externalSignal.reason);
  };

  externalSignal.addEventListener("abort", abortHandler, {
    once: true,
  });

  return {
    controller,
    cleanup: () => {
      externalSignal.removeEventListener("abort", abortHandler);
    },
  };
}

async function executeWithTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  agentName: string,
  externalSignal?: AbortSignal,
): Promise<T> {
  const { controller, cleanup } =
    createExecutionController(externalSignal);

  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    if (controller.signal.aborted) {
      throw new AgentCancelledError(agentName);
    }

    timeout = setTimeout(() => {
      controller.abort(
        new AgentTimeoutError(agentName, timeoutMs),
      );
    }, timeoutMs);

    const operationPromise = operation(controller.signal);

    return await Promise.race([
      operationPromise,
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener(
          "abort",
          () => {
            const reason = controller.signal.reason;

            if (reason instanceof AgentTimeoutError) {
              reject(reason);
              return;
            }

            reject(new AgentCancelledError(agentName));
          },
          { once: true },
        );
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }

    cleanup();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AgentRunner
// ─────────────────────────────────────────────────────────────────────────────

export class AgentRunner {
  private readonly agents = new Map<string, AgentDefinition>();

  /**
   * Register an agent implementation.
   */
  register(agent: AgentDefinition): this {
    if (!agent.name?.trim()) {
      throw new AgentRunnerError(
        "Agent name is required.",
        {
          code: "INVALID_AGENT_NAME",
        },
      );
    }

    if (typeof agent.handler !== "function") {
      throw new AgentRunnerError(
        `Agent "${agent.name}" does not have a valid handler.`,
        {
          code: "INVALID_AGENT_HANDLER",
          agentName: agent.name,
        },
      );
    }

    const key = agent.name.trim();

    if (this.agents.has(key)) {
      throw new AgentRunnerError(
        `Agent "${key}" is already registered.`,
        {
          code: "AGENT_ALREADY_REGISTERED",
          agentName: key,
        },
      );
    }

    this.agents.set(key, {
      ...agent,
      name: key,
    });

    return this;
  }

  /**
   * Replace an existing agent.
   */
  registerOrReplace(agent: AgentDefinition): this {
    if (!agent.name?.trim()) {
      throw new AgentRunnerError("Agent name is required.", {
        code: "INVALID_AGENT_NAME",
      });
    }

    this.agents.set(agent.name.trim(), {
      ...agent,
      name: agent.name.trim(),
    });

    return this;
  }

  /**
   * Remove an agent.
   */
  unregister(agentName: string): boolean {
    return this.agents.delete(agentName);
  }

  /**
   * Check whether an agent exists.
   */
  has(agentName: string): boolean {
    return this.agents.has(agentName);
  }

  /**
   * Retrieve a registered agent.
   */
  get(agentName: string): AgentDefinition | undefined {
    return this.agents.get(agentName);
  }

  /**
   * List registered agents.
   */
  list(): AgentDefinition[] {
    return [...this.agents.values()];
  }

  /**
   * Execute one agent.
   */
  async run(
    agentName: string,
    options: AgentRunOptions = {},
  ): Promise<AgentRunResult> {
    const agent = this.agents.get(agentName);

    if (!agent) {
      throw new AgentRunnerError(
        `Agent "${agentName}" is not registered.`,
        {
          code: "AGENT_NOT_FOUND",
          agentName,
        },
      );
    }

    const runId = createRunId();
    const startedAt = new Date();

    const input = options.input ?? {};
    const metadata = options.metadata ?? {};

    const timeoutMs = getTimeout(
      options.timeoutMs ?? agent.timeoutMs,
    );

    if (options.persist !== false) {
      await persistRunStart({
        runId,
        agentName: agent.name,
        projectId: options.projectId,
        userId: options.userId,
        input,
        startedAt,
      });
    }

    let progress = 0;

    const reportProgress = async (
      nextProgress: number,
      message?: string,
    ) => {
      progress = clampProgress(nextProgress);

      await options.onProgress?.(
        progress,
        message,
      );
    };

    try {
      await reportProgress(
        0,
        `Starting ${agent.name}...`,
      );

      const output = await executeWithTimeout(
        async (signal) => {
          const context: AgentContext = {
            runId,
            projectId: options.projectId,
            userId: options.userId,
            agentName: agent.name,
            signal,
            startedAt,
            previousResults: {},
            metadata,

            reportProgress,
          };

          return normalizeOutput(
            await agent.handler(input, context),
          );
        },
        timeoutMs,
        agent.name,
        options.signal,
      );

      const completedAt = new Date();
      const durationMs =
        completedAt.getTime() - startedAt.getTime();

      await reportProgress(
        100,
        `${agent.name} completed.`,
      );

      const result: AgentRunResult = {
        runId,
        agentName: agent.name,
        status: "completed",
        output,
        startedAt,
        completedAt,
        durationMs,
        metadata,
      };

      if (options.persist !== false) {
        await persistRunCompletion({
          runId,
          status: result.status,
          output,
          completedAt,
          durationMs,
        });
      }

      return result;
    } catch (error) {
      const completedAt = new Date();
      const durationMs =
        completedAt.getTime() - startedAt.getTime();

      let status: AgentStatus = "failed";

      if (
        error instanceof AgentTimeoutError
      ) {
        status = "timed_out";
      } else if (
        error instanceof AgentCancelledError ||
        isAbortError(error)
      ) {
        status = "cancelled";
      }

      const serialized = serializeError(error);

      const result: AgentRunResult = {
        runId,
        agentName: agent.name,
        status,
        error: serialized,
        startedAt,
        completedAt,
        durationMs,
        metadata: {
          ...metadata,
          progress,
        },
      };

      if (options.persist !== false) {
        await persistRunCompletion({
          runId,
          status,
          error: serialized,
          completedAt,
          durationMs,
        });
      }

      return result;
    }
  }

  /**
   * Execute multiple agents sequentially.
   *
   * Each agent receives the outputs generated by all preceding agents.
   */
  async runPipeline(
    agentNames: string[],
    options: PipelineOptions = {},
  ): Promise<PipelineResult> {
    const pipelineId = createPipelineId();
    const startedAt = new Date();

    if (agentNames.length === 0) {
      throw new AgentRunnerError(
        "Pipeline must contain at least one agent.",
        {
          code: "EMPTY_PIPELINE",
        },
      );
    }

    for (const agentName of agentNames) {
      if (!this.agents.has(agentName)) {
        throw new AgentRunnerError(
          `Pipeline references unknown agent "${agentName}".`,
          {
            code: "AGENT_NOT_FOUND",
            agentName,
          },
        );
      }
    }

    const runs: AgentRunResult[] = [];
    const previousResults: Record<
      string,
      AgentOutput
    > = {};

    let pipelineInput = options.input ?? {};

    try {
      for (let index = 0; index < agentNames.length; index++) {
        const agentName = agentNames[index];
        const agent = this.agents.get(agentName)!;

        if (options.signal?.aborted) {
          const completedAt = new Date();

          return {
            pipelineId,
            status: "cancelled",
            runs,
            startedAt,
            completedAt,
            durationMs:
              completedAt.getTime() -
              startedAt.getTime(),
          };
        }

        const result = await this.run(agentName, {
          projectId: options.projectId,
          userId: options.userId,
          input: pipelineInput,
          metadata: {
            ...options.metadata,
            pipelineId,
            pipelineIndex: index,
            pipelineLength: agentNames.length,
          },
          signal: options.signal,
          persist: options.persist,
          onProgress: async (
            progress,
            message,
          ) => {
            const overallProgress =
              ((index + progress / 100) /
                agentNames.length) *
              100;

            await options.onProgress?.(
              agentName,
              clampProgress(overallProgress),
              message,
            );
          },
        });

        runs.push(result);

        if (
          result.status === "completed" &&
          result.output
        ) {
          previousResults[agentName] =
            result.output;

          // Make the previous agent's result
          // available to the next agent.
          pipelineInput = {
            ...pipelineInput,
            previousAgent: {
              name: agentName,
              output: result.output,
            },
            agentResults: previousResults,
          };
        }

        const failed =
          result.status !== "completed";

        const shouldStop =
          failed &&
          (
            options.stopOnFailure !== false ||
            agent.critical === true
          );

        if (shouldStop) {
          const completedAt = new Date();

          return {
            pipelineId,
            status:
              result.status === "cancelled" ||
              result.status === "timed_out"
                ? "cancelled"
                : "failed",
            runs,
            finalOutput:
              result.output,
            startedAt,
            completedAt,
            durationMs:
              completedAt.getTime() -
              startedAt.getTime(),
          };
        }
      }

      const completedAt = new Date();
      const finalRun = runs[runs.length - 1];

      return {
        pipelineId,
        status: "completed",
        runs,
        finalOutput: finalRun?.output,
        startedAt,
        completedAt,
        durationMs:
          completedAt.getTime() -
          startedAt.getTime(),
      };
    } catch (error) {
      const completedAt = new Date();

      return {
        pipelineId,
        status: "failed",
        runs,
        startedAt,
        completedAt,
        durationMs:
          completedAt.getTime() -
          startedAt.getTime(),
      };
    }
  }

  /**
   * Execute a dynamically supplied pipeline.
   */
  async runDefinitions(
    agents: PipelineAgent[],
    options: PipelineOptions = {},
  ): Promise<PipelineResult> {
    const temporaryNames: string[] = [];

    try {
      for (const agent of agents) {
        if (!this.has(agent.name)) {
          this.register(agent);
          temporaryNames.push(agent.name);
        }
      }

      const enabledAgents = agents
        .filter(
          (agent) => agent.enabled !== false,
        )
        .map((agent) => agent.name);

      return await this.runPipeline(
        enabledAgents,
        options,
      );
    } finally {
      for (const name of temporaryNames) {
        this.unregister(name);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Default singleton
// ─────────────────────────────────────────────────────────────────────────────

export const agentRunner = new AgentRunner();

export default agentRunner;
