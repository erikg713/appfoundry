"use server";

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
 * Real agent orchestration can later replace the simulation path.
 */
export async function startGeneration(input: z.infer<typeof startSchema>) {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
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

/**
 * Advance the simulation by one step.
 * In production this would be driven by real agent callbacks / a job queue.
 */
export async function advanceGeneration(runId: string) {
  const run = await prisma.generationRun.findUnique({
    where: { id: runId },
    include: {
      steps: { orderBy: { order: "asc" } },
      project: true,
    },
  });

  if (!run) {
    return { error: "Run not found" };
  }

  await assertProjectAccess(run.projectId);

  if (run.status !== "running") {
    return { data: run };
  }

  const currentIdx = run.steps.findIndex((s) => s.status === "running");
  if (currentIdx === -1) {
    // All done or stuck — mark completed
    const updated = await finalizeRun(run.id, run.projectId, "completed");
    return { data: updated };
  }

  const current = run.steps[currentIdx];
  const next = run.steps[currentIdx + 1];

  await prisma.$transaction(async (tx) => {
    await tx.generationStep.update({
      where: { id: current.id },
      data: { status: "completed" },
    });

    if (next) {
      await tx.generationStep.update({
        where: { id: next.id },
        data: { status: "running" },
      });
    } else {
      // Last step finished — create sample artifacts and complete
      await tx.generatedFile.createMany({
        data: sampleFiles(run.id, run.prompt),
      });
      await tx.generationRun.update({
        where: { id: run.id },
        data: {
          status: "completed",
          completedAt: new Date(),
        },
      });
      await tx.project.update({
        where: { id: run.projectId },
        data: { status: "ready" },
      });
    }
  });

  const refreshed = await prisma.generationRun.findUnique({
    where: { id: runId },
    include: {
      steps: { orderBy: { order: "asc" } },
      files: { orderBy: { path: "asc" } },
    },
  });

  revalidatePath(`/dashboard/projects/${run.projectId}`);
  return { data: refreshed };
}

async function finalizeRun(
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
        status: status === "completed" ? "ready" : status === "failed" ? "error" : "draft",
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

function sampleFiles(runId: string, prompt: string) {
  const short = prompt.slice(0, 80).replace(/\n/g, " ");
  return [
    {
      runId,
      path: "README.md",
      language: "markdown",
      content: `# Generated Application\n\n> Prompt: ${short}\n\nThis project was scaffolded by AppFoundry multi-agent pipeline.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
      size: 180,
    },
    {
      runId,
      path: "package.json",
      language: "json",
      content: JSON.stringify(
        {
          name: "generated-app",
          version: "0.1.0",
          private: true,
          scripts: {
            dev: "next dev",
            build: "next build",
            start: "next start",
          },
          dependencies: {
            next: "^15.0.0",
            react: "^19.0.0",
            "react-dom": "^19.0.0",
          },
        },
        null,
        2
      ),
      size: 280,
    },
    {
      runId,
      path: "app/page.tsx",
      language: "typescript",
      content: `export default function HomePage() {\n  return (\n    <main className="min-h-screen flex items-center justify-center p-8">\n      <div className="max-w-xl text-center space-y-4">\n        <h1 className="text-3xl font-bold tracking-tight">Your App</h1>\n        <p className="text-slate-600">\n          Generated from: ${short.replace(/`/g, "'")}\n        </p>\n      </div>\n    </main>\n  );\n}\n`,
      size: 320,
    },
    {
      runId,
      path: "app/layout.tsx",
      language: "typescript",
      content: `import type { Metadata } from "next";\nimport "./globals.css";\n\nexport const metadata: Metadata = {\n  title: "Generated App",\n  description: "Scaffolded by AppFoundry",\n};\n\nexport default function RootLayout({\n  children,\n}: {\n  children: React.ReactNode;\n}) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  );\n}\n`,
      size: 350,
    },
  ];
}
