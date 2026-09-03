// app/agents/orchestrator.ts

import { NextRequest, NextResponse } from "next/server";

import {
  agentRunner,
  type AgentInput,
  type AgentRunResult,
} from "@/lib/agents/runner";

import {
  AgentValidationError,
  AgentCancelledError,
  normalizeAgentError,
  serializeAgentError,
} from "@/lib/agents/errors";

import {
  agentPersistence,
} from "@/lib/agents/persistence";

// ─────────────────────────────────────────────────────────────────────────────
// AppFoundry — Agent Orchestrator
// ─────────────────────────────────────────────────────────────────────────────
// Server-side entry point for the multi-agent build pipeline.
//
// Default pipeline:
//
//   Planner
//      ↓
//   Architect
//      ↓
//   Coder
//      ↓
//   Reviewer
//      ↓
//   Tester
//      ↓
//   Deployer
//
// This module intentionally owns orchestration rather than agent logic.
// Individual agents remain independently testable.
//
// SECURITY:
//   • Never trust projectId/userId from the client.
//   • Authentication should be supplied by the application's auth layer.
//   • Do not execute arbitrary commands here.
//   • Sandbox execution belongs behind the Tester/Coder/Deployer boundary.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type OrchestratorRequest = {
  input?: AgentInput;

  /**
   * Optional project ID.
   *
   * The authenticated user's authorization against this project should be
   * checked by the application auth/data layer before execution.
   */
  projectId?: string;

  /**
   * Optional pipeline override.
   *
   * Only registered/allowlisted agents may be executed.
   */
  pipeline?: string[];

  /**
   * Arbitrary build metadata.
   */
  metadata?: Record<string, unknown>;

  /**
   * Execute only static testing when the Tester is selected.
   */
  staticOnly?: boolean;

  /**
   * Whether warnings should cause the Tester to fail.
   */
  strict?: boolean;

  /**
   * Persist AgentRun records.
   */
  persist?: boolean;

  /**
   * Stop immediately when an agent fails.
   */
  stopOnFailure?: boolean;
};

type OrchestratorResponse = {
  success: boolean;

  pipelineId?: string;

  status:
    | "completed"
    | "failed"
    | "cancelled";

  runs?: AgentRunResult[];

  finalOutput?: unknown;

  error?: ReturnType<
    typeof serializeAgentError
  >;

  metadata?: Record<string, unknown>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_PIPELINE = [
  "Planner",
  "Architect",
  "Coder",
  "Reviewer",
  "Tester",
  "Deployer",
] as const;

/**
 * Explicit allowlist prevents arbitrary registration names supplied by clients
 * from being used as an execution primitive.
 */
const ALLOWED_AGENTS = new Set(
  DEFAULT_PIPELINE,
);

const MAX_PIPELINE_LENGTH = 10;

const MAX_INPUT_KEYS = 100;

const MAX_METADATA_KEYS = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Request parsing
// ─────────────────────────────────────────────────────────────────────────────

async function parseRequest(
  request: NextRequest,
): Promise<OrchestratorRequest> {
  const contentType =
    request.headers.get(
      "content-type",
    ) ?? "";

  if (
    !contentType.includes(
      "application/json",
    )
  ) {
    throw new AgentValidationError(
      "Request Content-Type must be application/json.",
      {
        details: {
          expected:
            "application/json",
        },
      },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new AgentValidationError(
      "Request body contains invalid JSON.",
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    throw new AgentValidationError(
      "Request body must be a JSON object.",
    );
  }

  return body as OrchestratorRequest;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input validation
// ─────────────────────────────────────────────────────────────────────────────

function validateRecordSize(
  value: unknown,
  name: string,
  maxKeys: number,
): void {
  if (
    value === undefined ||
    value === null
  ) {
    return;
  }

  if (
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new AgentValidationError(
      `${name} must be an object.`,
    );
  }

  if (
    Object.keys(
      value as Record<
        string,
        unknown
      >,
    ).length > maxKeys
  ) {
    throw new AgentValidationError(
      `${name} contains too many properties.`,
      {
        details: {
          maxKeys,
        },
      },
    );
  }
}

function validatePipeline(
  pipeline: unknown,
): string[] {
  if (
    pipeline === undefined ||
    pipeline === null
  ) {
    return [
      ...DEFAULT_PIPELINE,
    ];
  }

  if (!Array.isArray(pipeline)) {
    throw new AgentValidationError(
      "pipeline must be an array of agent names.",
    );
  }

  if (
    pipeline.length === 0
  ) {
    throw new AgentValidationError(
      "pipeline cannot be empty.",
    );
  }

  if (
    pipeline.length >
    MAX_PIPELINE_LENGTH
  ) {
    throw new AgentValidationError(
      `pipeline cannot contain more than ${MAX_PIPELINE_LENGTH} agents.`,
    );
  }

  const normalized =
    pipeline.map((name) => {
      if (
        typeof name !==
        "string"
      ) {
        throw new AgentValidationError(
          "Every pipeline agent name must be a string.",
        );
      }

      const normalizedName =
        name.trim();

      if (!normalizedName) {
        throw new AgentValidationError(
          "Pipeline contains an empty agent name.",
        );
      }

      if (
        !ALLOWED_AGENTS.has(
          normalizedName,
        )
      ) {
        throw new AgentValidationError(
          `Agent "${normalizedName}" is not allowed in the public orchestrator.`,
          {
            details: {
              allowedAgents:
                [
                  ...ALLOWED_AGENTS,
                ],
            },
          },
        );
      }

      return normalizedName;
    });

  return normalized;
}

function validateInput(
  input: unknown,
): AgentInput {
  validateRecordSize(
    input,
    "input",
    MAX_INPUT_KEYS,
  );

  if (
    input === undefined ||
    input === null
  ) {
    return {};
  }

  return input as AgentInput;
}

function validateMetadata(
  metadata: unknown,
): Record<string, unknown> {
  validateRecordSize(
    metadata,
    "metadata",
    MAX_METADATA_KEYS,
  );

  if (
    metadata === undefined ||
    metadata === null
  ) {
    return {};
  }

  return metadata as Record<
    string,
    unknown
  >;
}

// ─────────────────────────────────────────────────────────────────────────────
// Authentication
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Replace this with the application's canonical server-side auth lookup.
 *
 * Keeping authentication behind one function prevents the orchestrator from
 * accidentally trusting client-supplied user IDs.
 */
async function getAuthenticatedUser(
  _request: NextRequest,
): Promise<{
  id: string;
} | null> {
  // Integrate with the existing AppFoundry auth provider here.
  //
  // Example:
  //
  // const supabase = await createServerClient();
  // const {
  //   data: { user },
  // } = await supabase.auth.getUser();
  //
  // return user
  //   ? { id: user.id }
  //   : null;

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Authorization
// ─────────────────────────────────────────────────────────────────────────────

async function authorizeProject(
  userId: string,
  projectId?: string,
): Promise<void> {
  if (!projectId) {
    return;
  }

  // Replace this with the application's project authorization query.
  //
  // The important security property is:
  //
  //   userId → project ownership/access → execution
  //
  // Never:
  //
  //   client projectId → execution
  //
  void userId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent registration
// ─────────────────────────────────────────────────────────────────────────────

async function ensureAgentsRegistered(): Promise<void> {
  /**
   * This function is intentionally idempotent.
   *
   * Agent modules can be imported and registered here without requiring
   * registration during module evaluation.
   *
   * Dynamic imports also prevent unnecessary initialization when this module
   * is imported by tooling.
   */

  const [
    plannerModule,
    architectModule,
    coderModule,
    reviewerModule,
    testerModule,
    deployerModule,
  ] = await Promise.all([
    import("@/lib/agents/planner"),
    import("@/lib/agents/architect"),
    import("@/lib/agents/coder"),
    import("@/lib/agents/reviewer"),
    import("@/lib/agents/tester"),
    import("@/lib/agents/deployer"),
  ]);

  const agents = [
    plannerModule.default ??
      plannerModule.plannerAgent,

    architectModule.default ??
      architectModule.architectAgent,

    coderModule.default ??
      coderModule.coderAgent,

    reviewerModule.default ??
      reviewerModule.reviewerAgent,

    testerModule.default ??
      testerModule.testerAgent,

    deployerModule.default ??
      deployerModule.deployerAgent,
  ];

  for (const agent of agents) {
    if (
      !agent ||
      typeof agent !==
        "object"
    ) {
      continue;
    }

    if (
      !agentRunner.has(
        agent.name,
      )
    ) {
      agentRunner.register(
        agent,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Input preparation
// ─────────────────────────────────────────────────────────────────────────────

function buildPipelineInput(
  request: OrchestratorRequest,
): AgentInput {
  return {
    ...(request.input ?? {}),

    ...(request.staticOnly !==
    undefined
      ? {
          staticOnly:
            request.staticOnly,
        }
      : {}),

    ...(request.strict !==
    undefined
      ? {
          strict:
            request.strict,
        }
      : {}),

    orchestration: {
      source: "app/agents/orchestrator",
      version: 1,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /agents/orchestrator
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
): Promise<
  NextResponse<OrchestratorResponse>
> {
  const startedAt =
    Date.now();

  let user:
    | {
        id: string;
      }
    | null = null;

  try {
    // ───────────────────────────────────────────────────────────────────────
    // Authentication
    // ───────────────────────────────────────────────────────────────────────

    user =
      await getAuthenticatedUser(
        request,
      );

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          status: "failed",
          error: {
            name:
              "AuthenticationError",
            message:
              "Authentication is required.",
            code:
              "AUTHENTICATION_REQUIRED",
            statusCode: 401,
            retryable: false,
          },
        },
        {
          status: 401,
        },
      );
    }

    // ───────────────────────────────────────────────────────────────────────
    // Parse / validate
    // ───────────────────────────────────────────────────────────────────────

    const body =
      await parseRequest(
        request,
      );

    const pipeline =
      validatePipeline(
        body.pipeline,
      );

    const input =
      validateInput(
        body.input,
      );

    const metadata =
      validateMetadata(
        body.metadata,
      );

    await authorizeProject(
      user.id,
      body.projectId,
    );

    // ───────────────────────────────────────────────────────────────────────
    // Ensure agent registry is ready
    // ───────────────────────────────────────────────────────────────────────

    await ensureAgentsRegistered();

    // ───────────────────────────────────────────────────────────────────────
    // Verify every requested agent actually registered
    // ───────────────────────────────────────────────────────────────────────

    for (const agentName of pipeline) {
      if (
        !agentRunner.has(
          agentName,
        )
      ) {
        throw new AgentValidationError(
          `Agent "${agentName}" is not currently available.`,
          {
            agentName,
          },
        );
      }
    }

    // ───────────────────────────────────────────────────────────────────────
    // Execute
    // ───────────────────────────────────────────────────────────────────────

    const pipelineResult =
      await agentRunner.runPipeline(
        pipeline,
        {
          projectId:
            body.projectId,

          userId:
            user.id,

          input:
            buildPipelineInput(
              {
                ...body,
                input,
              },
            ),

          metadata: {
            ...metadata,
            requestedPipeline:
              pipeline,
          },

          persist:
            body.persist !==
            false,

          stopOnFailure:
            body.stopOnFailure ??
            true,

          signal:
            request.signal,

          onProgress:
            async (
              agent,
              progress,
              message,
            ) => {
              // Server-side progress logging.
              //
              // A websocket/SSE event publisher can be connected here later.
              console.info(
                "[AgentOrchestrator]",
                {
                  agent,
                  progress,
                  message,
                },
              );
            },
        },
      );

    const response: OrchestratorResponse =
      {
        success:
          pipelineResult.status ===
          "completed",

        pipelineId:
          pipelineResult.pipelineId,

        status:
          pipelineResult.status,

        runs:
          pipelineResult.runs,

        finalOutput:
          pipelineResult.finalOutput,

        metadata: {
          durationMs:
            pipelineResult.durationMs,

          serverDurationMs:
            Date.now() -
            startedAt,

          pipeline,
        },
      };

    const statusCode =
      pipelineResult.status ===
      "completed"
        ? 200
        : pipelineResult.status ===
            "cancelled"
          ? 499
          : 422;

    return NextResponse.json(
      response,
      {
        status: statusCode,
      },
    );
  } catch (error) {
    const normalized =
      normalizeAgentError(
        error,
      );

    const serialized =
      serializeAgentError(
        normalized,
        {
          includeStack:
            process.env
              .NODE_ENV !==
            "production",
        },
      );

    console.error(
      "[AgentOrchestrator] Execution failed:",
      serialized,
    );

    const status =
      normalized.statusCode ??
      500;

    return NextResponse.json(
      {
        success: false,
        status:
          normalized.code ===
          "AGENT_CANCELLED"
            ? "cancelled"
            : "failed",
        error: serialized,
        metadata: {
          serverDurationMs:
            Date.now() -
            startedAt,
        },
      },
      {
        status:
          status >= 400 &&
          status <= 599
            ? status
            : 500,
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /agents/orchestrator
// ─────────────────────────────────────────────────────────────────────────────
// Returns recent AgentRun records for the authenticated user.
//
// Useful for:
//   • Agent dashboard
//   • Build history
//   • Debugging
//   • Run status polling
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
): Promise<
  NextResponse<
    | {
        success: true;
        runs: unknown[];
      }
    | {
        success: false;
        error: ReturnType<
          typeof serializeAgentError
        >;
      }
  >
> {
  try {
    const user =
      await getAuthenticatedUser(
        request,
      );

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            name:
              "AuthenticationError",
            message:
              "Authentication is required.",
            code:
              "AUTHENTICATION_REQUIRED",
            statusCode: 401,
            retryable: false,
          },
        },
        {
          status: 401,
        },
      );
    }

    const url =
      new URL(
        request.url,
      );

    const projectId =
      url.searchParams.get(
        "projectId",
      ) ?? undefined;

    const agentName =
      url.searchParams.get(
        "agent",
      ) ?? undefined;

    const status =
      url.searchParams.get(
        "status",
      ) as
        | AgentRunResult["status"]
        | undefined;

    const limitRaw =
      Number(
        url.searchParams.get(
          "limit",
        ) ?? 50,
      );

    const limit = Number.isFinite(
      limitRaw,
    )
      ? Math.min(
          Math.max(
            Math.floor(limitRaw),
            1,
          ),
          100,
        )
      : 50;

    await authorizeProject(
      user.id,
      projectId,
    );

    const runs =
      await agentPersistence.list(
        {
          userId:
            user.id,

          projectId,

          agentName,

          status,

          limit,
        },
      );

    return NextResponse.json(
      {
        success: true,
        runs,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    const serialized =
      serializeAgentError(
        error,
        {
          includeStack:
            process.env
              .NODE_ENV !==
            "production",
        },
      );

    console.error(
      "[AgentOrchestrator] GET failed:",
      serialized,
    );

    return NextResponse.json(
      {
        success: false,
        error: serialized,
      },
      {
        status:
          serialized.statusCode ??
          500,
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function OPTIONS() {
  return new NextResponse(
    null,
    {
      status: 204,
      headers: {
        Allow:
          "GET, POST, OPTIONS",
      },
    },
  );
  }
