"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type AgentStatus = "active" | "paused" | "error" | "draft";

type Agent = {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  model: string;
  tasks: number;
  successRate: number;
  lastActive: string;
  capabilities: string[];
};

const agents: Agent[] = [
  {
    id: "app-builder",
    name: "App Builder",
    description:
      "Turns natural-language product requirements into production-ready application code.",
    status: "active",
    model: "GPT-5.6",
    tasks: 1248,
    successRate: 98.4,
    lastActive: "2 min ago",
    capabilities: ["Code", "Planning", "Deploy"],
  },
  {
    id: "research-agent",
    name: "Research Agent",
    description:
      "Researches technical topics, competitors, APIs, and implementation approaches.",
    status: "active",
    model: "GPT-5.6",
    tasks: 827,
    successRate: 96.8,
    lastActive: "8 min ago",
    capabilities: ["Research", "Web", "Analysis"],
  },
  {
    id: "code-reviewer",
    name: "Code Reviewer",
    description:
      "Reviews application code for bugs, security issues, performance problems, and maintainability.",
    status: "active",
    model: "GPT-5.6",
    tasks: 612,
    successRate: 99.1,
    lastActive: "14 min ago",
    capabilities: ["Code", "Security", "Testing"],
  },
  {
    id: "security-agent",
    name: "Security Guardian",
    description:
      "Continuously analyzes application surfaces for common vulnerabilities and unsafe configurations.",
    status: "paused",
    model: "GPT-5.6",
    tasks: 394,
    successRate: 97.5,
    lastActive: "1 hr ago",
    capabilities: ["Security", "Scanning", "Analysis"],
  },
  {
    id: "deployment-agent",
    name: "Deployment Agent",
    description:
      "Automates build, deployment, environment validation, and release workflows.",
    status: "error",
    model: "GPT-5.6",
    tasks: 281,
    successRate: 91.2,
    lastActive: "3 hrs ago",
    capabilities: ["Deploy", "CI/CD", "Monitoring"],
  },
];

const statusConfig: Record<
  AgentStatus,
  {
    label: string;
    icon: React.ElementType;
    className: string;
  }
> = {
  active: {
    label: "Active",
    icon: CheckCircle2,
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  paused: {
    label: "Paused",
    icon: Clock3,
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  error: {
    label: "Error",
    icon: XCircle,
    className:
      "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
  },
  draft: {
    label: "Draft",
    icon: Clock3,
    className:
      "border-muted-foreground/20 bg-muted text-muted-foreground",
  },
};

function StatusBadge({ status }: { status: AgentStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={config.className}>
      <Icon className="mr-1.5 h-3.5 w-3.5" />
      {config.label}
    </Badge>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Card className="group relative overflow-hidden transition-all hover:border-primary/30 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <CardTitle className="truncate text-base">
                {agent.name}
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {agent.model}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label={`Actions for ${agent.name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/agents/${agent.id}`}>Open agent</Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href={`/dashboard/agents/${agent.id}/settings`}>
                  Settings
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {agent.status === "active" ? (
                <DropdownMenuItem>Pause agent</DropdownMenuItem>
              ) : (
                <DropdownMenuItem>Activate agent</DropdownMenuItem>
              )}

              <DropdownMenuItem className="text-destructive focus:text-destructive">
                Delete agent
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent>
        <p className="min-h-[48px] text-sm leading-6 text-muted-foreground">
          {agent.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {agent.capabilities.map((capability) => (
            <Badge key={capability} variant="secondary" className="font-normal">
              {capability}
            </Badge>
          ))}
        </div>

        <div className="my-5 h-px bg-border" />

        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Tasks</p>
            <p className="mt-1 font-semibold">
              {agent.tasks.toLocaleString()}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Success</p>
            <p className="mt-1 font-semibold">{agent.successRate}%</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Activity</p>
            <p className="mt-1 truncate font-semibold">{agent.lastActive}</p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <StatusBadge status={agent.status} />

          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/agents/${agent.id}`}>
              Open
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AgentsPage() {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<AgentStatus | "all">("all");

  const filteredAgents = React.useMemo(() => {
    const query = search.trim().toLowerCase();

    return agents.filter((agent) => {
      const matchesSearch =
        !query ||
        agent.name.toLowerCase().includes(query) ||
        agent.description.toLowerCase().includes(query) ||
        agent.capabilities.some((capability) =>
          capability.toLowerCase().includes(query),
        );

      const matchesStatus =
        status === "all" || agent.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [search, status]);

  const activeCount = agents.filter(
    (agent) => agent.status === "active",
  ).length;

  const totalTasks = agents.reduce(
    (total, agent) => total + agent.tasks,
    0,
  );

  const averageSuccess =
    agents.length > 0
      ? (
          agents.reduce((total, agent) => total + agent.successRate, 0) /
          agents.length
        ).toFixed(1)
      : "0.0";

  return (
    <main className="flex-1 space-y-8 p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            AI Workspace
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Agents
          </h1>

          <p className="mt-2 max-w-2xl text-muted-foreground">
            Build, configure, and monitor the AI agents powering your
            applications.
          </p>
        </div>

        <Button asChild>
          <Link href="/dashboard/agents/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Agent
          </Link>
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Agents</p>
              <p className="text-2xl font-bold">{agents.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold">{activeCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-xl bg-blue-500/10 p-3 text-blue-600 dark:text-blue-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tasks Run</p>
              <p className="text-2xl font-bold">
                {totalTasks.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-xl bg-violet-500/10 p-3 text-violet-600 dark:text-violet-400">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Avg. Success Rate
              </p>
              <p className="text-2xl font-bold">{averageSuccess}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick capabilities */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/dashboard/agents/new?template=builder">
          <Card className="h-full transition-colors hover:border-primary/40">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <Code2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Build an Agent</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a custom autonomous workflow.
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/agents/new?template=security">
          <Card className="h-full transition-colors hover:border-primary/40">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Security Agent</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start with security-focused capabilities.
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/agents/new?template=automation">
          <Card className="h-full transition-colors hover:border-primary/40">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-xl bg-blue-500/10 p-3 text-blue-600 dark:text-blue-400">
                <Wrench className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Automation Agent</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Automate repetitive application workflows.
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search agents, capabilities, or descriptions..."
            className="pl-9"
          />
        </div>

        <Select
          value={status}
          onValueChange={(value) =>
            setStatus(value as AgentStatus | "all")
          }
        >
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Agent grid */}
      {filteredAgents.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex min-h-[300px] flex-col items-center justify-center text-center">
            <div className="rounded-full bg-muted p-4">
              <Bot className="h-7 w-7 text-muted-foreground" />
            </div>

            <h2 className="mt-5 text-lg font-semibold">
              No agents found
            </h2>

            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Try changing your search or filters, or create a new agent
              for your workspace.
            </p>

            <Button className="mt-5" asChild>
              <Link href="/dashboard/agents/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Agent
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
              }
