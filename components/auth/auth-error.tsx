"use client";

import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";

type AuthErrorSeverity =
  | "error"
  | "warning"
  | "info"
  | "success";

type AuthErrorProps = {
  /**
   * Error/message displayed to the user.
   */
  message?: React.ReactNode | null;

  /**
   * Optional heading shown above the message.
   */
  title?: React.ReactNode;

  /**
   * Visual severity.
   */
  severity?: AuthErrorSeverity;

  /**
   * Optional technical details.
   *
   * Useful during development, but avoid exposing
   * sensitive server information in production.
   */
  details?: React.ReactNode;

  /**
   * Whether technical details can be expanded.
   */
  showDetails?: boolean;

  /**
   * Callback invoked when the user dismisses the message.
   */
  onDismiss?: () => void;

  /**
   * Additional classes for the outer alert.
   */
  className?: string;

  /**
   * Whether the alert should automatically receive focus.
   */
  autoFocus?: boolean;

  /**
   * Allows custom content instead of `message`.
   */
  children?: React.ReactNode;
};

const severityConfig: Record<
  AuthErrorSeverity,
  {
    icon: React.ElementType;
    container: string;
    iconClass: string;
    titleClass: string;
    messageClass: string;
  }
> = {
  error: {
    icon: AlertCircle,
    container:
      "border-destructive/20 bg-destructive/10 text-destructive",
    iconClass: "text-destructive",
    titleClass: "text-destructive",
    messageClass: "text-destructive/90",
  },

  warning: {
    icon: AlertTriangle,
    container:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    iconClass:
      "text-amber-600 dark:text-amber-400",
    titleClass:
      "text-amber-700 dark:text-amber-400",
    messageClass:
      "text-amber-700/90 dark:text-amber-400/90",
  },

  info: {
    icon: Info,
    container:
      "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    iconClass:
      "text-blue-600 dark:text-blue-400",
    titleClass:
      "text-blue-700 dark:text-blue-400",
    messageClass:
      "text-blue-700/90 dark:text-blue-400/90",
  },

  success: {
    icon: CheckCircle2,
    container:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    iconClass:
      "text-emerald-600 dark:text-emerald-400",
    titleClass:
      "text-emerald-700 dark:text-emerald-400",
    messageClass:
      "text-emerald-700/90 dark:text-emerald-400/90",
  },
};

function cn(
  ...classes: Array<string | false | null | undefined>
) {
  return classes.filter(Boolean).join(" ");
}

export function AuthError({
  message,
  title,
  severity = "error",
  details,
  showDetails = false,
  onDismiss,
  className,
  autoFocus = false,
  children,
}: AuthErrorProps) {
  const alertRef = React.useRef<HTMLDivElement>(null);

  const content = children ?? message;

  if (
    content === null ||
    content === undefined ||
    content === ""
  ) {
    return null;
  }

  const config = severityConfig[severity];
  const Icon = config.icon;

  React.useEffect(() => {
    if (!autoFocus) return;

    alertRef.current?.focus();
  }, [autoFocus]);

  const isError = severity === "error";

  return (
    <div
      ref={alertRef}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      tabIndex={autoFocus ? -1 : undefined}
      className={cn(
        "relative flex w-full gap-3 rounded-lg border p-3 text-sm",
        config.container,
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          config.iconClass,
        )}
      />

      <div className="min-w-0 flex-1">
        {title && (
          <p
            className={cn(
              "font-semibold",
              config.titleClass,
            )}
          >
            {title}
          </p>
        )}

        <div
          className={cn(
            "leading-5",
            title && "mt-0.5",
            config.messageClass,
          )}
        >
          {content}
        </div>

        {details && showDetails && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium underline underline-offset-2">
              Technical details
            </summary>

            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/5 p-2 text-xs dark:bg-white/5">
              {details}
            </pre>
          </details>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className={cn(
            "shrink-0 rounded-md p-1 opacity-70 transition-opacity",
            "hover:opacity-100",
            "focus:outline-none focus:ring-2 focus:ring-current focus:ring-offset-2",
          )}
        >
          <X
            aria-hidden="true"
            className="h-4 w-4"
          />
        </button>
      )}
    </div>
  );
}

export default AuthError;
