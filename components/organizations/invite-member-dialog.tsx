import React, { useEffect, useRef, useState } from "react";

type Role = "member" | "admin" | "billing";

interface InviteMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  // Optional callback to refresh parent state after an invite succeeds
  onInvited?: () => void;
}

/**
 * Simple email validation.
 * Use a more robust validation library for production (zod, yup, validator.js).
 */
const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export default function InviteMemberDialog({
  isOpen,
  onClose,
  organizationId,
  onInvited,
}: InviteMemberDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  // focus first field when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstFieldRef.current?.focus(), 0);
      // reset state when opened
      setEmail("");
      setRole("member");
      setMessage("");
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Email is required.");
      return;
    }
    if (!isValidEmail(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      // Example API route — adjust to match your backend.
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/invitations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: trimmed,
            role,
            message: message.trim() || undefined,
          }),
        }
      );

      if (!res.ok) {
        // Attempt to read structured error
        let body: any;
        try {
          body = await res.json();
        } catch {
          body = { message: res.statusText || "Request failed" };
        }
        throw new Error(body?.message || `Server error (${res.status})`);
      }

      setSuccess("Invitation sent.");
      setEmail("");
      setMessage("");
      setRole("member");
      onInvited?.();
    } catch (err: any) {
      setError(err?.message || "Failed to send invitation.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (loading) return; // prevent closing mid-request; optional
    onClose();
  }

  return (
    // Basic modal markup. Replace classes with your design system.
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-member-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-lg rounded bg-white p-6 shadow-lg">
        <header className="mb-4 flex items-start justify-between">
          <h2 id="invite-member-title" className="text-lg font-semibold">
            Invite member
          </h2>
          <button
            aria-label="Close dialog"
            onClick={handleClose}
            className="ml-4 rounded px-2 py-1 text-sm hover:bg-gray-100"
            disabled={loading}
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              ref={firstFieldRef}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded border px-3 py-2"
              placeholder="name@example.com"
              aria-invalid={!!error && !isValidEmail(email)}
              aria-describedby={error ? "invite-error" : undefined}
              disabled={loading}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="role">
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full rounded border px-3 py-2"
              disabled={loading}
            >
              <option value="member">Member (default)</option>
              <option value="admin">Admin</option>
              <option value="billing">Billing</option>
            </select>
          </div>

          <div>
            <label
              className="mb-1 block text-sm font-medium"
              htmlFor="message"
            >
              Message (optional)
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full rounded border px-3 py-2"
              placeholder="Add a personal message..."
              disabled={loading}
            />
          </div>

          {error && (
            <div id="invite-error" role="alert" className="text-sm text-red-600">
              {error}
            </div>
          )}
          {success && (
            <div role="status" className="text-sm text-green-600">
              {success}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded border px-3 py-2"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
