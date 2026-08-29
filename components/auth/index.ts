// components/auth/index.ts

/**
 * Authentication Components
 *
 * Central export surface for all authentication-related UI components.
 *
 * Usage:
 *   import {
 *     AuthCard,
 *     LoginForm,
 *     ProtectedRoute,
 *     UserMenu,
 *   } from "@/components/auth";
 *
 * Keep this file limited to public component exports.
 * Internal implementation details should be imported directly when needed.
 */

/* -------------------------------------------------------------------------- */
/* Core authentication UI                                                     */
/* -------------------------------------------------------------------------- */

export { AuthCard } from "./auth-card";
export { AuthDivider } from "./auth-divider";
export { AuthError } from "./auth-error";
export { AuthLoading } from "./auth-loading";

/* -------------------------------------------------------------------------- */
/* Authentication forms                                                       */
/* -------------------------------------------------------------------------- */

export { LoginForm } from "./login-form";
export { ForgotPasswordForm } from "./forgot-password-form";

/* -------------------------------------------------------------------------- */
/* Authentication state / providers                                           */
/* -------------------------------------------------------------------------- */

export { AuthProvider } from "./auth-provider";

/* -------------------------------------------------------------------------- */
/* Route and session protection                                               */
/* -------------------------------------------------------------------------- */

export { ProtectedRoute } from "./protected-route";

/* -------------------------------------------------------------------------- */
/* User / account UI                                                          */
/* -------------------------------------------------------------------------- */

export { UserMenu } from "./user-menu";
