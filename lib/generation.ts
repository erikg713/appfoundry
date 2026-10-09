"use server";

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isGenerationConfigured } from "@/lib/openai";

const AGENTS = [
  {
    agent: "planner",
    title: "Planner",
    message: "Analyzing requirements and drafting a high-level product plan.",
  },
  {
    agent: "architect",
    title: "Architect",
    message: "Designing system architecture, data models, and API surface.",
  },
  {
    agent: "coder",
    title: "Coder",
    message: "Scaffolding the application and generating production-ready code.",
  },
  {
    agent: "tester",
    title: "Tester",
    message: "Writing tests and validating critical user flows.",
  },
  {
    agent: "deployer",
    title: "Deployer",
    message: "Preparing deployment configuration and preview environment.",
  },
] as const;

function scopeWhere(activeOrganizationId: string | null, userId: string) {
  if (activeOrganizationId) {
    return { organizationId: activeOrganizationId };
  }
  return {
    organizationId: null,
    createdById: userId,
  };
}

async function assertProjectAccess(projectId: string) {
  const { userId, activeOrganizationId } = await requireSession();
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...scopeWhere(activeOrganizationId, userId),
    },
  });
  if (!project) {
    throw new Error("Project not found or access denied");
  }
  return project;
}

const startSchema = z.object({
  projectId: z.string().min(1),
  prompt: z.string().min(1).max(5000).optional(),
});

/**
 * Start a new generation run for a project.
 * Creates the run + ordered steps and sets project status to "generating".
 * The actual agent work streams from the LLM via the SSE endpoint
 * (`/api/generation/[runId]/stream`), which the workspace UI subscribes to.
 */
export async function startGeneration(input: z.infer<typeof startSchema>) {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  if (!isGenerationConfigured()) {
    return {
      error: {
        _form: [
          "AI generation is not configured. Set OPENAI_API_KEY in the environment.",
        ],
      },
    };
  }

  const { projectId, prompt: overridePrompt } = parsed.data;
  const project = await assertProjectAccess(projectId);

  const prompt = (overridePrompt ?? project.prompt ?? "").trim();
  if (!prompt) {
    return { error: { prompt: ["A prompt is required to start generation"] } };
  }

  // Prevent concurrent runs
  const active = await prisma.generationRun.findFirst({
    where: {
      projectId,
      status: { in: ["pending", "running"] },
    },
  });
  if (active) {
    return { error: { _form: ["A generation run is already in progress"] } };
  }

  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.generationRun.create({
      data: {
        projectId,
        prompt,
        status: "running",
        startedAt: new Date(),
        steps: {
          create: AGENTS.map((a, index) => ({
            agent: a.agent,
            title: a.title,
            message: a.message,
            status: index === 0 ? "running" : "pending",
            order: index,
          })),
        },
      },
      include: {
        steps: { orderBy: { order: "asc" } },
        files: true,
      },
    });

    await tx.project.update({
      where: { id: projectId },
      data: {
        status: "generating",
        // Persist the prompt used if the project had none
        ...(project.prompt ? {} : { prompt }),
      },
    });

    return created;
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard");

  return { data: run };
}

export async function finalizeRun(
  runId: string,
  projectId: string,
  status: "completed" | "failed" | "cancelled",
  error?: string
) {
  await prisma.$transaction(async (tx) => {
    await tx.generationRun.update({
      where: { id: runId },
      data: {
        status,
        completedAt: new Date(),
        error: error ?? null,
      },
    });
    await tx.project.update({
      where: { id: projectId },
      data: {
        status:
          status === "completed"
            ? "ready"
            : status === "failed"
              ? "error"
              : "draft",
      },
    });
  });

  return prisma.generationRun.findUnique({
    where: { id: runId },
    include: {
      steps: { orderBy: { order: "asc" } },
      files: { orderBy: { path: "asc" } },
    },
  });
}

export async function cancelGeneration(runId: string) {
  const run = await prisma.generationRun.findUnique({ where: { id: runId } });
  if (!run) return { error: "Run not found" };
  await assertProjectAccess(run.projectId);

  if (!["pending", "running"].includes(run.status)) {
    return { error: "Run is not active" };
  }

  const updated = await finalizeRun(runId, run.projectId, "cancelled");
  revalidatePath(`/dashboard/projects/${run.projectId}`);
  return { data: updated };
}

export async function getLatestRun(projectId: string) {
  await assertProjectAccess(projectId);

  const run = await prisma.generationRun.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      steps: { orderBy: { order: "asc" } },
      files: { orderBy: { path: "asc" } },
    },
  });

  return run;
}

export async function getGenerationRuns(projectId: string) {
  await assertProjectAccess(projectId);

  return prisma.generationRun.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      steps: { orderBy: { order: "asc" } },
      files: { orderBy: { path: "asc" } },
    },
    take: 20,
  });
}
