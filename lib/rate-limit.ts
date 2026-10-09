import { prisma } from "@/lib/db";

/**
 * DB-backed rate limiting for AI generation (OpenAI cost protection).
 *
 * Every generation run burns real OpenAI tokens, so per-user quotas are
 * enforced at both enforcement points:
 *   - `startGeneration` in `lib/generation.ts` (server action, creates the run)
 *   - `GET /api/generation/[runId]/stream` (the SSE route that streams LLM tokens)
 *
 * Runs are attributed to a user through the project's creator
 * (`project.createdById`). No new tables, migrations, or services — the
 * check only queries the existing `GenerationRun` model.
 */

export const GENERATION_LIMITS = {
  /** Max generation runs per rolling hour, per user. */
  perHour: 10,
  /** Max generation runs per rolling 24 hours, per user. */
  perDay: 50,
} as const;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type GenerationRateLimitResult =
  | { allowed: true }
  | {
      allowed: false;
      /** Seconds until the oldest run in the violated window rolls off. */
      retryAfterSeconds: number;
      /** User-facing message. */
      message: string;
    };

type Denied = Extract<GenerationRateLimitResult, { allowed: false }>;

/**
 * Check whether `userId` may start another generation run right now.
 *
 * Returns `{ allowed: true }`, or `{ allowed: false, retryAfterSeconds,
 * message }` when a quota is exhausted. Checking is read-only: it never
 * creates rows, so calling it at both enforcement points does not
 * double-count a single generation.
 */
export async function checkGenerationRateLimit(
  userId: string
): Promise<GenerationRateLimitResult> {
  const now = Date.now();
  const hourAgo = new Date(now - HOUR_MS);
  const dayAgo = new Date(now - DAY_MS);

  const [hourCount, dayCount] = await Promise.all([
    prisma.generationRun.count({
      where: {
        createdAt: { gte: hourAgo },
        project: { createdById: userId },
      },
    }),
    prisma.generationRun.count({
      where: {
        createdAt: { gte: dayAgo },
        project: { createdById: userId },
      },
    }),
  ]);

  if (hourCount >= GENERATION_LIMITS.perHour) {
    const oldest = await prisma.generationRun.findFirst({
      where: {
        createdAt: { gte: hourAgo },
        project: { createdById: userId },
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    const retryAfterSeconds = oldest
      ? Math.max(
          1,
          Math.ceil((oldest.createdAt.getTime() + HOUR_MS - now) / 1000)
        )
      : Math.ceil(HOUR_MS / 1000);
    return {
      allowed: false,
      retryAfterSeconds,
      message: `Generation limit reached (${GENERATION_LIMITS.perHour} per hour). Please wait a bit and try again.`,
    };
  }

  if (dayCount >= GENERATION_LIMITS.perDay) {
    const oldest = await prisma.generationRun.findFirst({
      where: {
        createdAt: { gte: dayAgo },
        project: { createdById: userId },
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    const retryAfterSeconds = oldest
      ? Math.max(
          1,
          Math.ceil((oldest.createdAt.getTime() + DAY_MS - now) / 1000)
        )
      : Math.ceil(DAY_MS / 1000);
    return {
      allowed: false,
      retryAfterSeconds,
      message: `Daily generation limit reached (${GENERATION_LIMITS.perDay} per 24 hours). Please try again later.`,
    };
  }

  return { allowed: true };
}

/**
 * Build a 429 JSON response with a `Retry-After` header, for use in
 * route handlers when `checkGenerationRateLimit` denies a request.
 */
export function generationRateLimitedResponse(result: Denied): Response {
  return new Response(JSON.stringify({ error: result.message }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(result.retryAfterSeconds),
    },
  });
}
