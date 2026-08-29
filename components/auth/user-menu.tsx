"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  Loader2,
  LogOut,
  Settings,
  Shield,
  User,
} from "lucide-react";

import {
  useAuth,
} from "@/components/auth/auth-provider";

import { Button } from "@/components/ui/button";

/**
 * ============================================================================
 * Types
 * ============================================================================
 */

type UserMenuProps = {
  className?: string;

  /**
   * Optional callback after a successful sign-out.
   *
   * Useful when the parent application wants to perform
   * additional client-side cleanup.
   */
  onSignedOut?: () => void;

  /**
   * Whether to display the user's email inside the menu.
   */
  showEmail?: boolean;

  /**
   * Whether to display the settings link.
   */
  showSettings?: boolean;

  /**
   * Whether to display the profile link.
   */
  showProfile?: boolean;
};

/**
 * ============================================================================
 * Utilities
 * ============================================================================
 */

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
) {
  return classes.filter(Boolean).join(" ");
}

function getInitials(
  name?: string | null,
  email?: string | null,
): string {
  const value =
    name?.trim() ||
    email?.trim() ||
    "";

  if (!value) {
    return "?";
  }

  /**
   * Handle email addresses such as:
   * john.doe@example.com
   */
  if (
    !name &&
    value.includes("@")
  ) {
    return value
      .charAt(0)
      .toUpperCase();
  }

  const parts =
    value
      .split(/\s+/)
      .filter(Boolean);

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

function getDisplayName(
  user: {
    email?: string | null;
    user_metadata?: Record<
      string,
      unknown
    >;
  } | null,
): string {
  if (!user) {
    return "Account";
  }

  const metadata =
    user.user_metadata ?? {};

  const name =
    typeof metadata.full_name ===
    "string"
      ? metadata.full_name
      : typeof metadata.name ===
          "string"
        ? metadata.name
        : null;

  if (name?.trim()) {
    return name.trim();
  }

  return (
    user.email ||
    "Account"
  );
}

function getAvatarUrl(
  user: {
    user_metadata?: Record<
      string,
      unknown
    >;
  } | null,
): string | null {
  if (!user) {
    return null;
  }

  const metadata =
    user.user_metadata ?? {};

  const avatar =
    metadata.avatar_url ??
    metadata.picture ??
    metadata.avatar;

  return typeof avatar ===
    "string" &&
    avatar.trim()
    ? avatar
    : null;
}

/**
 * ============================================================================
 * UserAvatar
 * ============================================================================
 */

function UserAvatar({
  user,
  size = "md",
}: {
  user: {
    email?: string | null;
    user_metadata?: Record<
      string,
      unknown
    >;
  } | null;
  size?: "sm" | "md" | "lg";
}) {
  const [imageError, setImageError] =
    React.useState(false);

  const avatarUrl =
    getAvatarUrl(user);

  const displayName =
    getDisplayName(user);

  const initials =
    getInitials(
      typeof user?.user_metadata
        ?.full_name === "string"
        ? user.user_metadata.full_name
        : null,
      user?.email,
    );

  const sizes = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-xs",
    lg: "h-11 w-11 text-sm",
  };

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary",
        sizes[size],
      )}
    >
      {avatarUrl &&
      !imageError ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() =>
            setImageError(true)
          }
        />
      ) : (
        <span aria-hidden="true">
          {initials}
        </span>
      )}
    </div>
  );
}

/**
 * ============================================================================
 * Menu Item
 * ============================================================================
 */

function MenuItem({
  href,
  icon: Icon,
  children,
  disabled = false,
}: {
  href: string;
  icon: React.ElementType;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground opacity-60"
      >
        <Icon
          aria-hidden="true"
          className="h-4 w-4"
        />
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <Icon
        aria-hidden="true"
        className="h-4 w-4 text-muted-foreground"
      />

      <span>{children}</span>
    </Link>
  );
}

/**
 * ============================================================================
 * UserMenu
 * ============================================================================
 */

export function UserMenu({
  className,
  onSignedOut,
  showEmail = true,
  showSettings = true,
  showProfile = true,
}: UserMenuProps) {
  const {
    user,
    loading,
    error,
    isAuthenticated,
    signOut,
  } = useAuth();

  const [open, setOpen] =
    React.useState(false);

  const [signingOut, setSigningOut] =
    React.useState(false);

  const [signOutError, setSignOutError] =
    React.useState<string | null>(null);

  const menuRef =
    React.useRef<HTMLDivElement>(null);

  const triggerRef =
    React.useRef<HTMLButtonElement>(null);

  /**
   * Close menu when clicking outside.
   */
  React.useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(
      event: PointerEvent,
    ) {
      const target =
        event.target;

      if (
        target instanceof Node &&
        !menuRef.current?.contains(
          target,
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "pointerdown",
      handlePointerDown,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );
    };
  }, [open]);

  /**
   * Close on Escape and restore focus.
   */
  React.useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key === "Escape"
      ) {
        event.preventDefault();

        setOpen(false);

        window.setTimeout(() => {
          triggerRef.current?.focus();
        }, 0);
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [open]);

  /**
   * Sign out.
   */
  async function handleSignOut() {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    setSignOutError(null);

    try {
      const result =
        await signOut();

      if (result.error) {
        throw result.error;
      }

      setOpen(false);

      onSignedOut?.();
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Unable to sign out.";

      console.error(
        "[UserMenu] Sign out failed:",
        cause,
      );

      setSignOutError(message);
    } finally {
      setSigningOut(false);
    }
  }

  /**
   * Loading state.
   */
  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2",
          className,
        )}
      >
        <div
          className="h-9 w-9 animate-pulse rounded-full bg-muted"
          aria-hidden="true"
        />

        <span className="sr-only">
          Loading account
        </span>
      </div>
    );
  }

  /**
   * Do not render an account menu when the user
   * isn't authenticated.
   */
  if (
    !isAuthenticated ||
    !user
  ) {
    return null;
  }

  const displayName =
    getDisplayName(user);

  const email =
    user.email ?? "";

  const initials =
    getInitials(
      typeof user.user_metadata
        ?.full_name === "string"
        ? user.user_metadata.full_name
        : null,
      email,
    );

  return (
    <div
      ref={menuRef}
      className={cn(
        "relative",
        className,
      )}
    >
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        onClick={() =>
          setOpen((current) => !current)
        }
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${displayName}`}
        className="h-auto gap-2 rounded-full px-1.5 py-1.5 sm:pr-3"
      >
        <UserAvatar
          user={user}
          size="sm"
        />

        <span className="hidden max-w-32 truncate text-sm font-medium sm:block">
          {displayName}
        </span>

        <ChevronDown
          aria-hidden="true"
          className={cn(
            "hidden h-4 w-4 transition-transform sm:block",
            open && "rotate-180",
          )}
        />
      </Button>

      {open && (
        <div
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg outline-none"
        >
          {/* Account summary */}
          <div className="flex items-center gap-3 rounded-lg p-3">
            <UserAvatar
              user={user}
              size="lg"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {displayName}
              </p>

              {showEmail &&
                email && (
                  <p className="truncate text-xs text-muted-foreground">
                    {email}
                  </p>
                )}
            </div>
          </div>

          <div
            className="my-2 h-px bg-border"
            aria-hidden="true"
          />

          {/* Navigation */}
          <div className="space-y-1">
            {showProfile && (
              <div
                role="none"
              >
                <MenuItem
                  href="/account"
                  icon={User}
                >
                  Profile
                </MenuItem>
              </div>
            )}

            {showSettings && (
              <div
                role="none"
              >
                <MenuItem
                  href="/settings"
                  icon={Settings}
                >
                  Settings
                </MenuItem>
              </div>
            )}

            <div role="none">
              <MenuItem
                href="/settings/security"
                icon={Shield}
              >
                Security
              </MenuItem>
            </div>
          </div>

          {/* Sign-out error */}
          {signOutError && (
            <div
              role="alert"
              className="mt-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {signOutError}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </div>
          )}

          <div
            className="my-2 h-px bg-border"
            aria-hidden="true"
          />

          {/* Sign out */}
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-destructive disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : (
              <LogOut
                aria-hidden="true"
                className="h-4 w-4"
              />
            )}

            <span>
              {signingOut
                ? "Signing out..."
                : "Sign out"}
            </span>
          </button>

          {/* Authenticated indicator */}
          <div className="mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] text-muted-foreground">
            <Check
              aria-hidden="true"
              className="h-3 w-3 text-emerald-500"
            />
            <span>
              Authenticated
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
