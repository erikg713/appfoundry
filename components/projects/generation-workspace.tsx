"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  startGeneration,
  advanceGeneration,
  cancelGeneration,
  getLatestRun,
} from "@/lib/generation";
import {
  Sparkles,
  Play,
  Square,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  FileCode2,
  FolderTree,
  Bot,
} from "lucide-react";

type Step = {
  id: string;
  agent: string;
  title: string;
  message: string | null;
  status: string;
  order: number;
};

type GeneratedFile = {
  id: string;
  path: string;
  language: string | null;
  content: string;
  size: number;
};

type GenerationRun = {
  id: string;
  prompt: string;
  status: string;
  error: string | null;
  startedAt: string | Date | null;
  completedAt: string | Date | null;
  steps: Step[];
  files: GeneratedFile[];
};

type ProjectSummary = {
  id: string;
  name: string;
  prompt: string | null;
  status: string;
};

const AGENT_ICONS: Record<string, string> = {
  planner: "1",
  architect: "2",
  coder: "3",
  tester: "4",
  deployer: "5",
};

function stepIcon(status: string) {
  if (status === "completed")
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "running")
    return <Loader2 className="h-4 w-4 text-amber-600 animate-spin" />;
  if (status === "failed")
    return <AlertCircle className="h-4 w-4 text-red-600" />;
  return <Circle className="h-4 w-4 text-slate-300" />;
}

export function GenerationWorkspace({
  project,
  initialRun,
}: {
  project: ProjectSummary;
  initialRun: GenerationRun | null;
}) {
  const [run, setRun] = useState<GenerationRun | null>(initialRun);
  const [prompt, setPrompt] = useState(project.prompt ?? "");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const advancingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isActive = run?.status === "running" || run?.status === "pending";

  const refresh = useCallback(async () => {
    const latest = await getLatestRun(project.id);
    if (latest) {
      setRun(latest as unknown as GenerationRun);
      if (latest.files?.length && !selectedFile) {
        setSelectedFile(latest.files[0] as GeneratedFile);
      }
    }
  }, [project.id, selectedFile]);

  // Auto-advance simulation while run is active
  useEffect(() => {
    if (!run || run.status !== "running") return;

    const tick = async () => {
      if (advancingRef.current) return;
      advancingRef.current = true;
      try {
        const result = await advanceGeneration(run.id);
        if (result.data) {
          setRun(result.data as unknown as GenerationRun);
          const files = (result.data as GenerationRun).files;
          if (files?.length) {
            setSelectedFile((prev) => prev ?? files[0]);
          }
        }
      } finally {
        advancingRef.current = false;
      }
    };

    timerRef.current = setTimeout(tick, 1600);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [run]);

  async function handleStart() {
    setError(null);
    setStarting(true);
    setSelectedFile(null);
    try {
      const result = await startGeneration({
        projectId: project.id,
        prompt: prompt.trim() || undefined,
      });
      if (result.error) {
        const msg =
          typeof result.error === "object"
            ? Object.values(result.error).flat().join(", ")
            : "Failed to start generation";
        setError(msg);
        return;
      }
      if (result.data) {
        setRun(result.data as unknown as GenerationRun);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setStarting(false);
    }
  }

  async function handleCancel() {
    if (!run) return;
    setError(null);
    const result = await cancelGeneration(run.id);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.data) {
      setRun(result.data as unknown as GenerationRun);
    }
    await refresh();
  }

  const completedSteps =
    run?.steps.filter((s) => s.status === "completed").length ?? 0;
  const totalSteps = run?.steps.length ?? 5;
  const progress =
    run?.status === "completed"
      ? 100
      : Math.round((completedSteps / Math.max(totalSteps, 1)) * 100);

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-600" />
          <h2 className="text-lg font-semibold tracking-tight">
            AI Generation Workspace
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {isActive ? (
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 text-sm border border-red-200 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition"
            >
              <Square className="h-3.5 w-3.5" />
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              disabled={starting || !prompt.trim()}
              className="inline-flex items-center gap-1.5 text-sm bg-black text-white px-4 py-1.5 rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
            >
              {starting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {run ? "Regenerate" : "Start generation"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Prompt */}
      <div className="bg-white border rounded-2xl p-5">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Generation prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isActive}
          rows={4}
          maxLength={5000}
          placeholder="Describe the app you want AppFoundry agents to build…"
          className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 resize-y disabled:bg-slate-50 disabled:text-slate-500"
        />
        <p className="mt-1.5 text-xs text-slate-400">
          Agents will plan, architect, code, test, and prepare deployment from
          this prompt.
        </p>
      </div>

      {/* Pipeline + Log */}
      {run && (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Agent pipeline */}
          <div className="lg:col-span-2 bg-white border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Bot className="h-4 w-4" />
                Agent pipeline
              </h3>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  run.status === "completed"
                    ? "bg-emerald-50 text-emerald-700"
                    : run.status === "failed"
                      ? "bg-red-50 text-red-700"
                      : run.status === "cancelled"
                        ? "bg-slate-100 text-slate-600"
                        : "bg-amber-50 text-amber-700"
                }`}
              >
                {run.status}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-slate-100 rounded-full mb-5 overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <ol className="space-y-3">
              {run.steps.map((step) => (
                <li
                  key={step.id}
                  className={`flex gap-3 rounded-xl px-3 py-2.5 transition ${
                    step.status === "running"
                      ? "bg-amber-50/80 border border-amber-100"
                      : step.status === "completed"
                        ? "bg-emerald-50/40"
                        : ""
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{stepIcon(step.status)}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">
                        {AGENT_ICONS[step.agent] ?? "·"}
                      </span>
                      <span className="text-sm font-medium">{step.title}</span>
                    </div>
                    {step.message && (
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        {step.message}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {run.error && (
              <p className="mt-4 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {run.error}
              </p>
            )}
          </div>

          {/* Activity / Files */}
          <div className="lg:col-span-3 space-y-4">
            {/* Activity log */}
            <div className="bg-white border rounded-2xl p-5">
              <h3 className="text-sm font-medium text-slate-700 mb-3">
                Activity
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto text-sm">
                {run.steps
                  .filter((s) => s.status !== "pending")
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex items-start gap-2 text-slate-600"
                    >
                      <span className="text-xs text-slate-400 mt-0.5 shrink-0">
                        {s.status === "running" ? "…" : "✓"}
                      </span>
                      <span>
                        <span className="font-medium text-slate-800">
                          {s.title}
                        </span>
                        {s.message ? ` — ${s.message}` : ""}
                      </span>
                    </div>
                  ))}
                {run.status === "completed" && (
                  <div className="flex items-start gap-2 text-emerald-700">
                    <span className="text-xs mt-0.5">✓</span>
                    <span>
                      Generation complete. {run.files.length} file
                      {run.files.length === 1 ? "" : "s"} produced.
                    </span>
                  </div>
                )}
                {run.status === "cancelled" && (
                  <div className="flex items-start gap-2 text-slate-500">
                    <span className="text-xs mt-0.5">—</span>
                    <span>Generation cancelled by user.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Generated files */}
            <div className="bg-white border rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b flex items-center gap-2">
                <FolderTree className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-medium text-slate-700">
                  Generated files
                </h3>
              </div>

              {run.files.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-slate-500">
                  {isActive
                    ? "Files will appear as agents complete their work…"
                    : "No files generated yet. Start a generation run to produce source."}
                </div>
              ) : (
                <div className="grid sm:grid-cols-5 min-h-[220px]">
                  <ul className="sm:col-span-2 border-r bg-slate-50/50 py-2">
                    {run.files.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedFile(f)}
                          className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition ${
                            selectedFile?.id === f.id
                              ? "bg-white border-l-2 border-l-violet-500 text-slate-900"
                              : "text-slate-600 hover:bg-white/80"
                          }`}
                        >
                          <FileCode2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate font-mono text-xs">
                            {f.path}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="sm:col-span-3 p-4 overflow-auto">
                    {selectedFile ? (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono text-slate-500">
                            {selectedFile.path}
                          </span>
                          <span className="text-xs text-slate-400">
                            {selectedFile.language ?? "text"}
                          </span>
                        </div>
                        <pre className="text-xs leading-relaxed bg-slate-950 text-slate-100 rounded-xl p-4 overflow-x-auto max-h-72">
                          <code>{selectedFile.content}</code>
                        </pre>
                      </>
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-8">
                        Select a file to preview
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state when no runs yet */}
      {!run && (
        <div className="border border-dashed rounded-2xl bg-slate-50 p-10 text-center">
          <Sparkles className="h-8 w-8 text-violet-400 mx-auto mb-3" />
          <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            Multi-agent pipeline is ready. Provide a prompt and start generation
            to watch Planner, Architect, Coder, Tester, and Deployer collaborate
            on your application.
          </p>
        </div>
      )}
    </div>
  );
}
