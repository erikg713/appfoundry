import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ProjectsPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage your AppFoundry applications
          </p>
        </div>
        <Button disabled>New Project</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No projects yet</CardTitle>
          <CardDescription>
            Create your first project to start building with AI-assisted workflows.
            Project scaffolding and the AI code generation pipeline are coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            In the meantime, explore{" "}
            <Link href="/organizations" className="underline underline-offset-4">
              Organizations
            </Link>{" "}
            to set up multi-tenancy for your team.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
