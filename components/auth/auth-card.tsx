import * as React from "react";

import { cn } from "@/lib/utils";

type AuthCardProps = React.HTMLAttributes<HTMLDivElement> & {
  /**
   * Optional content rendered above the main card body.
   *
   * Useful for:
   * - Auth logos
   * - Branding
   * - Page-specific headers
   */
  header?: React.ReactNode;

  /**
   * Optional content rendered below the card body.
   *
   * Useful for:
   * - Terms
   * - Privacy links
   * - Sign-in/sign-up navigation
   */
  footer?: React.ReactNode;

  /**
   * Optional decorative element rendered behind the card.
   */
  decoration?: React.ReactNode;

  /**
   * Controls the card width.
   */
  size?: "sm" | "md" | "lg" | "full";

  /**
   * Adds a subtle elevated/glass appearance.
   */
  variant?: "default" | "elevated" | "glass";

  /**
   * Removes the default internal padding.
   */
  noPadding?: boolean;
};

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  full: "max-w-full",
} as const;

const variantClasses = {
  default:
    "border bg-card text-card-foreground shadow-sm",

  elevated:
    "border bg-card text-card-foreground shadow-xl shadow-black/5 dark:shadow-black/20",

  glass:
    "border border-white/20 bg-background/80 text-foreground shadow-xl shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-background/70",
} as const;

/**
 * AuthCard
 *
 * Shared visual container for authentication pages.
 *
 * Designed for:
 * - Login
 * - Signup
 * - Forgot password
 * - Reset password
 * - Email verification
 * - OAuth
 * - MFA
 * - Account recovery
 */
export function AuthCard({
  children,
  header,
  footer,
  decoration,
  size = "md",
  variant = "default",
  noPadding = false,
  className,
  ...props
}: AuthCardProps) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full",
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {decoration && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
        >
          {decoration}
        </div>
      )}

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl",
          variantClasses[variant],
        )}
      >
        {header && (
          <div className="border-b px-6 py-6 sm:px-8">
            {header}
          </div>
        )}

        <div
          className={cn(
            !noPadding && "px-6 py-6 sm:px-8 sm:py-8",
          )}
        >
          {children}
        </div>

        {footer && (
          <div className="border-t bg-muted/20 px-6 py-5 sm:px-8">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * AuthCardHeader
 *
 * Standardized title/description section.
 */
export function AuthCardHeader({
  title,
  description,
  icon,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-3 text-center",
        className,
      )}
    >
      {icon && (
        <div
          aria-hidden="true"
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"
        >
          {icon}
        </div>
      )}

      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">
          {title}
        </h1>

        {description && (
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * AuthCardFooter
 *
 * Convenient footer component for auth navigation,
 * terms, privacy notices, etc.
 */
export function AuthCardFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-center text-sm text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * AuthCardDivider
 *
 * Creates a visual separation inside an auth card.
 */
export function AuthCardDivider({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "h-px w-full bg-border",
        className,
      )}
    />
  );
}

export default AuthCard;
