"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient, signOut, useSession } from "@/lib/auth-client";
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
import { LogOut, MonitorSmartphone } from "lucide-react";

type SessionInfo = {
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: string | Date;
  expiresAt: string | Date;
};

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, isPending, refetch } = useSession();

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (session?.user.name) setName(session.user.name);
  }, [session?.user.name]);

  useEffect(() => {
    async function loadSessions() {
      try {
        const { data } = await authClient.listSessions();
        setSessions((data as unknown as SessionInfo[]) || []);
      } catch {
        setSessions([]);
      } finally {
        setSessionsLoading(false);
      }
    }
    if (session) void loadSessions();
  }, [session]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);
    const { error } = await authClient.updateUser({ name: name.trim() });
    setSaving(false);
    if (error) {
      setSaveError(error.message || "Failed to update profile");
      return;
    }
    setSaveMsg("Profile updated.");
    await refetch();
    router.refresh();
  }

  async function handleRevoke(token: string) {
    setRevoking(token);
    await authClient.revokeSession({ token });
    setSessions((prev) => prev.filter((s) => s.token !== token));
    setRevoking(null);
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  if (isPending) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  if (!session) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Not signed in.</p>;
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>How you appear across workspaces</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            {saveMsg && (
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
                {saveMsg}
              </div>
            )}
            {saveError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                {saveError}
              </div>
            )}
            <div>
              <Label htmlFor="name" className="mb-1.5 block">
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="Your name"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Email</Label>
              <Input value={session.user.email} disabled className="bg-slate-50" />
              <p className="mt-1 text-xs text-muted-foreground">
                Email addresses can&apos;t be changed here yet.
              </p>
            </div>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active sessions</CardTitle>
          <CardDescription>Devices signed in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <p className="text-sm text-muted-foreground">Loading sessions…</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Couldn&apos;t load sessions.
            </p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((s, i) => (
                <li
                  key={s.token}
                  className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <MonitorSmartphone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {s.userAgent ? s.userAgent.split(" ").slice(0, 3).join(" ") : "Unknown device"}
                        {i === 0 && (
                          <span className="ml-2 text-xs font-normal text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            current
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.ipAddress ? `${s.ipAddress} · ` : ""}signed in{" "}
                        {new Date(s.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {i !== 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={revoking === s.token}
                      onClick={() => handleRevoke(s.token)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                    >
                      {revoking === s.token ? "Revoking…" : "Revoke"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-base text-red-700">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-red-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Sign out everywhere</p>
              <p className="text-xs text-muted-foreground">
                Ends this session and all other signed-in devices.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={signingOut}
              onClick={handleSignOut}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
