import { prisma } from "@/lib/db";

/** Progressive narratives produced while each agent "thinks". */
export function agentNarrative(agent: string, prompt: string): string {
  const brief = prompt.trim().slice(0, 120).replace(/\s+/g, " ");
  const narratives: Record<string, string> = {
    planner: [
      `Reading brief: "${brief}${prompt.length > 120 ? "…" : ""}"`,
      "Extracting primary users, goals, and hard constraints.",
      "Drafting 6–8 user stories for the first shippable slice.",
      "Cutting scope that would block an MVP demo.",
      "Sequencing milestones: discover → scaffold → core flow → polish.",
      "Plan locked. Handing off to Architect.",
    ].join("\n"),
    architect: [
      "Mapping entities from the product plan.",
      "Choosing a simple stack: Next.js App Router, Postgres, server actions.",
      "Sketching routes and ownership boundaries.",
      "Defining API surface and validation seams.",
      "Architecture notes ready for Coder.",
    ].join("\n"),
    coder: [
      "Scaffolding project layout and entry routes.",
      "Generating core components for the primary user flow.",
      "Wiring server actions and data access.",
      "Writing README with install and run steps.",
      "Source sketches complete.",
    ].join("\n"),
    tester: [
      "Listing happy-path checks for the core flow.",
      "Adding empty, error, and permission edge cases.",
      "Including a 390px mobile smoke pass.",
      "QA checklist ready for Deployer.",
    ].join("\n"),
    deployer: [
      "Preparing environment variable checklist.",
      "Defining preview and production deploy steps.",
      "Writing a short ship checklist and rollback note.",
      "Release path ready. Generation complete.",
    ].join("\n"),
  };
  return narratives[agent] ?? `Working on ${agent}…`;
}

export function chunkText(text: string, size = 12): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks.length ? chunks : [""];
}

export function sampleFiles(runId: string, prompt: string) {
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
          scripts: { dev: "next dev", build: "next build", start: "next start" },
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

/**
 * Drive a generation run, yielding SSE-friendly events while streaming
 * each agent's narrative and persisting progress to the database.
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

  for (const step of run.steps) {
    if (signal?.aborted) {
      await prisma.generationRun.update({
        where: { id: runId },
        data: { status: "cancelled", completedAt: new Date() },
      });
      await prisma.project.update({
        where: { id: run.projectId },
        data: { status: "draft" },
      });
      yield { type: "run_done", status: "cancelled" };
      return;
    }

    // Skip already completed steps (resume safety)
    if (step.status === "completed") continue;

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

    const narrative = agentNarrative(step.agent, run.prompt);
    const chunks = chunkText(narrative, 10);
    let full = "";

    for (const chunk of chunks) {
      if (signal?.aborted) break;
      full += chunk;
      yield {
        type: "token",
        stepId: step.id,
        agent: step.agent,
        text: chunk,
        full,
      };
      // Persist periodically (every ~40 chars)
      if (full.length % 40 < chunk.length) {
        await prisma.generationStep.update({
          where: { id: step.id },
          data: { output: full },
        });
      }
      await sleep(28);
    }

    if (signal?.aborted) {
      await prisma.generationStep.update({
        where: { id: step.id },
        data: { output: full, status: "running" },
      });
      await prisma.generationRun.update({
        where: { id: runId },
        data: { status: "cancelled", completedAt: new Date() },
      });
      await prisma.project.update({
        where: { id: run.projectId },
        data: { status: "draft" },
      });
      yield { type: "run_done", status: "cancelled" };
      return;
    }

    await prisma.generationStep.update({
      where: { id: step.id },
      data: { status: "completed", output: full },
    });

    yield {
      type: "step_done",
      stepId: step.id,
      agent: step.agent,
      output: full,
    };
  }

  // Finalize run + sample files
  const files = sampleFiles(runId, run.prompt);
  await prisma.$transaction(async (tx) => {
    await tx.generatedFile.deleteMany({ where: { runId } });
    await tx.generatedFile.createMany({ data: files });
    await tx.generationRun.update({
      where: { id: runId },
      data: { status: "completed", completedAt: new Date() },
    });
    await tx.project.update({
      where: { id: run.projectId },
      data: { status: "ready" },
    });
  });

  yield {
    type: "run_done",
    status: "completed",
    files: files.map((f) => ({ path: f.path, language: f.language })),
  };
}
