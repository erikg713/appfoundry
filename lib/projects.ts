"use server";

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  prompt: z.string().max(5000).optional(),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
    .optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  prompt: z.string().max(5000).nullable().optional(),
  status: z.enum(["draft", "generating", "ready", "error"]).optional(),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Scope filter: projects belonging to the active organization,
 * or personal projects (organizationId = null) when no org is active.
 */
function scopeWhere(activeOrganizationId: string | null, userId: string) {
  if (activeOrganizationId) {
    return { organizationId: activeOrganizationId };
  }
  // Personal workspace: only projects created by this user with no org
  return {
    organizationId: null,
    createdById: userId,
  };
}

export async function listProjects() {
  const { userId, activeOrganizationId } = await requireSession();

  const projects = await prisma.project.findMany({
    where: scopeWhere(activeOrganizationId, userId),
    orderBy: { updatedAt: "desc" },
  });

  return projects;
}

export async function getProject(id: string) {
  const { userId, activeOrganizationId } = await requireSession();

  const project = await prisma.project.findFirst({
    where: {
      id,
      ...scopeWhere(activeOrganizationId, userId),
    },
  });

  return project;
}

export async function createProject(input: z.infer<typeof createProjectSchema>) {
  const { userId, activeOrganizationId } = await requireSession();

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { name, description, prompt } = parsed.data;
  let slug = parsed.data.slug || slugify(name);

  // Ensure unique slug within the org/personal scope
  const existing = await prisma.project.findFirst({
    where: {
      slug,
      organizationId: activeOrganizationId,
      ...(activeOrganizationId ? {} : { createdById: userId }),
    },
  });

  if (existing) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  const project = await prisma.project.create({
    data: {
      name,
      description: description || null,
      prompt: prompt || null,
      slug,
      status: "draft",
      organizationId: activeOrganizationId,
      createdById: userId,
    },
  });

  revalidatePath("/dashboard");
  return { data: project };
}

export async function updateProject(
  id: string,
  input: z.infer<typeof updateProjectSchema>
) {
  const { userId, activeOrganizationId } = await requireSession();

  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // Verify ownership / scope first
  const existing = await prisma.project.findFirst({
    where: {
      id,
      ...scopeWhere(activeOrganizationId, userId),
    },
  });

  if (!existing) {
    return { error: { _form: ["Project not found or access denied"] } };
  }

  const project = await prisma.project.update({
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
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/projects/${id}`);
  return { data: project };
}

export async function deleteProject(id: string) {
  const { userId, activeOrganizationId } = await requireSession();

  const existing = await prisma.project.findFirst({
    where: {
      id,
      ...scopeWhere(activeOrganizationId, userId),
    },
  });

  if (!existing) {
    return { error: "Project not found or access denied" };
  }

  await prisma.project.delete({ where: { id } });

  revalidatePath("/dashboard");
  return { success: true };
}
