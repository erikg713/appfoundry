// lib/agents/index.ts
//
// AppFoundry — Agent service layer
//
// This module is the public entry point for application-level agent services.
// Core agent implementations live in /agents.
//
// Architecture:
//
// UI / API
//    ↓
// lib/agents
//    ↓
// agents/
//    ↓
// AI provider / tools
//    ↓
// database
//

import "server-only";

export {
  AgentServiceError,
  AgentConfigurationError,
  AgentExecutionError,
  AgentPersistenceError,
  AgentValidationError,
} from "./errors";

export {
  createAgentContext,
  type CreateAgentContextOptions,
  type AgentExecutionContext,
} from "./context";

export {
  AgentRunner,
  createAgentRunner,
  type AgentRunnerOptions,
  type AgentRunResult,
} from "./runner";

export {
  AgentRunRepository,
  createAgentRunRepository,
  type AgentRunCreateInput,
  type AgentRunUpdateInput,
} from "./persistence";

export {
  AgentStateManager,
  createAgentStateManager,
  type AgentState,
} from "./state";

export {
  validateAgentInput,
  validateAgentRunId,
  validateProjectId,
  validateProjectVersionId,
} from "./validation";

export {
  clampProgress,
  createRunIdempotencyKey,
  safeJsonParse,
  serializeAgentError,
} from "./utils";
