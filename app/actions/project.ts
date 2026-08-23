"use server";

// ─────────────────────────────────────────────────────────────────────────────
// AppFoundry Pi — Hardened Project Server Actions
// ─────────────────────────────────────────────────────────────────────────────
//  • Rate limiting per user (in-memory LRU; swap for Redis in production)
//  • Zod input validation with strict mode & additional sanitization
//  • Bounded retry logic on DB operations with exponential backoff
//  • Per-action timeout handling
//  • Audit logging for all mutations
//  • Scope enforcement (org vs. personal) with defense-in-depth
//  • Hardened error responses (no internal details leaked to client)
// ─────────────────────────────────────────────────────────────────────────────

import { prisma, dbHealthCheck } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Configuration ───────────────────────────────────────────────────────────

const ACTION_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 150,
  maxDelayMs: 2_000,
  queryTimeoutMs: 6_000,
  rateLimitWindowMs: 60_000,
  rateLimitMax: 30, // per window per user
} as const;

// ─── Rate Limiting (In-Memory LRU) ───────────────────────────────────────────
// Swap this for Redis / Upstash in production for multi-node consistency.

type RateLimitEntry = { count: number; resetAt: number };

const _rateLimitStore = new Map<string, RateLimitEntry>();

function rateLimitKey(userId: string, action: string): string {
  return `${userId}:${action}`;
}

function checkRateLimit(
  userId: string,
  action: string
): { ok: boolean; remaining: number; resetAt: number } {
  const key = rateLimitKey(userId, action);
  const now = Date.now();
  const entry = _rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    _rateLimitStore.set(key, {
      count: 1,
      resetAt: now + ACTION_CONFIG.rateLimitWindowMs,
    });
    return {
      ok: true,
      remaining: ACTION_CONFIG.rateLimitMax - 1,
      resetAt: now + ACTION_CONFIG.rateLimitWindowMs,
    };
  }

  if (entry.count >= ACTION_CONFIG.rateLimitMax) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    ok: true,
    remaining: ACTION_CONFIG.rateLimitMax - entry.count,
    resetAt: entry.resetAt,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function jitteredDelay(attempt: number): number {
  const exp = Math.min(attempt, 5);
  const base = ACTION_CONFIG.baseDelayMs * 2 ** exp;
  const capped = Math.min(base, ACTION_CONFIG.maxDelayMs);
  const jitter = Math.random() * 0.25 * capped;
  return Math.floor(capped + jitter);
}

function isRecoverableDbError(err: unknown): boolean {
  // Prisma connection / timeout errors
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: string }).code;
    return ["P1001", "P1002", "P1017", "P2024"].includes(code);
  }
  return false;
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), ms);

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(
            new DOMException(
              `Action timed out after ${ms}ms: ${label}`,
              "TimeoutError"
            )
          );
        });
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// ─── Audit Logger ────────────────────────────────────────────────────────────

async function auditLog(
  actorId: string,
  action: string,
  resource: string,
  resourceId: string,
  meta?: Record<string, unknown>
) {
  const entry = {
    actorId,
    action,
    resource,
    resourceId,
    meta,
    timestamp: new Date().toISOString(),
  };
  // eslint-disable-next-line no-console
  console.info("[action:audit]", JSON.stringify(entry));
  // TODO: persist to AuditLog table or external SIEM in production
}

// ─── Hardened Error Response ─────────────────────────────────────────────────
// Never leak internal error details to the client.

function actionError(
  message: string,
  internal?: Error
): { error: string } {
  if (internal && process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.error("[action:error]", internal);
  }
  return { error: message };
}

// ─── Input Schemas (strict + additional hardening) ───────────────────────────

const createProjectSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name is required")
      .max(100)
      .transform((s) => s.trim()),
    description: z
      .string()
      .max(500)
      .optional()
      .transform((s) => (s ? s.trim() : s)),
    prompt: z
      .string()
      .max(5000)
      .optional()
      .transform((s) => (s ? s.trim() : s)),
    slug: z
      .string()
      .min(1)
      .max(80)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must be lowercase alphanumeric with hyphens"
      )
      .optional()
      .transform((s) => (s ? s.trim().toLowerCase() : s)),
  })
  .strict();

const updateProjectSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(100)
      .optional()
      .transform((s) => (s ? s.trim() : s)),
    description: z
      .string()
      .max(500)
      .nullable()
      .optional()
      .transform((s) => (s ? s.trim() : s)),
    prompt: z
      .string()
      .max(5000)
      .nullable()
      .optional()
      .transform((s) => (s ? s.trim() : s)),
    status: z.enum(["draft", "generating", "ready", "error"]).optional(),
  })
  .strict();

// ─── Slugify ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ─── Scope Filter ────────────────────────────────────────────────────────────

function scopeWhere(activeOrganizationId: string | null, userId: string) {
  if (activeOrganizationId) {
    return { organizationId: activeOrganizationId };
  }
  return { organizationId: null, createdById: userId };
}

// ─── Bounded Retry DB Wrapper ────────────────────────────────────────────────

async function withDbRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= ACTION_CONFIG.maxRetries; attempt++) {
    if (attempt > 0) {
      await sleep(jitteredDelay(attempt));
    }

    try {
      return await withTimeout(fn(), ACTION_CONFIG.queryTimeoutMs, label);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const recoverable =
        isRecoverableDbError(err) ||
        (err instanceof DOMException && err.name === "TimeoutError");

      if (!recoverable || attempt === ACTION_CONFIG.maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error(`Unknown DB failure: ${label}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

export async function listProjects() {
  const { userId, activeOrganizationId } = await requireSession();

  const rl = checkRateLimit(userId, "listProjects");
  if (!rl.ok) {
    return actionError("Rate limit exceeded. Please try again later.");
  }

  try {
    const projects = await withDbRetry("listProjects", () =>
      prisma.project.findMany({
        where: scopeWhere(activeOrganizationId, userId),
        orderBy: { updatedAt: "desc" },
      })
    );
    return { data: projects };
  } catch (e) {
    return actionError(
      "Unable to load projects. Please try again.",
      e instanceof Error ? e : undefined
    );
  }
}

export async function getProject(id: string) {
  const { userId, activeOrganizationId } = await requireSession();

  const rl = checkRateLimit(userId, "getProject");
  if (!rl.ok) {
    return actionError("Rate limit exceeded. Please try again later.");
  }

  // Validate ID format to prevent injection / traversal
  if (!z.string().uuid().safeParse(id).success) {
    return actionError("Invalid project ID");
  }

  try {
    const project = await withDbRetry("getProject", () =>
      prisma.project.findFirst({
        where: {
          id,
          ...scopeWhere(activeOrganizationId, userId),
        },
      })
    );
    return { data: project };
  } catch (e) {
    return actionError(
      "Unable to load project. Please try again.",
      e instanceof Error ? e : undefined
    );
  }
}

export async function createProject(input: z.infer<typeof createProjectSchema>) {
  const { userId, activeOrganizationId } = await requireSession();

  const rl = checkRateLimit(userId, "createProject");
  if (!rl.ok) {
    return actionError("Rate limit exceeded. Please try again later.");
  }

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { name, description, prompt } = parsed.data;
  let slug = parsed.data.slug || slugify(name);

  try {
    // Ensure unique slug within scope
    const existing = await withDbRetry("createProject:slugCheck", () =>
      prisma.project.findFirst({
        where: {
          slug,
          organizationId: activeOrganizationId,
          ...(activeOrganizationId ? {} : { createdById: userId }),
        },
      })
    );

    if (existing) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    const project = await withDbRetry("createProject:insert", () =>
      prisma.project.create({
        data: {
          name,
          description: description ?? null,
          prompt: prompt ?? null,
          slug,
          status: "draft",
          organizationId: activeOrganizationId,
          createdById: userId,
        },
      })
    );

    await auditLog(userId, "CREATE", "project", project.id, {
      orgId: activeOrganizationId,
      slug,
    });
    revalidatePath("/dashboard");
    return { data: project };
  } catch (e) {
    return actionError(
      "Unable to create project. Please try again.",
      e instanceof Error ? e : undefined
    );
  }
}

export async function updateProject(
  id: string,
  input: z.infer<typeof updateProjectSchema>
) {
  const { userId, activeOrganizationId } = await requireSession();

  const rl = checkRateLimit(userId, "updateProject");
  if (!rl.ok) {
    return actionError("Rate limit exceeded. Please try again later.");
  }

  if (!z.string().uuid().safeParse(id).success) {
    return actionError("Invalid project ID");
  }

  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  try {
    // Verify ownership / scope first (defense-in-depth)
    const existing = await withDbRetry("updateProject:verify", () =>
      prisma.project.findFirst({
        where: {
          id,
          ...scopeWhere(activeOrganizationId, userId),
        },
      })
    );

    if (!existing) {
      return actionError("Project not found or access denied");
    }

    const project = await withDbRetry("updateProject:mutate", () =>
      prisma.project.update({
        where: { id },
        data: {
          ...parsed.data,
          description:
            parsed.data.description === undefined
              ? undefined
              : parsed.data.description,
          prompt:
            parsed.data.prompt === undefined ? undefined : parsed.data.prompt,
        },
      })
    );

    await auditLog(userId, "UPDATE", "project", id, {
      orgId: activeOrganizationId,
      changes: Object.keys(parsed.data),
    });
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/projects/${id}`);
    return { data: project };
  } catch (e) {
    return actionError(
      "Unable to update project. Please try again.",
      e instanceof Error ? e : undefined
    );
  }
}

export async function deleteProject(id: string) {
  const { userId, activeOrganizationId } = await requireSession();

  const rl = checkRateLimit(userId, "deleteProject");
  if (!rl.ok) {
    return actionError("Rate limit exceeded. Please try again later.");
  }

  if (!z.string().uuid().safeParse(id).success) {
    return actionError("Invalid project ID");
  }

  try {
    const existing = await withDbRetry("deleteProject:verify", () =>
      prisma.project.findFirst({
        where: {
          id,
          ...scopeWhere(activeOrganizationId, userId),
        },
      })
    );

    if (!existing) {
      return actionError("Project not found or access denied");
    }

    await withDbRetry("deleteProject:mutate", () =>
      prisma.project.delete({ where: { id } })
    );

    await auditLog(userId, "DELETE", "project", id, {
      orgId: activeOrganizationId,
      name: existing.name,
    });
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    return actionError(
      "Unable to delete project. Please try again.",
      e instanceof Error ? e : undefined
    );
  }
}

// ─── Health Check Action ─────────────────────────────────────────────────────

export async function dbHealth() {
  const { userId } = await requireSession();
  const rl = checkRateLimit(userId, "dbHealth");
  if (!rl.ok) {
    return actionError("Rate limit exceeded");
  }
  return dbHealthCheck();
}
