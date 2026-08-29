import Link from "next/link";
import { Sparkles } from "lucide-react";

type AuthHeaderProps = {
  title: string;
  description?: string;
};

export function AuthHeader({
  title,
  description,
}: AuthHeaderProps) {
  return (
    <div className="mb-8 text-center">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 font-semibold"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Sparkles className="h-5 w-5" />
        </span>
        <span className="text-lg">AppFoundry</span>
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">
        {title}
      </h1>

      {description && (
        <p className="mt-2 text-sm text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
