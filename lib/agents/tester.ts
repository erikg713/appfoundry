// lib/agents/tester.ts

import {
  AgentExecutionError,
  AgentValidationError,
  AgentCancelledError,
} from "@/lib/agents/errors";

import type {
  AgentContext,
  AgentDefinition,
  AgentInput,
  AgentOutput,
} from "@/lib/agents/runner";

// ─────────────────────────────────────────────────────────────────────────────
// AppFoundry — Tester Agent
// ─────────────────────────────────────────────────────────────────────────────
// Responsibilities:
//
//   • Inspect generated project files
//   • Detect obvious source/configuration problems
//   • Determine an appropriate test strategy
//   • Execute tests through an injected sandbox executor
//   • Parse test output
//   • Produce a machine-readable verification report
//
// IMPORTANT:
//   This agent does NOT execute arbitrary shell commands directly.
//   Production command execution should be provided by a sandbox/backend
//   executor with resource limits and isolation.
// ─────────────────────────────────────────────────────────────────────────────

export type TestSeverity =
  | "info"
  | "warning"
  | "error";

export type TestIssue = {
  severity: TestSeverity;
  code: string;
  message: string;
  file?: string;
  line?: number;
  details?: Record<string, unknown>;
};

export type TestCommand = {
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
};

export type TestExecutionResult = {
  exitCode: number;
  stdout?: string;
  stderr?: string;
  durationMs?: number;
  timedOut?: boolean;
};

export type TestExecutor = (
  command: TestCommand,
  context: {
    signal: AbortSignal;
    runId: string;
    projectId?: string;
  },
) => Promise<TestExecutionResult>;

export type TesterInput = AgentInput & {
  files?: Record<string, string>;

  /**
   * Optional project root.
   */
  rootDir?: string;

  /**
   * Explicit commands supplied by the build pipeline.
   */
  commands?: TestCommand[];

  /**
   * Skip command execution and perform static verification only.
   */
  staticOnly?: boolean;

  /**
   * Fail when warnings are found.
   */
  strict?: boolean;

  /**
   * Optional executor injected by the server/sandbox layer.
   */
  executor?: TestExecutor;
};

export type TestSummary = {
  passed: boolean;
  score: number;

  filesChecked: number;
  commandsRun: number;

  testsDetected: number;
  testsPassed: number;
  testsFailed: number;

  errors: number;
  warnings: number;

  durationMs: number;
};

export type TesterOutput = AgentOutput & {
  passed: boolean;
  summary: TestSummary;
  issues: TestIssue[];
  commands: Array<
    TestCommand & {
      result?: TestExecutionResult;
    }
  >;
  recommendations: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_COMMAND_TIMEOUT_MS = 3 * 60 * 1000;

const MAX_COMMAND_TIMEOUT_MS = 10 * 60 * 1000;

const MAX_OUTPUT_LENGTH = 50_000;

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(
    max,
    Math.max(min, value),
  );
}

function truncate(
  value: string | undefined,
  max = MAX_OUTPUT_LENGTH,
): string {
  if (!value) {
    return "";
  }

  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max)}\n...[truncated]`;
}

function normalizeFiles(
  files: unknown,
): Record<string, string> {
  if (
    !files ||
    typeof files !== "object" ||
    Array.isArray(files)
  ) {
    return {};
  }

  const normalized: Record<
    string,
    string
  > = {};

  for (const [
    path,
    content,
  ] of Object.entries(
    files as Record<string, unknown>,
  )) {
    if (
      typeof path !== "string" ||
      typeof content !== "string"
    ) {
      continue;
    }

    normalized[path] = content;
  }

  return normalized;
}

function hasFile(
  files: Record<string, string>,
  name: string,
): boolean {
  return Object.keys(files).some(
    (path) =>
      path === name ||
      path.endsWith(`/${name}`),
  );
}

function findFiles(
  files: Record<string, string>,
  pattern: RegExp,
): string[] {
  return Object.keys(files).filter(
    (path) => pattern.test(path),
  );
}

function getExtension(
  path: string,
): string {
  const index = path.lastIndexOf(".");

  if (index === -1) {
    return "";
  }

  return path.slice(index).toLowerCase();
}

function isSourceFile(
  path: string,
): boolean {
  return [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".py",
    ".go",
    ".rs",
    ".java",
    ".kt",
    ".rb",
  ].includes(getExtension(path));
}

// ─────────────────────────────────────────────────────────────────────────────
// Package manager detection
// ─────────────────────────────────────────────────────────────────────────────

function detectPackageManager(
  files: Record<string, string>,
): "pnpm" | "yarn" | "npm" | "bun" | null {
  if (
    hasFile(
      files,
      "pnpm-lock.yaml",
    )
  ) {
    return "pnpm";
  }

  if (
    hasFile(
      files,
      "yarn.lock",
    )
  ) {
    return "yarn";
  }

  if (
    hasFile(
      files,
      "bun.lockb",
    ) ||
    hasFile(
      files,
      "bun.lock",
    )
  ) {
    return "bun";
  }

  if (
    hasFile(
      files,
      "package-lock.json",
    )
  ) {
    return "npm";
  }

  if (
    hasFile(
      files,
      "package.json",
    )
  ) {
    return "npm";
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test command discovery
// ─────────────────────────────────────────────────────────────────────────────

function discoverCommands(
  files: Record<string, string>,
): TestCommand[] {
  const commands: TestCommand[] = [];

  const packageJsonPath = Object.keys(
    files,
  ).find(
    (path) =>
      path === "package.json" ||
      path.endsWith("/package.json"),
  );

  if (packageJsonPath) {
    try {
      const packageJson = JSON.parse(
        files[packageJsonPath],
      ) as {
        scripts?: Record<
          string,
          string
        >;
      };

      const scripts =
        packageJson.scripts ?? {};

      const testScript =
        Object.keys(scripts).find(
          (name) =>
            name === "test" ||
            name.startsWith("test:"),
        );

      if (testScript) {
        const manager =
          detectPackageManager(files) ??
          "npm";

        if (manager === "npm") {
          commands.push({
            command: "npm",
            args: [
              "run",
              testScript,
            ],
          });
        } else if (
          manager === "pnpm"
        ) {
          commands.push({
            command: "pnpm",
            args: [
              testScript,
            ],
          });
        } else if (
          manager === "yarn"
        ) {
          commands.push({
            command: "yarn",
            args: [
              testScript,
            ],
          });
        } else if (
          manager === "bun"
        ) {
          commands.push({
            command: "bun",
            args: [
              "run",
              testScript,
            ],
          });
        }
      }
    } catch {
      // package.json syntax is handled
      // by static validation below.
    }
  }

  if (
    findFiles(
      files,
      /(^|\/)(__tests__|tests)(\/|$)/i,
    ).length > 0
  ) {
    if (
      !commands.some(
        (item) =>
          item.command === "npm" &&
          item.args?.includes("test"),
      )
    ) {
      const manager =
        detectPackageManager(files);

      if (manager === "npm") {
        commands.push({
          command: "npm",
          args: [
            "test",
            "--",
            "--runInBand",
          ],
        });
      }
    }
  }

  return commands;
}

// ─────────────────────────────────────────────────────────────────────────────
// Static validation
// ─────────────────────────────────────────────────────────────────────────────

function validatePackageJson(
  files: Record<string, string>,
  issues: TestIssue[],
): void {
  const packageFiles =
    findFiles(
      files,
      /(^|\/)package\.json$/,
    );

  for (const path of packageFiles) {
    try {
      const parsed =
        JSON.parse(files[path]);

      if (
        !parsed ||
        typeof parsed !== "object"
      ) {
        issues.push({
          severity: "error",
          code: "INVALID_PACKAGE_JSON",
          message:
            "package.json does not contain a valid object.",
          file: path,
        });

        continue;
      }

      if (
        !parsed.name &&
        path === "package.json"
      ) {
        issues.push({
          severity: "warning",
          code: "PACKAGE_NAME_MISSING",
          message:
            "package.json does not define a package name.",
          file: path,
        });
      }
    } catch (error) {
      issues.push({
        severity: "error",
        code: "INVALID_PACKAGE_JSON",
        message:
          "package.json contains invalid JSON.",
        file: path,
        details: {
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
      });
    }
  }
}

function validateTypeScriptConfig(
  files: Record<string, string>,
  issues: TestIssue[],
): void {
  const configFiles =
    findFiles(
      files,
      /(^|\/)tsconfig(\.[^/]+)?\.json$/,
    );

  for (const path of configFiles) {
    try {
      JSON.parse(files[path]);
    } catch {
      issues.push({
        severity: "error",
        code: "INVALID_TSCONFIG",
        message:
          "TypeScript configuration contains invalid JSON.",
        file: path,
      });
    }
  }
}

function validateEnvironmentFiles(
  files: Record<string, string>,
  issues: TestIssue[],
): void {
  const envFiles =
    findFiles(
      files,
      /(^|\/)\.env(\.[^/]+)?$/,
    );

  for (const path of envFiles) {
    const lines =
      files[path].split(/\r?\n/);

    lines.forEach(
      (line, index) => {
        const trimmed =
          line.trim();

        if (
          !trimmed ||
          trimmed.startsWith("#")
        ) {
          return;
        }

        if (
          !/^[A-Za-z_][A-Za-z0-9_]*=/.test(
            trimmed,
          )
        ) {
          issues.push({
            severity: "warning",
            code: "INVALID_ENV_LINE",
            message:
              "Environment file contains a line that does not look like KEY=VALUE.",
            file: path,
            line: index + 1,
          });
        }
      },
    );
  }
}

function validateSourceFiles(
  files: Record<string, string>,
  issues: TestIssue[],
): void {
  const dangerousPatterns: Array<{
    pattern: RegExp;
    code: string;
    message: string;
    severity: TestSeverity;
  }> = [
    {
      pattern: /\bTODO\s*:\s*FIXME\b/i,
      code: "UNRESOLVED_FIXME",
      message:
        "Source contains an explicit TODO/FIXME marker.",
      severity: "warning",
    },
    {
      pattern: /<<<<<<<\s*HEAD/,
      code: "MERGE_CONFLICT",
      message:
        "Unresolved Git merge conflict detected.",
      severity: "error",
    },
    {
      pattern: /^=======\s*$/m,
      code: "MERGE_CONFLICT",
      message:
        "Possible unresolved Git merge conflict detected.",
      severity: "error",
    },
    {
      pattern: />>>>>>>/,
      code: "MERGE_CONFLICT",
      message:
        "Unresolved Git merge conflict detected.",
      severity: "error",
    },
  ];

  for (const [
    path,
    content,
  ] of Object.entries(files)) {
    if (!isSourceFile(path)) {
      continue;
    }

    const lines =
      content.split(/\r?\n/);

    lines.forEach(
      (line, index) => {
        for (const rule of dangerousPatterns) {
          if (
            rule.pattern.test(line)
          ) {
            issues.push({
              severity:
                rule.severity,
              code: rule.code,
              message:
                rule.message,
              file: path,
              line: index + 1,
            });
          }
        }
      },
    );
  }
}

function validateProjectStructure(
  files: Record<string, string>,
  issues: TestIssue[],
): void {
  if (
    Object.keys(files).length === 0
  ) {
    issues.push({
      severity: "error",
      code: "NO_FILES",
      message:
        "No project files were supplied to the tester.",
    });

    return;
  }

  const hasPackageJson =
    hasFile(
      files,
      "package.json",
    );

  const hasPythonProject =
    hasFile(
      files,
      "pyproject.toml",
    ) ||
    hasFile(
      files,
      "requirements.txt",
    );

  const hasSource =
    Object.keys(files).some(
      isSourceFile,
    );

  if (
    !hasPackageJson &&
    !hasPythonProject &&
    !hasSource
  ) {
    issues.push({
      severity: "warning",
      code: "UNKNOWN_PROJECT_TYPE",
      message:
        "Could not determine the project's language or package structure.",
    });
  }
}

function performStaticChecks(
  files: Record<string, string>,
): TestIssue[] {
  const issues: TestIssue[] = [];

  validateProjectStructure(
    files,
    issues,
  );

  validatePackageJson(
    files,
    issues,
  );

  validateTypeScriptConfig(
    files,
    issues,
  );

  validateEnvironmentFiles(
    files,
    issues,
  );

  validateSourceFiles(
    files,
    issues,
  );

  return issues;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test output parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseTestOutput(
  result: TestExecutionResult,
): {
  testsDetected: number;
  testsPassed: number;
  testsFailed: number;
  issues: TestIssue[];
} {
  const output =
    `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

  let testsDetected = 0;
  let testsPassed = 0;
  let testsFailed = 0;

  const issues: TestIssue[] = [];

  // Jest / Vitest style.
  const jestMatch =
    output.match(
      /Tests:\s+(?:(\d+)\s+failed,\s+)?(?:(\d+)\s+passed,\s+)?(\d+)\s+total/i,
    );

  if (jestMatch) {
    const failed =
      Number(jestMatch[1] ?? 0);

    const passed =
      Number(jestMatch[2] ?? 0);

    const total =
      Number(jestMatch[3] ?? 0);

    testsDetected += total;
    testsPassed += passed;
    testsFailed += failed;
  }

  // Generic "X passing / X failing".
  const passingMatch =
    output.match(
      /(\d+)\s+passing/i,
    );

  const failingMatch =
    output.match(
      /(\d+)\s+failing/i,
    );

  if (passingMatch) {
    testsPassed += Number(
      passingMatch[1],
    );
  }

  if (failingMatch) {
    testsFailed += Number(
      failingMatch[1],
    );
  }

  testsDetected = Math.max(
    testsDetected,
    testsPassed + testsFailed,
  );

  if (
    result.timedOut
  ) {
    issues.push({
      severity: "error",
      code: "TEST_TIMEOUT",
      message:
        "Test command exceeded its execution timeout.",
    });
  }

  if (
    result.exitCode !== 0
  ) {
    issues.push({
      severity: "error",
      code: "TEST_COMMAND_FAILED",
      message:
        `Test command exited with code ${result.exitCode}.`,
      details: {
        stdout: truncate(
          result.stdout,
        ),
        stderr: truncate(
          result.stderr,
        ),
      },
    });
  }

  return {
    testsDetected,
    testsPassed,
    testsFailed,
    issues,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────────────────────────

function calculateScore(
  issues: TestIssue[],
  testsDetected: number,
  testsPassed: number,
): number {
  let score = 100;

  for (const issue of issues) {
    if (
      issue.severity === "error"
    ) {
      score -= 20;
    } else if (
      issue.severity === "warning"
    ) {
      score -= 5;
    }
  }

  if (
    testsDetected > 0
  ) {
    const passRate =
      testsPassed /
      testsDetected;

    score =
      score * passRate;
  }

  return Math.round(
    clamp(score, 0, 100),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recommendations
// ─────────────────────────────────────────────────────────────────────────────

function generateRecommendations(
  issues: TestIssue[],
  summary: TestSummary,
): string[] {
  const recommendations: string[] = [];

  if (
    summary.testsDetected === 0
  ) {
    recommendations.push(
      "Add automated tests covering the application's critical paths.",
    );
  }

  if (
    summary.testsFailed > 0
  ) {
    recommendations.push(
      "Fix failing tests before marking the build production-ready.",
    );
  }

  if (
    issues.some(
      (issue) =>
        issue.code ===
        "MERGE_CONFLICT",
    )
  ) {
    recommendations.push(
      "Resolve all Git merge conflict markers before deployment.",
    );
  }

  if (
    issues.some(
      (issue) =>
        issue.code ===
        "INVALID_PACKAGE_JSON",
    )
  ) {
    recommendations.push(
      "Repair package.json before installing dependencies or running tests.",
    );
  }

  if (
    issues.some(
      (issue) =>
        issue.code ===
        "TEST_TIMEOUT",
    )
  ) {
    recommendations.push(
      "Investigate hanging tests and add appropriate test isolation/timeouts.",
    );
  }

  if (
    summary.warnings > 0
  ) {
    recommendations.push(
      "Review all tester warnings before production deployment.",
    );
  }

  if (
    recommendations.length === 0
  ) {
    recommendations.push(
      "No immediate test issues detected. Continue with the next pipeline stage.",
    );
  }

  return recommendations;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tester implementation
// ─────────────────────────────────────────────────────────────────────────────

export async function runTester(
  input: TesterInput,
  context: AgentContext,
): Promise<TesterOutput> {
  const startedAt =
    Date.now();

  const files =
    normalizeFiles(
      input.files,
    );

  if (
    !input ||
    typeof input !== "object"
  ) {
    throw new AgentValidationError(
      "Tester input must be an object.",
      {
        agentName:
          context.agentName,
        runId:
          context.runId,
      },
    );
  }

  await context.reportProgress(
    5,
    "Inspecting project files...",
  );

  if (
    context.signal.aborted
  ) {
    throw new AgentCancelledError(
      context.agentName,
      context.runId,
    );
  }

  const issues =
    performStaticChecks(
      files,
    );

  await context.reportProgress(
    30,
    "Static verification completed.",
  );

  if (
    context.signal.aborted
  ) {
    throw new AgentCancelledError(
      context.agentName,
      context.runId,
    );
  }

  const commands =
    input.commands ??
    discoverCommands(files);

  const executedCommands:
    TesterOutput["commands"] = [];

  let testsDetected = 0;
  let testsPassed = 0;
  let testsFailed = 0;

  const executor =
    input.executor;

  if (
    !input.staticOnly &&
    commands.length > 0
  ) {
    if (!executor) {
      issues.push({
        severity: "warning",
        code: "NO_TEST_EXECUTOR",
        message:
          "Test commands were discovered, but no sandbox executor was supplied. Static verification was performed only.",
      });
    } else {
      for (
        let index = 0;
        index < commands.length;
        index++
      ) {
        if (
          context.signal.aborted
        ) {
          throw new AgentCancelledError(
            context.agentName,
            context.runId,
          );
        }

        const command =
          commands[index];

        await context.reportProgress(
          30 +
            (index /
              Math.max(
                commands.length,
                1,
              )) *
              55,
          `Running test command ${index + 1}/${commands.length}...`,
        );

        const commandTimeout = clamp(
          command.timeoutMs ??
            DEFAULT_COMMAND_TIMEOUT_MS,
          1_000,
          MAX_COMMAND_TIMEOUT_MS,
        );

        let result:
          | TestExecutionResult
          | undefined;

        try {
          result =
            await Promise.race([
              executor(
                command,
                {
                  signal:
                    context.signal,
                  runId:
                    context.runId,
                  projectId:
                    context.projectId,
                },
              ),

              new Promise<TestExecutionResult>(
                (resolve) => {
                  const timer =
                    setTimeout(
                      () => {
                        resolve({
                          exitCode:
                            124,
                          stderr:
                            `Command timed out after ${commandTimeout}ms.`,
                          timedOut:
                            true,
                        });
                      },
                      commandTimeout,
                    );

                  context.signal.addEventListener(
                    "abort",
                    () => {
                      clearTimeout(
                        timer,
                      );
                    },
                    {
                      once: true,
                    },
                  );
                },
              ),
            ]);

          result = {
            ...result,
            stdout:
              truncate(
                result.stdout,
              ),
            stderr:
              truncate(
                result.stderr,
              ),
          };

          const parsed =
            parseTestOutput(
              result,
            );

          testsDetected +=
            parsed.testsDetected;

          testsPassed +=
            parsed.testsPassed;

          testsFailed +=
            parsed.testsFailed;

          issues.push(
            ...parsed.issues,
          );

          executedCommands.push({
            ...command,
            result,
          });
        } catch (error) {
          issues.push({
            severity: "error",
            code: "TEST_EXECUTION_ERROR",
            message:
              error instanceof Error
                ? error.message
                : String(error),
            details: {
              command:
                command.command,
              args:
                command.args ?? [],
            },
          });

          executedCommands.push({
            ...command,
          });
        }
      }
    }
  }

  await context.reportProgress(
    90,
    "Building test report...",
  );

  const errors =
    issues.filter(
      (issue) =>
        issue.severity === "error",
    ).length;

  const warnings =
    issues.filter(
      (issue) =>
        issue.severity === "warning",
    ).length;

  const durationMs =
    Date.now() - startedAt;

  const summaryBase = {
    filesChecked:
      Object.keys(files).length,

    commandsRun:
      executedCommands.filter(
        (command) =>
          command.result !==
          undefined,
      ).length,

    testsDetected,
    testsPassed,
    testsFailed,

    errors,
    warnings,

    durationMs,
  };

  const score =
    calculateScore(
      issues,
      testsDetected,
      testsPassed,
    );

  const passed =
    errors === 0 &&
    testsFailed === 0 &&
    (!input.strict ||
      warnings === 0);

  const summary: TestSummary = {
    ...summaryBase,
    passed,
    score,
  };

  const recommendations =
    generateRecommendations(
      issues,
      summary,
    );

  await context.reportProgress(
    100,
    passed
      ? "Testing completed successfully."
      : "Testing completed with issues.",
  );

  return {
    passed,

    summary,

    issues,

    commands:
      executedCommands,

    recommendations,

    result: {
      passed,
      score,
    },

    metadata: {
      agent:
        context.agentName,
      runId:
        context.runId,
      testedAt:
        new Date().toISOString(),
      projectId:
        context.projectId,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent definition
// ─────────────────────────────────────────────────────────────────────────────

export const testerAgent: AgentDefinition = {
  name: "Tester",

  description:
    "Validates generated applications through static checks and isolated automated test execution.",

  critical: true,

  timeoutMs:
    DEFAULT_TIMEOUT_MS,

  handler: runTester,
};

export default testerAgent;
