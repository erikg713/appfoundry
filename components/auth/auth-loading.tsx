import * as React from "react";
import { Loader2 } from "lucide-react";

type AuthLoadingProps = {
  label?: string;
  fullscreen?: boolean;
  className?: string;
};

export function AuthLoading({
  label = "Loading...",
  fullscreen = false,
  className,
}: AuthLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={[
        "flex w-full items-center justify-center",
        fullscreen ? "min-h-screen" : "min-h-[240px]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-col items-center justify-center text-center">
        <Loader2
          className="h-7 w-7 animate-spin text-primary"
          aria-hidden="true"
        />

        <span className="mt-3 text-sm font-medium text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}
