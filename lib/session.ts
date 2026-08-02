import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Get the current session or redirect to sign-in.
 * Returns session + convenience fields for multi-tenancy.
 */
export async function requireSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const activeOrganizationId =
    (session.session as { activeOrganizationId?: string | null })
      ?.activeOrganizationId ?? null;

  return {
    session,
    user: session.user,
    userId: session.user.id,
    activeOrganizationId,
  };
}

/**
 * Same as requireSession but does not redirect (returns null if unauthenticated).
 */
export async function getOptionalSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  const activeOrganizationId =
    (session.session as { activeOrganizationId?: string | null })
      ?.activeOrganizationId ?? null;

  return {
    session,
    user: session.user,
    userId: session.user.id,
    activeOrganizationId,
  };
}
