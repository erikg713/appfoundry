"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

/**
 * Browser-side better-auth client.
 *
 * `baseURL` is left unset by default so the client uses the current origin
 * (the auth handler lives at `/api/auth` on the same app). Override with
 * `NEXT_PUBLIC_AUTH_URL` when the auth server runs on a different origin —
 * note: this must be the app origin (e.g. `https://app.example.com`), NOT
 * `/api/auth`; better-auth appends the `/api/auth` path itself.
 */

const baseURL = process.env.NEXT_PUBLIC_AUTH_URL || undefined;

export const authClient = createAuthClient({
  ...(baseURL ? { baseURL } : {}),
  plugins: [organizationClient()],
});

export const { signIn, signUp, signOut, useSession, organization } = authClient;
