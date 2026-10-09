import { prisma } from "@/lib/db";
import { getOpenAI, GENERATION_MODEL } from "@/lib/openai";

// ---------------------------------------------------------------------------
// Agent system prompts. Each agent streams its working output to the UI;
// downstream agents receive the earlier outputs as context.
// ---------------------------------------------------------------------------

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  planner: [
    "You are the Planner agent in an AI app-building pipeline.",
    "Given the user's app idea, produce a concise product plan:",
    "target users, 6-8 user stories for the first shippable slice,",
    "explicit non-goals to keep the MVP demoable, and a milestone sequence.",
    "Keep it focused and skimmable. Do not write code.",
  ].join(" "),
  architect: [
    "You are the Architect agent in an AI app-building pipeline.",
    "Given the app idea and the Planner's output, define the technical plan:",
    "stack (assume Next.js App Router + Postgres unless the idea demands otherwise),",
    "data entities, routes/pages, API surface, and validation seams.",
    "Keep it concrete and brief. Do not write full code files.",
  ].join(" "),
  coder: [
    "You are the Coder agent in an AI app-building pipeline.",
    "Given the app idea, plan, and architecture, sketch the key source files:",
    "project layout, the main page/component, and one data-access or server-action example.",
    "Write concise but real code snippets (TypeScript/React).",
    "The full file set is generated separately — focus on the most important pieces.",
  ].join(" "),
  tester: [
    "You are the Tester agent in an AI app-building pipeline.",
    "Given the app idea and the Coder's output, produce a QA checklist:",
    "happy-path checks for the core flow, edge cases (empty, error, permission),",
    "and a mobile smoke pass. Keep it actionable and brief.",
  ].join(" "),
  deployer: [
    "You are the Deployer agent in an AI app-building pipeline.",
    "Given the app idea and everything built so far, produce a ship checklist:",
    "required environment variables, preview and production deploy steps,",
    "and a short rollback note. Keep it brief.",
  ].join(" "),
};

const FILE_MANIFEST_SYSTEM_PROMPT = [
  "You are a code generator producing the starter file set for a new app.",
  "Respond with ONLY a JSON object of the form:",
  '{"files": [{"path": "app/page.tsx", "language": "typescript", "content": "..."}]}',
  "Rules:",
  "- 4 to 10 files: README.md, package.json, and the essential source files.",
  "- Paths are relative, no leading slash.",
  "- Content must be complete and syntactically valid; keep each file focused.",
  "- language is one of: typescript, json, markdown, css.",
  "- No prose outside the JSON object.",
].join("\n");

const MAX_FILES = 10;
const MAX_FILE_CHARS = 12_000;

type GeneratedFileInput = {
  runId: string;
  path: string;
  language: string | null;
  content: string;
  size: number;
};

/** Stream one agent's output tokens from the LLM. */
async function* streamAgentOutput(
  agent: string,
  prompt: string,
  priorOutputs: { agent: string; output: string }[]
): AsyncGenerator<string> {
  const openai = getOpenAI();
  const system = AGENT_SYSTEM_PROMPTS[agent] ?? `You are the ${agent} agent in an AI app-building pipeline.`;

  const context =
    priorOutputs.length > 0
      ? "\n\nEarlier agents produced:\n" +
        priorOutputs
          .map((p) => `## ${p.agent}\n${p.output.slice(0, 4000)}`)
          .join("\n\n")
      : "";

  const stream = await openai.chat.completions.create({
    model: GENERATION_MODEL,
    temperature: 0.7,
    max_tokens: 1500,
    stream: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `App idea:\n${prompt}${context}` },
    ],
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

/** Generate the scaffold file set for a run via a structured JSON call. */
async function generateFiles(
  runId: string,
  prompt: string,
  summary: string
): Promise<GeneratedFileInput[]> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: GENERATION_MODEL,
    temperature: 0.5,
    max_tokens: 6000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: FILE_MANIFEST_SYSTEM_PROMPT },
      {
        role: "user",
        content: `App idea:\n${prompt}\n\nBuild summary:\n${summary.slice(0, 6000)}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("File generation returned invalid JSON");
  }

  const files = (parsed as { files?: unknown }).files;
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("File generation returned no files");
  }

  const cleaned: Omit<GeneratedFileInput, "runId">[] = [];
  const seen = new Set<string>();
  for (const f of files.slice(0, MAX_FILES)) {
    const entry = f as { path?: unknown; language?: unknown; content?: unknown };
    const path =
      typeof entry.path === "string"
        ? entry.path.replace(/^\/+/, "").trim()
        : "";
    const content = typeof entry.content === "string" ? entry.content : "";
    if (!path || !content || seen.has(path)) continue;
    // Basic path hygiene: no escapes, no absolute paths
    if (path.includes("..") || path.length > 200) continue;
    seen.add(path);
    const language =
      typeof entry.language === "string" ? entry.language : null;
    const trimmed = content.slice(0, MAX_FILE_CHARS);
    cleaned.push({
      path,
      language,
      content: trimmed,
      size: Buffer.byteLength(trimmed, "utf8"),
    });
  }

  if (cleaned.length === 0) {
    throw new Error("File generation produced no valid files");
  }

  return cleaned.map((f) => ({ ...f, runId }));
}

export type StreamEvent =
  | {
      type: "step_start";
      stepId: string;
      agent: string;
      title: string;
      order: number;
    }
  | {
      type: "token";
      stepId: string;
      agent: string;
      text: string;
      full: string;
    }
  | {
      type: "step_done";
      stepId: string;
      agent: string;
      output: string;
    }
  | {
      type: "run_done";
      status: "completed" | "failed" | "cancelled";
      files?: { path: string; language: string | null }[];
      error?: string;
    }
  | { type: "error"; message: string };

async function markCancelled(runId: string, projectId: string, stepId?: string, output?: string) {
  if (stepId) {
    await prisma.generationStep.update({
      where: { id: stepId },
      data: { output: output ?? "", status: "running" },
    });
  }
  await prisma.generationRun.update({
    where: { id: runId },
    data: { status: "cancelled", completedAt: new Date() },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "draft" },
  });
}

async function markFailed(runId: string, projectId: string, message: string) {
  await prisma.generationRun.update({
    where: { id: runId },
    data: { status: "failed", completedAt: new Date(), error: message },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "error" },
  });
}

/**
 * Drive a generation run, streaming real LLM output per agent step and
 * persisting progress to the database. Yields SSE-friendly events consumed
 * by the generation workspace UI.
 */
export async function* streamGenerationRun(
  runId: string,
  signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
  const run = await prisma.generationRun.findUnique({
    where: { id: runId },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  if (!run) {
    yield { type: "error", message: "Run not found" };
    return;
  }

  if (run.status === "cancelled" || run.status === "completed") {
    yield { type: "run_done", status: run.status as "completed" | "cancelled" };
    return;
  }

  if (run.status !== "running" && run.status !== "pending") {
    yield { type: "error", message: `Run is ${run.status}` };
    return;
  }

  if (run.status === "pending") {
    await prisma.generationRun.update({
      where: { id: runId },
      data: { status: "running", startedAt: new Date() },
    });
  }

  const priorOutputs: { agent: string; output: string }[] = [];

  for (const step of run.steps) {
    if (signal?.aborted) {
      await markCancelled(runId, run.projectId);
      yield { type: "run_done", status: "cancelled" };
      return;
    }

    // Skip already completed steps (resume safety)
    if (step.status === "completed") {
      if (step.output) priorOutputs.push({ agent: step.agent, output: step.output });
      continue;
    }

    await prisma.generationStep.update({
      where: { id: step.id },
      data: { status: "running", output: "" },
    });

    yield {
      type: "step_start",
      stepId: step.id,
      agent: step.agent,
      title: step.title,
      order: step.order,
    };

    let full = "";
    let lastPersisted = 0;

    try {
      for await (const token of streamAgentOutput(step.agent, run.prompt, priorOutputs)) {
        if (signal?.aborted) break;
        full += token;
        yield {
          type: "token",
          stepId: step.id,
          agent: step.agent,
          text: token,
          full,
        };
        // Persist periodically so a dropped stream still leaves progress
        if (full.length - lastPersisted > 500) {
          lastPersisted = full.length;
          await prisma.generationStep.update({
            where: { id: step.id },
            data: { output: full },
          });
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "AI generation failed";
      await prisma.generationStep.update({
        where: { id: step.id },
        data: { status: "failed", output: full },
      });
      await markFailed(runId, run.projectId, `${step.title}: ${message}`);
      yield { type: "error", message: `${step.title} failed: ${message}` };
      yield { type: "run_done", status: "failed", error: message };
      return;
    }

    if (signal?.aborted) {
      await markCancelled(runId, run.projectId, step.id, full);
      yield { type: "run_done", status: "cancelled" };
      return;
    }

    await prisma.generationStep.update({
      where: { id: step.id },
      data: { status: "completed", output: full },
    });

    priorOutputs.push({ agent: step.agent, output: full });

    yield {
      type: "step_done",
      stepId: step.id,
      agent: step.agent,
      output: full,
    };
  }

  // Generate the scaffold file set from the accumulated outputs
  let files: { path: string; language: string | null }[] = [];
  try {
    const summary = priorOutputs
      .map((p) => `## ${p.agent}\n${p.output}`)
      .join("\n\n");
    const generated = await generateFiles(runId, run.prompt, summary);
    await prisma.$transaction(async (tx) => {
      await tx.generatedFile.deleteMany({ where: { runId } });
      await tx.generatedFile.createMany({
        data: generated.map((f) => ({
          runId,
          path: f.path,
          language: f.language,
          content: f.content,
          size: f.size,
        })),
      });
      await tx.generationRun.update({
        where: { id: runId },
        data: { status: "completed", completedAt: new Date() },
      });
      await tx.project.update({
        where: { id: run.projectId },
        data: { status: "ready" },
      });
    });
    files = generated.map((f) => ({ path: f.path, language: f.language }));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "File generation failed";
    // The agent narrative still completed — surface files as failed but keep the run's work.
    await markFailed(runId, run.projectId, `File scaffolding failed: ${message}`);
    yield { type: "error", message: `File scaffolding failed: ${message}` };
    yield { type: "run_done", status: "failed", error: message };
    return;
  }

  yield {
    type: "run_done",
    status: "completed",
    files,
  };
}
