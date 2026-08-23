import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { streamGenerationRun, type StreamEvent } from "@/lib/generation-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function scopeWhere(activeOrganizationId: string | null, userId: string) {
  if (activeOrganizationId) {
    return { organizationId: activeOrganizationId };
  }
  return { organizationId: null, createdById: userId };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> }
) {
  const { runId } = await context.params;

  try {
    const { userId, activeOrganizationId } = await requireSession();

    const run = await prisma.generationRun.findUnique({
      where: { id: runId },
      include: { project: true },
    });

    if (!run) {
      return new Response(JSON.stringify({ error: "Run not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const project = await prisma.project.findFirst({
      where: {
        id: run.projectId,
        ...scopeWhere(activeOrganizationId, userId),
      },
    });

    if (!project) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const abort = new AbortController();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: StreamEvent) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        };

        try {
          for await (const event of streamGenerationRun(runId, abort.signal)) {
            send(event);
            if (event.type === "run_done" || event.type === "error") break;
          }
        } catch (err) {
          send({
            type: "error",
            message: err instanceof Error ? err.message : "Stream failed",
          });
        } finally {
          controller.close();
        }
      },
      cancel() {
        abort.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unauthorized",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
