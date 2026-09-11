export const SCHEMA_VERSION = 1 as const;
export type SchemaVersion = typeof SCHEMA_VERSION;

export const FEEDBACK_VERDICTS = [
  "valid",
  "invalid",
  "already_done",
  "unsure",
  "nit",
  "out_of_scope",
] as const;

export type FeedbackVerdict = (typeof FEEDBACK_VERDICTS)[number];

export const MACHINE_STATES = [
  "idle",
  "resolving_pr",
  "awaiting_base",
  "checking_out",
  "rebasing",
  "resolving_conflicts",
  "fetching_feedback",
  "validating_feedback",
  "planning_fix",
  "building",
  "reviewing",
  "buck_review",
  "verifying",
  "committing",
  "pushing",
  "refreshing",
  "checking_merge_gate",
  "enabling_auto_merge",
  "waiting",
  "blocked",
  "exhausted",
  "paused",
  "merged",
] as const;

export type MachineState = (typeof MACHINE_STATES)[number];

export const TERMINAL_STATES = ["blocked", "exhausted", "paused", "merged"] as const;
export type TerminalState = (typeof TERMINAL_STATES)[number];

export type OwnershipMarker = "D" | "L" | "H";

export type MergeMethod = "squash" | "rebase" | "merge";

export type GithubPrState = "OPEN" | "MERGED" | "CLOSED";

export const DEFAULT_POLL_DELAYS_MS = [
  30_000, 60_000, 120_000, 240_000, 480_000, 600_000, 600_000,
] as const;

export const DEFAULT_MAX_POLLS = 8;
export const DEFAULT_DELAYED_WAIT_MS = 2_130_000;
export const MAX_CONFLICT_STEPS = 20;
export const MAX_HISTORY = 50;

export interface CliOptions {
  schemaVersion: SchemaVersion;
  pr?: string;
  resume: boolean;
  base?: string;
  mergeMethod?: MergeMethod;
  initialDelayMs: number;
  backoff: number;
  maxDelayMs: number;
  maxPolls: number;
  model?: string;
}

export function defaultCliOptions(overrides: Partial<CliOptions> = {}): CliOptions {
  return {
    schemaVersion: SCHEMA_VERSION,
    resume: false,
    initialDelayMs: DEFAULT_POLL_DELAYS_MS[0],
    backoff: 2,
    maxDelayMs: DEFAULT_POLL_DELAYS_MS[DEFAULT_POLL_DELAYS_MS.length - 1],
    maxPolls: DEFAULT_MAX_POLLS,
    ...overrides,
  };
}

export interface PollState {
  initialDelayMs: number;
  backoff: number;
  maxDelayMs: number;
  maxPolls: number;
  delaysMs: number[];
  pollIndex: number;
  observationCount: number;
  noProgressCount: number;
  nextPollAtMs: number | null;
}

export function defaultPollState(options: CliOptions = defaultCliOptions()): PollState {
  return {
    initialDelayMs: options.initialDelayMs,
    backoff: options.backoff,
    maxDelayMs: options.maxDelayMs,
    maxPolls: options.maxPolls,
    delaysMs: [...DEFAULT_POLL_DELAYS_MS],
    pollIndex: 0,
    observationCount: 0,
    noProgressCount: 0,
    nextPollAtMs: null,
  };
}

export function delayedWaitTotalMs(delays: readonly number[] = DEFAULT_POLL_DELAYS_MS): number {
  let total = 0;
  for (const delay of delays) total += delay;
  return total;
}

export function nextPollDelayMs(
  observationCount: number,
  delays: readonly number[] = DEFAULT_POLL_DELAYS_MS,
): number {
  const last = delays.length - 1;
  const index = Math.min(Math.max(0, observationCount - 1), last);
  return delays[index]!;
}

export function noProgressExhausts(observationCount: number, maxPolls: number): boolean {
  return observationCount + 1 >= maxPolls;
}

export function resetPollState(poll: PollState): PollState {
  return {
    ...poll,
    pollIndex: 0,
    observationCount: 0,
    noProgressCount: 0,
    nextPollAtMs: null,
  };
}

export function consumePollObservation(poll: PollState, nowMs: number): PollState {
  const observationCount = poll.observationCount + 1;
  const delay = nextPollDelayMs(observationCount, poll.delaysMs);
  return {
    ...poll,
    observationCount,
    pollIndex: Math.max(0, observationCount - 1),
    noProgressCount: poll.noProgressCount + 1,
    nextPollAtMs: nowMs + delay,
  };
}

export type FeedbackKind = "review" | "inline_comment" | "conversation_comment" | "review_thread";

export interface FeedbackVersion {
  schemaVersion: SchemaVersion;
  id: string;
  nodeId: string;
  kind: FeedbackKind;
  author: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  resolved: boolean;
  outdated: boolean;
  path?: string;
  line?: number;
  originalCommit?: string;
  content: string;
  contentDigest: string;
  fingerprint: string;
}

export interface StoredVerdict {
  fingerprint: string;
  verdict: FeedbackVerdict;
  evidence: string;
  file?: string;
  line?: number;
  round?: number;
}

export function isActionableVerdict(verdict: FeedbackVerdict): boolean {
  return verdict === "valid" || verdict === "nit";
}

export type RoleName = "validator" | "planner" | "builder" | "reviewer" | "conflict";

export interface RoleResultBase {
  schemaVersion: SchemaVersion;
  role: RoleName;
}

export interface ValidatorRoleResult extends RoleResultBase {
  role: "validator";
  classifications: StoredVerdict[];
}

export interface PlannerRoleResult extends RoleResultBase {
  role: "planner";
  artifactPath: string;
  feedbackIds: string[];
  acceptance: string[];
  verificationCommands: string[];
}

export interface BuilderRoleResult extends RoleResultBase {
  role: "builder";
  expectedPaths: string[];
  actualPaths: string[];
  coherent: boolean;
}

export type ReviewOutcome = "pass" | "iterate" | "block";

export interface ReviewerRoleResult extends RoleResultBase {
  role: "reviewer";
  verdict: ReviewOutcome;
  headOid: string;
  diffDigest: string;
  findings: string[];
}

export interface ConflictRoleResult extends RoleResultBase {
  role: "conflict";
  resolvedPaths: string[];
  remainingMarkers: boolean;
}

export type RoleResult =
  | ValidatorRoleResult
  | PlannerRoleResult
  | BuilderRoleResult
  | ReviewerRoleResult
  | ConflictRoleResult;

export interface RequiredCheck {
  name: string;
  status: string;
  conclusion: string | null;
}

export interface MergeGateSnapshot {
  schemaVersion: SchemaVersion;
  headOid: string;
  baseOid: string;
  baseRefName: string;
  draft: boolean;
  mergeable: boolean | null;
  requiredChecks: RequiredCheck[];
  reviewDecision: string | null;
  autoMerge: boolean;
  githubState: GithubPrState;
  mergeCommitOid: string | null;
}

export interface ReviewAttestation {
  headOid: string;
  diffDigest: string;
  verdict: ReviewOutcome;
}

export interface VerificationAttestation {
  headOid: string;
  diffDigest: string;
  passed: boolean;
  commands: string[];
  exitCodes: number[];
}

export interface BuildAttestation {
  headOid: string;
  expectedPaths: string[];
  actualPaths: string[];
}

export function attestationsForHead(
  review: ReviewAttestation | null,
  verification: VerificationAttestation | null,
  headOid: string,
): {
  reviewAttestation: ReviewAttestation | null;
  verificationAttestation: VerificationAttestation | null;
} {
  return {
    reviewAttestation: review?.headOid === headOid ? review : null,
    verificationAttestation: verification?.headOid === headOid ? verification : null,
  };
}

export type CacheProvenance = "flag" | "saved-run" | "git-local" | "b-pr-base" | "selected" | null;

export interface ResolvedPr {
  number: number;
  url: string;
  owner: string;
  repo: string;
  headRef: string;
  baseRef: string;
  headOid: string;
  draft: boolean;
  state: GithubPrState;
  mergeCapabilities: { squash: boolean; rebase: boolean; merge: boolean };
}

export interface BaseCache {
  branch: string;
  provenance: CacheProvenance;
}

export type BlockCode =
  | "ambiguous_pr"
  | "closed_pr"
  | "fork_cannot_push"
  | "github_unavailable"
  | "base_mismatch"
  | "dirty_worktree"
  | "checkout_failed"
  | "unexpected_git_state"
  | "conflict_limit"
  | "conflict_no_progress"
  | "api_failure"
  | "unsure_or_scope"
  | "plan_invalid"
  | "build_failed"
  | "review_block"
  | "local_gate_fail"
  | "commit_failed"
  | "push_lease_rejected"
  | "hard_gate_fail"
  | "auto_merge_rejected"
  | "unknown_dirty_paths"
  | "malformed_role_output";

export interface BlockReason {
  schemaVersion: SchemaVersion;
  code: BlockCode;
  message: string;
  evidence?: string;
  resumeCommand?: string;
}

export interface TransitionRecord {
  at: string;
  from: MachineState;
  event: string;
  to: MachineState;
}

export interface RunState {
  schemaVersion: SchemaVersion;
  owner: string;
  repo: string;
  prNumber: number;
  prUrl: string;
  headRef: string;
  baseRef: string;
  worktreeId: string;
  currentState: MachineState;
  lastEvent: string | null;
  cachedBase: string | null;
  cacheProvenance: CacheProvenance;
  localHeadOid: string | null;
  remoteHeadOid: string | null;
  baseHeadOid: string | null;
  mergeCommitOid: string | null;
  rewrittenPublished: boolean;
  poll: PollState;
  feedback: FeedbackVersion[];
  verdicts: Record<string, StoredVerdict>;
  iterationArtifactPath: string | null;
  reviewArtifactPath: string | null;
  ownedDirtyPaths: string[];
  diffDigest: string | null;
  buildAttestation: BuildAttestation | null;
  reviewAttestation: ReviewAttestation | null;
  verificationAttestation: VerificationAttestation | null;
  createdCommitShas: string[];
  verifiedPushOid: string | null;
  mergeGate: MergeGateSnapshot | null;
  autoMergeRequested: boolean;
  mergeMethod: MergeMethod | null;
  blockReason: BlockReason | null;
  pauseReason: string | null;
  exhaustReason: string | null;
  conflictSteps: number;
  unresolvedConflictPaths: string[];
  history: TransitionRecord[];
  updatedAt: string;
}

export interface PrManagerContext extends RunState {
  options: CliOptions;
  pr: ResolvedPr | null;
  cache: BaseCache | null;
}

export type PrManagerEvent =
  | { type: "START"; options: CliOptions }
  | { type: "CACHE_MISSING_OR_MISMATCH"; pr: ResolvedPr; cache: BaseCache | null }
  | { type: "BASE_READY"; pr: ResolvedPr; cache: BaseCache }
  | { type: "GITHUB_STATE_MERGED"; snapshot: MergeGateSnapshot }
  | { type: "BASE_SELECTED"; base: string }
  | { type: "CHECKOUT_OK"; headOid: string; branch: string }
  | { type: "CONFLICTS_FOUND"; paths: string[] }
  | { type: "CONFLICT_STEP_DONE"; result: ConflictRoleResult; headOid: string }
  | { type: "REBASE_OK"; headOid: string; rewrittenPublished: boolean }
  | { type: "FEEDBACK_DELTA"; versions: FeedbackVersion[] }
  | { type: "NO_ACTIONABLE_DELTA" }
  | { type: "ACTIONABLE"; result: ValidatorRoleResult }
  | { type: "NOTHING_ACTIONABLE"; result: ValidatorRoleResult }
  | { type: "UNSURE_OR_SCOPE_DECISION"; result: ValidatorRoleResult }
  | { type: "PLAN_READY"; result: PlannerRoleResult }
  | { type: "BUILD_DONE"; result: BuilderRoleResult }
  | { type: "REVIEW_ITERATE"; result: ReviewerRoleResult }
  | { type: "REVIEW_BLOCK"; result: ReviewerRoleResult }
  | { type: "REVIEW_PASS"; result: ReviewerRoleResult }
  | { type: "HEAD_OR_DIFF_DRIFTED"; headOid: string; diffDigest: string }
  | { type: "LOCAL_GATE_FAIL"; verification: VerificationAttestation }
  | { type: "DIRTY_VERIFIED"; verification: VerificationAttestation }
  | { type: "REWRITTEN_OR_AHEAD"; verification: VerificationAttestation }
  | { type: "CLEAN_AND_SYNCED"; verification: VerificationAttestation }
  | { type: "COMMIT_OK"; sha: string }
  | { type: "REMOTE_HEAD_CONFIRMED"; remoteHeadOid: string }
  | { type: "NEW_FEEDBACK"; versions: FeedbackVersion[] }
  | { type: "NO_NEW_FEEDBACK" }
  | { type: "BASE_ADVANCED_OR_CONFLICT"; snapshot: MergeGateSnapshot }
  | { type: "REMOTE_GATE_PENDING"; snapshot: MergeGateSnapshot }
  | { type: "ALL_GATES_PASS"; snapshot: MergeGateSnapshot }
  | { type: "HARD_GATE_FAIL"; snapshot: MergeGateSnapshot; reason: BlockReason }
  | { type: "AUTO_MERGE_ACCEPTED"; snapshot: MergeGateSnapshot }
  | { type: "POLL_DUE" }
  | { type: "POLL_LIMIT" }
  | { type: "RESUME_AND_RECONCILE" }
  | { type: "CANCEL" }
  | { type: "BLOCK"; reason: BlockReason };

export const EVENT_OWNERSHIP: Record<PrManagerEvent["type"], OwnershipMarker> = {
  START: "D",
  CACHE_MISSING_OR_MISMATCH: "D",
  BASE_READY: "D",
  GITHUB_STATE_MERGED: "D",
  BASE_SELECTED: "D",
  CHECKOUT_OK: "D",
  CONFLICTS_FOUND: "D",
  CONFLICT_STEP_DONE: "H",
  REBASE_OK: "D",
  FEEDBACK_DELTA: "D",
  NO_ACTIONABLE_DELTA: "D",
  ACTIONABLE: "L",
  NOTHING_ACTIONABLE: "L",
  UNSURE_OR_SCOPE_DECISION: "L",
  PLAN_READY: "L",
  BUILD_DONE: "H",
  REVIEW_ITERATE: "L",
  REVIEW_BLOCK: "L",
  REVIEW_PASS: "L",
  HEAD_OR_DIFF_DRIFTED: "D",
  LOCAL_GATE_FAIL: "D",
  DIRTY_VERIFIED: "D",
  REWRITTEN_OR_AHEAD: "D",
  CLEAN_AND_SYNCED: "D",
  COMMIT_OK: "H",
  REMOTE_HEAD_CONFIRMED: "D",
  NEW_FEEDBACK: "D",
  NO_NEW_FEEDBACK: "D",
  BASE_ADVANCED_OR_CONFLICT: "D",
  REMOTE_GATE_PENDING: "D",
  ALL_GATES_PASS: "D",
  HARD_GATE_FAIL: "D",
  AUTO_MERGE_ACCEPTED: "D",
  POLL_DUE: "D",
  POLL_LIMIT: "D",
  RESUME_AND_RECONCILE: "D",
  CANCEL: "D",
  BLOCK: "D",
};

export type PrManagerActorId =
  | "githubInventory"
  | "gitOps"
  | "modelValidator"
  | "modelPlanner"
  | "modelBuilder"
  | "modelReviewer"
  | "modelConflict"
  | "pollTimer";

export function isTerminalState(state: MachineState): boolean {
  return (
    state === "merged" || state === "paused" || state === "blocked" || state === "exhausted"
  );
}

export function isActiveState(state: MachineState): boolean {
  return !isTerminalState(state);
}

export function defaultRunState(): RunState {
  return {
    schemaVersion: SCHEMA_VERSION,
    owner: "",
    repo: "",
    prNumber: 0,
    prUrl: "",
    headRef: "",
    baseRef: "",
    worktreeId: "",
    currentState: "idle",
    lastEvent: null,
    cachedBase: null,
    cacheProvenance: null,
    localHeadOid: null,
    remoteHeadOid: null,
    baseHeadOid: null,
    mergeCommitOid: null,
    rewrittenPublished: false,
    poll: defaultPollState(),
    feedback: [],
    verdicts: {},
    iterationArtifactPath: null,
    reviewArtifactPath: null,
    ownedDirtyPaths: [],
    diffDigest: null,
    buildAttestation: null,
    reviewAttestation: null,
    verificationAttestation: null,
    createdCommitShas: [],
    verifiedPushOid: null,
    mergeGate: null,
    autoMergeRequested: false,
    mergeMethod: null,
    blockReason: null,
    pauseReason: null,
    exhaustReason: null,
    conflictSteps: 0,
    unresolvedConflictPaths: [],
    history: [],
    updatedAt: new Date(0).toISOString(),
  };
}

export function defaultContext(overrides: Partial<PrManagerContext> = {}): PrManagerContext {
  return {
    ...defaultRunState(),
    options: defaultCliOptions(),
    pr: null,
    cache: null,
    ...overrides,
  };
}

export function resumeCommand(prNumber: number): string {
  return `/b-pr-manager ${prNumber} --resume`;
}
