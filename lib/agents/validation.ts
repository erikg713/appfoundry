// lib/agents/validation.ts

import { AgentValidationError } from "./errors";

const MAX_PROMPT_LENGTH = 100_000;
const MAX_ID_LENGTH = 128;

function validateId(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new AgentValidationError(`${field} must be a string`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new AgentValidationError(`${field} is required`);
  }

  if (normalized.length > MAX_ID_LENGTH) {
    throw new AgentValidationError(
      `${field} exceeds the maximum allowed length`,
    );
  }

  return normalized;
}

export function validateAgentRunId(value: unknown): string {
  return validateId(value, "agentRunId");
}

export function validateProjectId(value: unknown): string {
  return validateId(value, "projectId");
}

export function validateProjectVersionId(value: unknown): string {
  return validateId(value, "projectVersionId");
}

export function validateAgentInput(value: unknown): string {
  if (typeof value !== "string") {
    throw new AgentValidationError("prompt must be a string");
  }

  const prompt = value.trim();

  if (!prompt) {
    throw new AgentValidationError("prompt cannot be empty");
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new AgentValidationError(
      `prompt exceeds ${MAX_PROMPT_LENGTH.toLocaleString()} characters`,
    );
  }

  return prompt;
}
