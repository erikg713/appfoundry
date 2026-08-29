import * as React from "react";

type AuthDividerProps = {
  /**
   * Text displayed between the divider lines.
   *
   * Examples:
   * "OR"
   * "OR CONTINUE WITH"
   * "Continue with"
   */
  label?: React.ReactNode;

  /**
   * Divider orientation.
   *
   * "horizontal" is the normal authentication layout.
   * "vertical" is useful for split OAuth/email layouts.
   */
  orientation?: "horizontal" | "vertical";

  /**
   * Additional classes applied to the outer container.
   */
  className?: string;

  /**
   * Additional classes applied to the divider lines.
   */
  lineClassName?: string;

  /**
   * Additional classes applied to the label.
   */
  labelClassName?: string;

  /**
   * Controls whether the label is visually hidden while
   * remaining available to assistive technology.
   */
  visuallyHiddenLabel?: boolean;

  /**
   * Allows consumers to completely replace the label.
   */
  children?: React.ReactNode;
};

function cn(
  ...classes: Array<string | false | null | undefined>
) {
  return classes.filter(Boolean).join(" ");
}

export function AuthDivider({
  label = "OR",
  orientation = "horizontal",
  className,
  lineClassName,
  labelClassName,
  visuallyHiddenLabel = false,
  children,
}: AuthDividerProps) {
  const content = children ?? label;

  if (orientation === "vertical") {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn(
          "flex h-full min-h-24 flex-col items-center justify-center",
          className,
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            "w-px flex-1 bg-border",
            lineClassName,
          )}
        />

        {!visuallyHiddenLabel && (
          <span
            className={cn(
              "shrink-0 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground",
              labelClassName,
            )}
          >
            {content}
          </span>
        )}

        <div
          aria-hidden="true"
          className={cn(
            "w-px flex-1 bg-border",
            lineClassName,
          )}
        />
      </div>
    );
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cn(
        "flex w-full items-center gap-3",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "h-px flex-1 bg-border",
          lineClassName,
        )}
      />

      {!visuallyHiddenLabel && (
        <span
          className={cn(
            "shrink-0 bg-background px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground",
            labelClassName,
          )}
        >
          {content}
        </span>
      )}

      <div
        aria-hidden="true"
        className={cn(
          "h-px flex-1 bg-border",
          lineClassName,
        )}
      />
    </div>
  );
}

export default AuthDivider;
