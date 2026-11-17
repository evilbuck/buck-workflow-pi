/**
 * Shared types for the repaired `/b-loop` OMP eval runner.
 * Zero external package dependencies so OMP's Bun worker links cleanly.
 */

export type Milestone = "starting" | "working" | "finished" | "verified";

export type PhaseDifficulty = "easy" | "medium" | "hard";

export type BuckBuildHint = "/b-build" | "/b-build-hard";

export type WorkflowStateTool = (args: Record<string, unknown>) => Promise<unknown>;

export interface EvalBridges {
  agent?: (prompt: string, options?: Record<string, unknown>) => Promise<unknown>;
  wait?: (handles: unknown[], options?: Record<string, unknown>) => Promise<unknown>;
  judge?: (
    state: unknown,
    questions: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  sh?: (cmd: string | TemplateStringsArray, ...args: unknown[]) => Promise<unknown>;
  phase?: (title: string) => void;
  log?: (message: string) => void;
  budget?: { remaining?: () => Promise<number | undefined> };
  tool?: {
    workflow_state?: WorkflowStateTool;
    [key: string]: unknown;
  };
}

export type ValidatedBridges = Required<Omit<EvalBridges, "budget" | "tool">> & {
  budget?: EvalBridges["budget"];
  tool: {
    workflow_state: WorkflowStateTool;
    [key: string]: unknown;
  };
};

export interface BranchValidationResult {
  branchRef: string;
  branchName: string;
  headCommit: string;
}

export interface PinnedPhase {
  phaseNum: number;
  order: number;
  logicalName: string;
  slug: string;
  token: string;
  revision: string;
  sha256: string;
  status: string;
  difficulty: PhaseDifficulty;
  buckHint: BuckBuildHint;
  files: string[];
  acceptanceCriteria: string[];
}

export interface PinnedPlan {
  subjectId: string;
  branchRef: string;
  branchName: string;
  headCommit: string;
  adapter: "repo-files";
  planLogicalName: string;
  planRevision: string;
  planSha256: string;
  overviewLogicalName?: string;
  phases: PinnedPhase[];
}

export interface BuckLoopOptions {
  args?: string;
  subject?: string;
  cwd?: string;
  bridges?: EvalBridges;
  configPath?: string;
  xdgConfigHome?: string;
}

export interface BuckLoopResult {
  ok: boolean;
  state: "pinned" | "blocked" | "done" | "yielded";
  subject?: string;
  branch?: string;
  message?: string;
  pinnedPlan?: PinnedPlan;
  phase?: string;
  milestone?: Milestone;
}
