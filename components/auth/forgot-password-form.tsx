"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  RefreshCw,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { AuthError } from "./auth-error";

type ForgotPasswordFormProps = {
  /**
   * Where Supabase should redirect the user after
   * clicking the password-reset email.
   */
  redirectTo?: string;

  /**
   * Optional callback after the reset request succeeds.
   */
  onSuccess?: (email: string) => void;

  /**
   * Optional callback when the request fails.
   */
  onError?: (error: Error) => void;

  /**
   * Optional class name for the root element.
   */
  className?: string;
};

type FormState =
  | "idle"
  | "submitting"
  | "success";

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RESEND_COOLDOWN_SECONDS = 30;

function cn(
  ...classes: Array<string | false | null | undefined>
) {
  return classes.filter(Boolean).join(" ");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(value);
}

export function ForgotPasswordForm({
  redirectTo = "/auth/reset-password",
  onSuccess,
  onError,
  className,
}: ForgotPasswordFormProps) {
  const [email, setEmail] = React.useState("");

  const [state, setState] =
    React.useState<FormState>("idle");

  const [error, setError] = React.useState<string | null>(
    null,
  );

  const [cooldown, setCooldown] = React.useState(0);

  const inputRef =
    React.useRef<HTMLInputElement>(null);

  /**
   * Countdown used to prevent accidental rapid
   * password-reset requests.
   */
  React.useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCooldown((current) =>
        current > 0 ? current - 1 : 0,
      );
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [cooldown]);

  /**
   * Automatically focus the email field when the
   * form first appears.
   */
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const normalizedEmail = normalizeEmail(email);

  const isSubmitting = state === "submitting";

  async function submitRequest() {
    setError(null);

    if (!normalizedEmail) {
      setError("Enter your email address.");
      inputRef.current?.focus();
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      inputRef.current?.focus();
      return;
    }

    if (cooldown > 0) {
      return;
    }

    setState("submitting");

    try {
      const supabase = createClient();

      /**
       * Keep the callback on the same origin.
       *
       * This prevents an externally supplied redirect URL
       * from being injected into the reset flow.
       */
      const origin = window.location.origin;

      let callbackUrl;

      try {
        callbackUrl = new URL(
          redirectTo,
          origin,
        );
      } catch {
        callbackUrl = new URL(
          "/auth/reset-password",
          origin,
        );
      }

      if (callbackUrl.origin !== origin) {
        callbackUrl = new URL(
          "/auth/reset-password",
          origin,
        );
      }

      const {
        error: resetError,
      } =
        await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          {
            redirectTo: callbackUrl.toString(),
          },
        );

      if (resetError) {
        throw resetError;
      }

      /**
       * Do not reveal whether an email address exists.
       *
       * Supabase may return success even when there is no
       * matching account depending on configuration, and
       * the UI should maintain the same privacy-preserving
       * behavior.
       */
      setState("success");
      setCooldown(RESEND_COOLDOWN_SECONDS);

      onSuccess?.(normalizedEmail);
    } catch (cause) {
      const authError =
        cause instanceof Error
          ? cause
          : new Error(
              "Unable to send the password reset email.",
            );

      console.error(
        "[ForgotPasswordForm]",
        authError,
      );

      setError(
        "We couldn't send the reset email right now. Please try again.",
      );

      onError?.(authError);

      setState("idle");
    }
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    await submitRequest();
  }

  function handleEmailChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    setEmail(event.target.value);

    if (error) {
      setError(null);
    }
  }

  function handleResetForm() {
    setState("idle");
    setError(null);
    setCooldown(0);

    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }

  if (state === "success") {
    return (
      <div
        className={cn(
          "space-y-6 text-center",
          className,
        )}
      >
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          aria-hidden="true"
        >
          <CheckCircle2 className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold">
            Check your email
          </h2>

          <p className="text-sm leading-6 text-muted-foreground">
            If an account exists for{" "}
            <span className="font-medium text-foreground">
              {normalizedEmail}
            </span>
            , we've sent instructions to reset your
            password.
          </p>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4 text-left">
          <p className="text-sm font-medium">
            Didn't receive the email?
          </p>

          <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
            <li>• Check your spam or junk folder.</li>
            <li>• Make sure the email address is correct.</li>
            <li>
              • Wait a few minutes before requesting another
              link.
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={cooldown > 0}
            onClick={handleResetForm}
          >
            {cooldown > 0 ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Resend available in {cooldown}s
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Send another reset email
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            asChild
          >
            <Link href="/auth/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to sign in
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-busy={isSubmitting}
      className={cn("space-y-6", className)}
    >
      <div className="space-y-2">
        <Label htmlFor="forgot-password-email">
          Email address
        </Label>

        <div className="relative">
          <Mail
            aria-hidden="true"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />

          <Input
            ref={inputRef}
            id="forgot-password-email"
            name="email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="email"
            spellCheck={false}
            placeholder="you@example.com"
            value={email}
            onChange={handleEmailChange}
            disabled={isSubmitting}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error
                ? "forgot-password-error"
                : "forgot-password-description"
            }
            className="pl-10"
            required
          />
        </div>

        <p
          id="forgot-password-description"
          className="text-xs leading-5 text-muted-foreground"
        >
          Enter the email address associated with your
          AppFoundry account.
        </p>
      </div>

      {error && (
        <div id="forgot-password-error">
          <AuthError
            title="Unable to continue"
            message={error}
            autoFocus
          />
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={
          isSubmitting ||
          !normalizedEmail ||
          cooldown > 0
        }
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending reset link...
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            Send reset link
          </>
        )}
      </Button>

      <div className="text-center">
        <Link
          href="/auth/login"
          className="inline-flex items-center text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    </form>
  );
}

export default ForgotPasswordForm;
