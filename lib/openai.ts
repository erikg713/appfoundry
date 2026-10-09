import OpenAI from "openai";

/**
 * Shared OpenAI client for the generation pipeline.
 *
 * Requires `OPENAI_API_KEY` at runtime. `OPENAI_MODEL` optionally overrides
 * the default model.
 */

export const GENERATION_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Set it in the environment to enable AI generation."
    );
  }
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}

/** True when generation can run (key present). Used to fail fast with a clear message. */
export function isGenerationConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
