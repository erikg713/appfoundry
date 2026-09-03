"use client";

import { useMemo, useState } from "react";

type AgentStatus = "ready" | "running" | "complete" | "blocked";

type Agent = {
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  outputs: string[];
  status: AgentStatus;
};

const AGENTS: readonly Agent[] = [
  {
    name: "Planner",
    role: "Requirements & Product Planning",
    description:
      "Reads the user's prompt, extracts requirements, resolves ambiguity, and turns the idea into a concrete implementation plan.",
    capabilities: [
      "Requirement extraction",
      "Feature decomposition",
      "Page planning",
      "User-flow design",
      "Acceptance criteria",
    ],
    outputs: [
      "Product requirements",
      "Page map",
      "Feature specification",
      "Acceptance criteria",
    ],
    status: "ready",
  },
  {
    name: "Architect",
    role: "System Architecture",
    description:
      "Transforms the approved plan into a production-ready technical architecture covering data, routes, APIs, authentication, and application structure.",
    capabilities: [
      "Database modeling",
      "API design",
      "Route architecture",
      "Authentication design",
      "Security boundaries",
    ],
    outputs: [
      "Technical architecture",
      "Data models",
      "API contracts",
      "Application structure",
    ],
    status: "ready",
  },
  {
    name: "Coder",
    role: "Implementation",
    description:
      "Builds the application from the architecture, creating and modifying the required files while following established project conventions.",
    capabilities: [
      "Frontend development",
      "Backend development",
      "Database integration",
      "Authentication",
      "API integration",
    ],
    outputs: [
      "Source files",
      "Components",
      "API routes",
      "Database integration",
    ],
    status: "ready",
  },
  {
    name: "Tester",
    role: "Verification & Quality",
    description:
      "Runs the application and validates that the implementation works. It identifies failures, regressions, security issues, and incomplete functionality before release.",
    capabilities: [
      "Automated tests",
      "Build verification",
      "Runtime checks",
      "Regression testing",
      "Security validation",
    ],
    outputs: [
      "Test results",
      "Bug reports",
      "Validation report",
      "Release readiness",
    ],
    status: "ready",
  },
  {
    name: "Deployer",
    role: "Release & Deployment",
    description:
      "Prepares the verified application for export, self-hosting, or live deployment and validates the production build.",
    capabilities: [
      "Production builds",
      "Environment configuration",
      "Deployment preparation",
      "Export packaging",
      "Post-deploy verification",
    ],
    outputs: [
      "Production build",
      "Deployment package",
      "Environment configuration",
      "Deployment status",
    ],
    status: "ready",
  },
];

const STATUS_CONFIG: Record<
  AgentStatus,
  {
    label: string;
    dot: string;
    badge: string;
  }
> = {
  ready: {
    label: "Ready",
    dot: "bg-slate-400",
    badge: "border-slate-200 bg-slate-50 text-slate-600",
  },
  running: {
    label: "Running",
    dot: "bg-blue-500",
    badge: "border-blue-200 bg-blue-50 text-blue-700",
  },
  complete: {
    label: "Complete",
    dot: "bg-emerald-500",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  blocked: {
    label: "Blocked",
    dot: "bg-red-500",
    badge: "border-red-200 bg-red-50 text-red-700",
  },
};

function AgentIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    Planner: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 6h12M8 12h12M8 18h12" />
        <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" strokeLinecap="round" />
      </svg>
    ),
    Architect: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <path d="M10 6.5h4a3 3 0 0 1 3 3V14M17.5 10v4" />
      </svg>
    ),
    Coder: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" />
      </svg>
    ),
    Tester: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m5 12 4 4L19 6" />
        <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />
      </svg>
    ),
    Deployer: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3v12M7 8l5-5 5 5M5 14v4a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-4" />
      </svg>
    ),
  };

  return (
    <span className="h-5 w-5">
      {icons[name]}
    </span>
  );
}

export default function AgentsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const completedAgents = useMemo(
    () => AGENTS.filter((agent) => agent.status === "complete").length,
    [],
  );

  const progress = Math.round((completedAgents / AGENTS.length) * 100);

  return (
    <main className="min-h-full bg-white px-6 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Autonomous build pipeline
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              How AppFoundry builds your app
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Five specialized agents work in sequence to turn an idea into a
              tested, production-ready application.
            </p>
          </div>

          <div className="min-w-[180px] rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                Pipeline progress
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {progress}%
              </span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-slate-900 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="mt-2 text-xs text-slate-500">
              {completedAgents} of {AGENTS.length} stages complete
            </p>
          </div>
        </div>

        {/* Pipeline */}
        <section aria-label="AppFoundry agent pipeline">
          <ol className="space-y-4">
            {AGENTS.map((agent, index) => {
              const isLast = index === AGENTS.length - 1;
              const isExpanded = expanded === agent.name;
              const status = STATUS_CONFIG[agent.status];

              return (
                <li key={agent.name} className="relative">
                  {!isLast && (
                    <div
                      aria-hidden="true"
                      className="absolute left-6 top-[72px] bottom-[-16px] w-px bg-slate-200"
                    />
                  )}

                  <article
                    className={[
                      "relative rounded-2xl border bg-white transition",
                      isExpanded
                        ? "border-slate-300 shadow-sm"
                        : "border-slate-200",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded(isExpanded ? null : agent.name)
                      }
                      aria-expanded={isExpanded}
                      className="flex w-full items-start gap-4 p-5 text-left"
                    >
                      {/* Number */}
                      <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm">
                        <AgentIcon name={agent.name} />
                      </span>

                      {/* Main */}
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-950">
                            {index + 1}. {agent.name}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.badge}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                            />
                            {status.label}
                          </span>
                        </span>

                        <span className="mt-1 block text-xs font-medium text-slate-500">
                          {agent.role}
                        </span>

                        <span className="mt-2 block text-sm leading-6 text-slate-600">
                          {agent.description}
                        </span>
                      </span>

                      {/* Chevron */}
                      <span
                        className={[
                          "mt-1 shrink-0 text-slate-400 transition-transform",
                          isExpanded ? "rotate-180" : "",
                        ].join(" ")}
                        aria-hidden="true"
                      >
                        <svg
                          className="h-5 w-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                        <div className="grid gap-6 sm:grid-cols-2">
                          <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Capabilities
                            </h3>

                            <ul className="mt-3 space-y-2">
                              {agent.capabilities.map((item) => (
                                <li
                                  key={item}
                                  className="flex items-center gap-2 text-sm text-slate-700"
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Produces
                            </h3>

                            <ul className="mt-3 space-y-2">
                              {agent.outputs.map((item) => (
                                <li
                                  key={item}
                                  className="flex items-center gap-2 text-sm text-slate-700"
                                >
                                  <svg
                                    className="h-4 w-4 text-emerald-600"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path d="m5 12 4 4L19 6" />
                                  </svg>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Pipeline contract */}
        <section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <div className="flex gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white">
              <svg
                className="h-5 w-5 text-slate-700"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M12 3 4 7v5c0 4.5 3.1 7.7 8 9 4.9-1.3 8-4.5 8-9V7l-8-4Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">
                Agents operate as a controlled pipeline
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-600">
                Each stage consumes the previous stage's output. An agent does
                not advance the project until its required work is complete
                and the next stage has the information it needs.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
