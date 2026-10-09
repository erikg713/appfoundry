"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { organization } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function JoinByInviteForm() {
  const router = useRouter();
  const [invitationId, setInvitationId] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoining(true);
    setError(null);
    setSuccess(false);
    const { error } = await organization.acceptInvitation({
      invitationId: invitationId.trim(),
    });
    setJoining(false);
    if (error) {
      setError(error.message || "Could not accept that invitation");
      return;
    }
    setSuccess(true);
    setInvitationId("");
    router.refresh();
  }

  return (
    <form onSubmit={handleJoin} className="space-y-3">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      {success && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
          Invitation accepted — welcome aboard.
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={invitationId}
          onChange={(e) => setInvitationId(e.target.value)}
          placeholder="Paste invitation ID"
          aria-label="Invitation ID"
          className="font-mono text-sm"
        />
        <Button
          type="submit"
          disabled={joining || !invitationId.trim()}
          className="shrink-0"
        >
          {joining ? "Joining…" : "Join"}
        </Button>
      </div>
    </form>
  );
}
