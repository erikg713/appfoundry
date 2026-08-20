"use client";

import { useSession } from "@/lib/auth-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettingsPage() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (!session) {
    return <p className="text-muted-foreground">Not authenticated</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Name</p>
            <p className="text-base">{session.user.name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Email</p>
            <p className="text-base">{session.user.email}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">User ID</p>
            <p className="font-mono text-sm text-muted-foreground">{session.user.id}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            Profile editing, password change, connected accounts, and notification preferences
            will be available in a future release.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
