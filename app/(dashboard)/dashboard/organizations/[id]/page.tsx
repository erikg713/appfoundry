"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { organization, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Copy, Check, Trash2, UserMinus, LogOut } from "lucide-react";

type Member = {
  id: string;
  userId: string;
  role: string;
  user: { name: string | null; email: string; image?: string | null };
  createdAt: string | Date;
};

type Invitation = {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: string | Date;
};

type FullOrg = {
  id: string;
  name: string;
  slug: string | null;
  createdAt: string | Date;
  members: Member[];
  invitations: Invitation[];
};

function roleBadge(role: string) {
  const styles: Record<string, string> = {
    owner: "bg-violet-100 text-violet-800",
    admin: "bg-blue-100 text-blue-800",
    member: "bg-slate-100 text-slate-700",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
        styles[role] || styles.member
      }`}
    >
      {role}
    </span>
  );
}

export default function OrganizationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;
  const { data: session } = useSession();

  const [org, setOrg] = useState<FullOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Danger zone
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await organization.getFullOrganization({
      query: { organizationId: orgId },
    });
    setLoading(false);
    if (error || !data) {
      setError(error?.message || "Organization not found or access denied");
      return;
    }
    setOrg(data as unknown as FullOrg);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const myMembership = org?.members.find((m) => m.userId === session?.user.id);
  const myRole = myMembership?.role;
  const canManage = myRole === "owner" || myRole === "admin";
  const isOwner = myRole === "owner";

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    const { error } = await organization.inviteMember({
      organizationId: orgId,
      email: inviteEmail.trim(),
      role: inviteRole as "member" | "admin",
    });
    setInviting(false);
    if (error) {
      setInviteError(error.message || "Failed to send invitation");
      return;
    }
    setInviteEmail("");
    setInviteRole("member");
    await load();
  }

  async function handleCancelInvitation(invitationId: string) {
    setBusy(true);
    await organization.cancelInvitation({ invitationId });
    setBusy(false);
    await load();
  }

  async function handleRemoveMember(memberIdOrEmail: string) {
    if (!confirm("Remove this member from the organization?")) return;
    setBusy(true);
    const { error } = await organization.removeMember({
      organizationId: orgId,
      memberIdOrEmail,
    });
    setBusy(false);
    if (error) {
      setError(error.message || "Failed to remove member");
      return;
    }
    await load();
  }

  async function handleRoleChange(memberId: string, role: string) {
    setBusy(true);
    const { error } = await organization.updateMemberRole({
      organizationId: orgId,
      memberId,
      role: role as "member" | "admin",
    });
    setBusy(false);
    if (error) {
      setError(error.message || "Failed to update role");
      return;
    }
    await load();
  }

  async function handleLeave() {
    if (!confirm("Leave this organization?")) return;
    setBusy(true);
    const { error } = await organization.leave({ organizationId: orgId });
    setBusy(false);
    if (error) {
      setError(error.message || "Failed to leave organization");
      return;
    }
    router.push("/dashboard/organizations");
    router.refresh();
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    const { error } = await organization.delete({ organizationId: orgId });
    if (error) {
      setError(error.message || "Failed to delete organization");
      setDeleting(false);
      setConfirmDelete(false);
      return;
    }
    router.push("/dashboard/organizations");
    router.refresh();
  }

  function copyId(id: string) {
    void navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId((v) => (v === id ? null : v)), 1500);
  }

  if (loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading organization…</p>;
  }

  if (error || !org) {
    return (
      <div className="max-w-xl">
        <Link href="/dashboard/organizations" className="text-sm text-slate-500 hover:text-black">
          ← Back to organizations
        </Link>
        <div className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "Organization not found."}
        </div>
      </div>
    );
  }

  const pendingInvites = org.invitations.filter((i) => i.status === "pending");

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Link
          href="/dashboard/organizations"
          className="text-sm text-slate-500 hover:text-black transition"
        >
          ← Back to organizations
        </Link>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{org.name}</h1>
          {myRole && roleBadge(myRole)}
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          /{org.slug} · created {new Date(org.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Members ({org.members.length})
          </CardTitle>
          <CardDescription>People with access to this workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {org.members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {m.user.name || m.user.email}
                    {m.userId === session?.user.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canManage && m.userId !== session?.user.id ? (
                    <>
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value)}
                        disabled={busy}
                        className="text-xs border rounded-lg px-2 py-1.5 bg-white"
                        aria-label={`Role for ${m.user.email}`}
                      >
                        <option value="member">member</option>
                        <option value="admin">admin</option>
                      </select>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => handleRemoveMember(m.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <UserMinus className="h-4 w-4" />
                        <span className="sr-only">Remove {m.user.email}</span>
                      </Button>
                    </>
                  ) : (
                    roleBadge(m.role)
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Invite */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite a teammate</CardTitle>
            <CardDescription>
              They&apos;ll get an invitation ID — share it with them and they can
              join from the organizations page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Label htmlFor="invite-email" className="sr-only">
                  Email
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  required
                />
              </div>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm bg-white"
                aria-label="Invite role"
              >
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
              <Button type="submit" disabled={inviting || !inviteEmail.trim()}>
                {inviting ? "Inviting…" : "Send invite"}
              </Button>
            </form>
            {inviteError && (
              <p className="mt-3 text-sm text-red-600">{inviteError}</p>
            )}

            {pendingInvites.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium mb-2">
                  Pending invitations ({pendingInvites.length})
                </h3>
                <ul className="space-y-2">
                  {pendingInvites.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{inv.email}</p>
                        <p className="text-xs text-muted-foreground">
                          role: {inv.role ?? "member"} · expires{" "}
                          {new Date(inv.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyId(inv.id)}
                          title="Copy invitation ID"
                        >
                          {copiedId === inv.id ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                          <span className="sr-only">Copy invitation ID</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => handleCancelInvitation(inv.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Cancel
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Danger zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-base text-red-700">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isOwner && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Leave organization</p>
                <p className="text-xs text-muted-foreground">
                  You&apos;ll lose access to its projects.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={handleLeave}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <LogOut className="mr-1.5 h-4 w-4" />
                Leave
              </Button>
            </div>
          )}
          {isOwner && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-red-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Delete organization</p>
                <p className="text-xs text-muted-foreground">
                  Permanently deletes the workspace and all its projects. This
                  cannot be undone.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {confirmDelete && !deleting && (
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={deleting}
                  onClick={handleDelete}
                  className={
                    confirmDelete
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "text-red-600 border border-red-200 hover:bg-red-50"
                  }
                  variant={confirmDelete ? "default" : "outline"}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  {deleting ? "Deleting…" : confirmDelete ? "Confirm delete" : "Delete"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
