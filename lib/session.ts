import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

/**
 * The single server-side session shape for AppFoundry.
 *
 * Sessions are owned by better-auth (DB-backed via Prisma). There is no
 * custom JWT/cookie scheme — `auth.api.getSession()` is the one auth path.
 */

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

export type AppSession = {
  user: SessionUser;
  userId: string;
  email: string;
  /** Currently active organization, or null for the personal workspace. */
  activeOrganizationId: string | null;
};

async function resolveSession(): Promise<AppSession | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  const activeOrganizationId =
    (session.session as { activeOrganizationId?: string | null } | null)
      ?.activeOrganizationId ?? null;

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    },
    userId: session.user.id,
    email: session.user.email,
    activeOrganizationId,
  };
}

/** Cached per-request session. Returns null when signed out. */
export const getSession = cache(resolveSession);

/** Session or redirect to sign-in. Use in pages/layouts. */
export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  return session;
}

/** Nullable session for components that handle signed-out state themselves. */
export async function optionalSession(): Promise<AppSession | null> {
  return getSession();
}
