import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import { completeSimple } from "@mariozechner/pi-ai";
import { Container, type SelectItem, SelectList, Text } from "@mariozechner/pi-tui";
import { join } from "node:path";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { wire as wireTmuxStatus } from "./tmux-window-status.js";
import { wire as wireGrillAuto } from "./b-grill-auto/index.js";
import { wire as wireGrillDialog } from "./grill-me-dialog.js";
import { wire as wireBFlow } from "./b-flow/index.js";
import { wire as wireTpsTracker } from "./tps-tracker.js";

// --- Types ---

type BuckWorkflowModeSource = "manual" | "auto" | "command" | null;

interface SessionState {
  started_at: string;
  mode: "freeform" | "guided";
  commands_run: Array<{ command: string; at: string }>;
  implementation_happened: boolean;
  save_completed: boolean;
  memory_file: string | null;
  files_modified: string[];
  guided_workflow: string | null;
  guided_stage: string | null;
  /** Write-guard sub-mode: restricts writes to .context/ and docs/. */
  plan_mode_active: boolean;
  /** Broader Buck workflow envelope: session-latched until manually disabled. */
  buck_workflow_mode_active: boolean;
  buck_workflow_mode_source: BuckWorkflowModeSource;
  buck_workflow_mode_reason: string | null;
  buck_workflow_mode_enabled_at: string | null;
  /** Manual off switch: suppresses narrow auto-enable until explicit /b-mode on or /b-* command. */
  buck_workflow_mode_auto_disabled: boolean;
  workflow_intent_count: number;
  last_workflow_intent_at: string | null;
  /** CWD restriction: blocks write/edit tools for paths outside project directory. */
  restrict_cwd_active: boolean;
}

// --- Plan Mode Configuration ---

const PLAN_MODE_ALLOWED_PATHS = [".context/", "docs/"];

const SAFE_BASH_PATTERNS: RegExp[] = [
  /^\s*cat\b/, /^\s*ls\b/, /^\s*grep\b/, /^\s*find\b/,
  /^\s*head\b/, /^\s*tail\b/, /^\s*wc\b/, /^\s*pwd\b/,
  /^\s*echo\b/, /^\s*printf\b/, /^\s*git\s+(status|log|diff|show|branch)\b/,
  /^\s*file\b/, /^\s*stat\b/, /^\s*du\b/, /^\s*df\b/,
  /^\s*which\b/, /^\s*type\b/, /^\s*env\b/, /^\s*printenv\b/,
  /^\s*uname\b/, /^\s*whoami\b/, /^\s*date\b/,
];

const MUTATING_GIT_PATTERNS: RegExp[] = [
  /^\s*git\s+commit/, /^\s*git\s+push/, /^\s*git\s+pull/,
  /^\s*git\s+merge/, /^\s*git\s+rebase/, /^\s*git\s+reset/,
  /^\s*git\s+cherry-pick/, /^\s*git\s+branch\s+-D/, /^\s*git\s+branch\s+-d/,
  /^\s*git\s+tag\s+-d/,
];

const UNSAFE_SHELL_CHARS = /[;&`\n]/;
const REDIRECT_PATTERN = />{1,2}/;

/** Path-like token: starts with /, ./, or contains .context/ or docs/ */
const PATH_LIKE = /(?:^|\s)(\/?[\w.-]+(?:\/[\w.-]+)+|\.context\/?|docs\/?)\b/g;

function commandTargetsAllowedPath(command: string, projectDir: string): boolean {
  // Strip flags, extract candidate path tokens
  const cleaned = command.replace(/\s-\S+/g, "");
  const matches = cleaned.matchAll(PATH_LIKE);
  for (const match of matches) {
    const candidate = match[1];
    if (isAllowedPlanWritePath(candidate, projectDir)) return true;
  }
  return false;
}

function isWhitelistedBash(command: string): boolean {
  const trimmed = command.trim().replace(/\\\n\s*/g, "").replace(/\n\s*/g, " ");
  if (UNSAFE_SHELL_CHARS.test(trimmed)) return false;
  if (REDIRECT_PATTERN.test(trimmed)) return false;
  return SAFE_BASH_PATTERNS.some((p) => p.test(trimmed));
}

function isAllowedPlanWritePath(path: string, projectDir?: string): boolean {
  // Normalize to relative path
  let normalizedPath = path.replace(/^\.\//, "").replace(/\/$/, "");

  // If absolute path, strip the project directory prefix to get a relative path
  if (path.startsWith("/") && projectDir) {
    const prefix = projectDir + "/";
    if (normalizedPath.startsWith(prefix)) {
      normalizedPath = normalizedPath.slice(prefix.length);
    } else {
      // Absolute path outside project — not allowed
      return false;
    }
  }

  for (const allowedPath of PLAN_MODE_ALLOWED_PATHS) {
    const normalizedAllowed = allowedPath.replace(/\/$/, "");
    if (normalizedPath.startsWith(normalizedAllowed) || normalizedPath === normalizedAllowed) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a path is within the current working directory (project root).
 * Relative paths are always considered within CWD.
 */
function isWithinCwd(path: string, cwd: string): boolean {
  const normalizedPath = path.replace(/^\.\//, "").replace(/\/$/, "");
  if (!normalizedPath.startsWith("/")) {
    // Relative path — always allowed
    return true;
  }
  // Absolute path — check if it's under cwd
  const normalizedCwd = cwd.replace(/\/$/, "");
  return normalizedPath.startsWith(normalizedCwd + "/") || normalizedPath === normalizedCwd;
}

function getBashOverride(entries: any[], command: string): boolean {
  for (const entry of entries) {
    if (entry.type === "custom" && entry.customType === "plan-mode-bash-override") {
      if (entry.data?.command === command) return true;
    }
  }
  return false;
}

function classifyWorkflowIntent(text: string, priorIntentCount: number): WorkflowIntent {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized || normalized.startsWith("/")) {
    return { kind: "none", reason: null, shouldActivate: false, activatePlanMode: false };
  }

  const hasImplementationVerb = /\b(implement|build|fix|refactor|modify|wire|code)\b/.test(normalized);
  const hasImplementationWorkflowLanguage = /\b(plan|handoff|document|documentation|write-?up|notes?|checkpoint|context|durable|save)\b/.test(normalized);

  if (hasImplementationVerb && hasImplementationWorkflowLanguage) {
    return {
      kind: "workflow-implementation",
      reason: "implementation request with planning/handoff/documentation language",
      shouldActivate: true,
      activatePlanMode: false,
    };
  }

  const planningPatterns: Array<[RegExp, string]> = [
    [/\b(plan this|make a plan|create a plan|draft a plan|implementation plan|planning pass)\b/, "explicit planning request"],
    [/\b(how should (i|we) approach|scope this|break (this|it) down|phase this|roadmap)\b/, "scoping or roadmap request"],
    [/\b(prd|spec|design doc|architecture plan|proposal)\b/, "spec/design request"],
    [/\b(research|explore|investigate|trace|orient|understand this codebase|map out)\b/, "research/exploration request"],
    [/\b(write up|write-up|document this|documentation pass|capture findings)\b/, "documentation/write-up request"],
    [/\b(backlog|issue breakdown|break (this|it) into issues|tickets)\b/, "backlog/issue breakdown request"],
    [/\b(review changes|review this|handoff|checkpoint)\b/, "review/handoff/checkpoint request"],
  ];

  for (const [pattern, reason] of planningPatterns) {
    if (pattern.test(normalized)) {
      return { kind: "planning", reason, shouldActivate: true, activatePlanMode: true };
    }
  }

  const softWorkflowHint = /\b(plan|research|review|handoff|checkpoint|context|remaining work|next step|follow up)\b/.test(normalized);
  if (softWorkflowHint && priorIntentCount >= 1) {
    return {
      kind: "soft",
      reason: "accumulated workflow-shaped session context",
      shouldActivate: true,
      activatePlanMode: true,
    };
  }

  return {
    kind: softWorkflowHint ? "soft" : "none",
    reason: softWorkflowHint ? "soft workflow hint" : null,
    shouldActivate: false,
    activatePlanMode: false,
  };
}

const STATE_DIR = ".context/workflow";
const STATE_FILE = "current-session.json";
const MEMORY_DIR = ".context/memory";

const PLAN_MODE_COMMANDS = ["b-plan", "b-brainstorm", "b-explore", "b-research", "b-grill-me", "b-grill-with-docs"];
const IMPLEMENTATION_COMMANDS = ["b-build", "b-build-hard", "b-iterate"];
const MODEL_SWITCH_COMMANDS = ["b-build", "b-build-hard", "b-iterate", "b-review"];
const BUCK_PREFIX = "b-";

type WorkflowIntentKind = "planning" | "workflow-implementation" | "soft" | "none";

interface WorkflowIntent {
  kind: WorkflowIntentKind;
  reason: string | null;
  shouldActivate: boolean;
  activatePlanMode: boolean;
}

function defaultState(): SessionState {
  return {
    started_at: new Date().toISOString(),
    mode: "freeform",
    commands_run: [],
    implementation_happened: false,
    save_completed: false,
    memory_file: null,
    files_modified: [],
    guided_workflow: null,
    guided_stage: null,
    plan_mode_active: false,
    buck_workflow_mode_active: false,
    buck_workflow_mode_source: null,
    buck_workflow_mode_reason: null,
    buck_workflow_mode_enabled_at: null,
    buck_workflow_mode_auto_disabled: false,
    workflow_intent_count: 0,
    last_workflow_intent_at: null,
    restrict_cwd_active: true,
  };
}

// --- Model Auto-Switch Types ---

interface ModelMapping {
  easy: string;   // e.g. "zai-glm/glm-4.7-flash"
  medium: string; // e.g. "anthropic/claude-sonnet-4-6"
  hard: string;   // e.g. "anthropic/claude-opus-4-7"
}

interface ModelSwitchState {
  originalModel: { provider: string; id: string } | null;
  switchedForPhase: boolean;
  userOverrode: boolean;
  phaseDifficulty: "easy" | "medium" | "hard" | null;
}

// --- Model Auto-Switch Helpers ---

function readModelMapping(projectDir: string): ModelMapping | null {
  // Read from project .pi/settings.json first, then global ~/.pi/agent/settings.json
  const paths = [
    join(projectDir, ".pi", "settings.json"),
    join(homedir(), ".pi", "agent", "settings.json"),
  ];

  for (const p of paths) {
    try {
      if (!existsSync(p)) continue;
      const raw = JSON.parse(readFileSync(p, "utf-8"));
      const mapping = raw?.buckModelMapping;
      if (mapping && mapping.easy && mapping.medium && mapping.hard) {
        return mapping as ModelMapping;
      }
    } catch {
      // ignore parse errors
    }
  }
  return null;
}

function parseModelId(modelId: string): { provider: string; id: string } | null {
  const slashIdx = modelId.indexOf("/");
  if (slashIdx < 1) return null;
  return {
    provider: modelId.slice(0, slashIdx),
    id: modelId.slice(slashIdx + 1),
  };
}

function getCurrentModelTier(
  currentModel: { provider: string; id: string },
  mapping: ModelMapping,
): "easy" | "medium" | "hard" | "unknown" {
  const currentId = `${currentModel.provider}/${currentModel.id}`;
  if (currentId === mapping.easy) return "easy";
  if (currentId === mapping.medium) return "medium";
  if (currentId === mapping.hard) return "hard";
  return "unknown";
}

/**
 * Find the difficulty of the active phase in a phased plan.
 *
 * Supports two formats:
 * 1. **Discrete phase files** (new): overview `plan-*-phases.md` links to `phase-N-<slug>.md` files.
 *    Scans discrete phase files for the first non-completed one.
 * 2. **Single-file legacy**: all phases embedded in `plan-*-phases.md` with `## Phase N` headers.
 *    Checks inline acceptance criteria.
 *
 * Detects format via `format: discrete` frontmatter in the overview file.
 * Falls back to legacy behavior when no discrete format marker is found.
 */
function findActivePhaseDifficulty(contextDir: string): "easy" | "medium" | "hard" | null {
  try {
    if (!existsSync(contextDir)) return null;

    // Find phased plan overview files
    const candidates: string[] = [];
    const entries = readdirSync(contextDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.match(/^\d{4}-\d{2}-\d{2}\./)) {
        const subDir = join(contextDir, entry.name);
        try {
          const files = readdirSync(subDir);
          for (const f of files) {
            if (f.startsWith("plan-") && f.includes("-phases")) {
              candidates.push(join(subDir, f));
            }
          }
        } catch { /* ignore */ }
      }
    }

    // Legacy: .context/plans/
    const legacyDir = join(contextDir, "plans");
    if (existsSync(legacyDir)) {
      try {
        const files = readdirSync(legacyDir);
        for (const f of files) {
          if (f.startsWith("plan-") && f.includes("-phases")) {
            candidates.push(join(legacyDir, f));
          }
        }
      } catch { /* ignore */ }
    }

    if (candidates.length === 0) return null;

    // Use most recent by filename (date-prefixed)
    candidates.sort().reverse();
    const phasesFile = candidates[0];
    const content = readFileSync(phasesFile, "utf-8");

    // Detect format: discrete phase files vs legacy single-file
    const isDiscrete = content.includes("format: discrete");

    if (isDiscrete) {
      return findActivePhaseDiscrete(phasesFile, content);
    } else {
      return findActivePhaseLegacy(content);
    }
  } catch {
    return null;
  }
}

/**
 * Find active phase difficulty using discrete phase files.
 * Reads the overview, extracts linked phase file paths, scans for first non-completed.
 */
function findActivePhaseDiscrete(
  overviewPath: string,
  overviewContent: string,
): "easy" | "medium" | "hard" | null {
  const overviewDir = overviewPath.substring(0, overviewPath.lastIndexOf("/"));

  // Extract phase file links from the summary table
  // Format: [phase-N-slug.md](phase-N-slug.md)
  const phaseFileMatches = overviewContent.matchAll(
    /\[(phase-\d+-[^\]]+\.md)\]\(\1\)/g,
  );

  const phaseFiles: string[] = [];
  for (const match of phaseFileMatches) {
    phaseFiles.push(join(overviewDir, match[1]));
  }

  // If no linked files found in table, try scanning directory for phase-N-*.md files
  if (phaseFiles.length === 0) {
    try {
      const files = readdirSync(overviewDir);
      const phaseFilesInDir = files
        .filter((f) => f.match(/^phase-\d+-.*\.md$/))
        .sort()
        .map((f) => join(overviewDir, f));
      phaseFiles.push(...phaseFilesInDir);
    } catch { /* ignore */ }
  }

  if (phaseFiles.length === 0) {
    // No discrete files found — fall back to legacy parsing of overview content
    return findActivePhaseLegacy(overviewContent);
  }

  // Scan phase files in order for first non-completed
  for (const phaseFilePath of phaseFiles) {
    try {
      const phaseContent = readFileSync(phaseFilePath, "utf-8");

      // Extract status from frontmatter
      const statusMatch = phaseContent.match(/^status:\s*(\S+)/m);
      if (statusMatch && statusMatch[1] === "completed") continue;

      // Extract difficulty from frontmatter
      const diffMatch = phaseContent.match(/^difficulty:\s*(easy|medium|hard)/m);
      if (diffMatch) {
        return diffMatch[1] as "easy" | "medium" | "hard";
      }

      // Phase found but no difficulty — return null
      return null;
    } catch {
      // Can't read phase file — skip it
      continue;
    }
  }

  return null; // all phases complete
}

/**
 * Find active phase difficulty using legacy single-file format.
 * Scans `## Phase N` sections and checks inline acceptance criteria.
 */
function findActivePhaseLegacy(content: string): "easy" | "medium" | "hard" | null {
  // Split into phase sections by ## Phase N: headers
  const phaseSections = content.split(/^## Phase \d+/m).slice(1);

  for (const section of phaseSections) {
    // Check if all acceptance criteria are completed
    const criteriaLines = section.match(/^- \[[ x]\] /gm) || [];
    if (criteriaLines.length === 0) continue; // no criteria = take this phase

    const allChecked = criteriaLines.every((l) => l.startsWith("- [x]"));
    if (!allChecked) {
      // This is the active phase — extract difficulty
      const diffMatch = section.match(/\*\*Difficulty\*\*:\s*(easy|medium|hard)/i);
      if (diffMatch) {
        return diffMatch[1].toLowerCase() as "easy" | "medium" | "hard";
      }
      return null;
    }
  }

  return null; // all phases complete or no phases found
}

/**
 * Find the most recent non-phased plan file for complexity suggestion.
 */
function findMostRecentPlan(contextDir: string): string | null {
  try {
    if (!existsSync(contextDir)) return null;

    const candidates: string[] = [];
    const entries = readdirSync(contextDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.match(/^\d{4}-\d{2}-\d{2}\./)) {
        const subDir = join(contextDir, entry.name);
        try {
          const files = readdirSync(subDir);
          for (const f of files) {
            if (f.startsWith("plan-") && !f.includes("-phases")) {
              candidates.push(join(subDir, f));
            }
          }
        } catch { /* ignore */ }
      }
    }

    // Legacy
    const legacyDir = join(contextDir, "plans");
    if (existsSync(legacyDir)) {
      try {
        const files = readdirSync(legacyDir);
        for (const f of files) {
          if (f.startsWith("plan-") && !f.includes("-phases")) {
            candidates.push(join(legacyDir, f));
          }
        }
      } catch { /* ignore */ }
    }

    if (candidates.length === 0) return null;
    candidates.sort().reverse();
    return candidates[0];
  } catch {
    return null;
  }
}

export default function (pi: ExtensionAPI) {
  let cwd = "";
  let qmdReindexTimer: ReturnType<typeof setTimeout> | null = null;
  let qmdReindexRunning = false;
  let qmdReindexPending = false;

  // Model switch state — session-scoped in-memory
  let modelSwitchState: ModelSwitchState = {
    originalModel: null,
    switchedForPhase: false,
    userOverrode: false,
    phaseDifficulty: null,
  };
  // Flag to distinguish our auto-switch from user-initiated switches
  let autoSwitchingModel = false;
  // Timestamp guard: prevents model_select from auto-initiated setModel calls
  // that arrive after autoSwitchingModel has been cleared (async emit race).
  let lastAutoSwitchTimestamp = 0;
  const AUTO_SWITCH_GRACE_MS = 100; // accept model_select events within 100ms
  // Defer model-switch UI until before_agent_start so it doesn't fight the editor/slash-command UI.
  let pendingModelSwitchCommand: string | null = null;

  // --- tmux window status ---
  wireTmuxStatus(pi);

  // --- b-grill-auto ---
  wireGrillAuto(pi);

  // --- grill-me dialog ---
  wireGrillDialog(pi);

  // --- b-flow orchestration ---
  wireBFlow(pi);

  // --- TPS tracker ---
  wireTpsTracker(pi);

  // --- Buck Workflow Mode / Plan Mode ---

  function updateBuckWorkflowModeStatus(ctx: any, active: boolean): void {
    if (active) {
      ctx.ui.setStatus("buck", ctx.ui.theme.fg("accent", "🦌 buck"));
    } else {
      ctx.ui.setStatus("buck", undefined);
    }
  }

  function updatePlanModeStatus(ctx: any, active: boolean): void {
    if (active) {
      ctx.ui.setStatus("plan", ctx.ui.theme.fg("warning", "📝 planning"));
    } else {
      ctx.ui.setStatus("plan", undefined);
    }
  }

  function updateCwdRestrictStatus(ctx: any, active: boolean): void {
    if (active) {
      ctx.ui.setStatus("cwd-restrict", ctx.ui.theme.fg("accent", "🔒 cwd"));
    } else {
      ctx.ui.setStatus("cwd-restrict", undefined);
    }
  }

  function updateWorkflowStatuses(ctx: any, state: SessionState): void {
    updateBuckWorkflowModeStatus(ctx, state.buck_workflow_mode_active);
    updatePlanModeStatus(ctx, state.plan_mode_active);
    updateCwdRestrictStatus(ctx, state.restrict_cwd_active);
  }

  function activateBuckWorkflowMode(
    state: SessionState,
    source: Exclude<BuckWorkflowModeSource, null>,
    reason: string,
  ): boolean {
    const wasActive = state.buck_workflow_mode_active;
    state.buck_workflow_mode_active = true;
    state.buck_workflow_mode_source = source;
    state.buck_workflow_mode_reason = reason;
    state.buck_workflow_mode_enabled_at ??= new Date().toISOString();
    state.buck_workflow_mode_auto_disabled = false;
    return !wasActive;
  }

  function deactivateBuckWorkflowMode(
    state: SessionState,
    manual: boolean,
    reason: string,
  ): boolean {
    const wasActive = state.buck_workflow_mode_active || state.plan_mode_active;
    state.buck_workflow_mode_active = false;
    state.buck_workflow_mode_source = null;
    state.buck_workflow_mode_reason = reason;
    state.buck_workflow_mode_enabled_at = null;
    state.plan_mode_active = false;
    if (manual) state.buck_workflow_mode_auto_disabled = true;
    return wasActive;
  }

  function enablePlanMode(ctx: any, source: Exclude<BuckWorkflowModeSource, null>, reason: string): void {
    const state = ensureState();
    const buckChanged = activateBuckWorkflowMode(state, source, reason);
    const planChanged = !state.plan_mode_active;
    state.plan_mode_active = true;
    writeState(state);
    updateWorkflowStatuses(ctx, state);
    if (planChanged) {
      ctx.ui.notify(
        "✅ Buck workflow planning mode enabled - writes allowed to .context/, docs/ only",
        "info",
      );
    } else if (buckChanged) {
      ctx.ui.notify("✅ Buck workflow mode enabled", "info");
    }
  }

  function toggleBuckWorkflowMode(ctx: any): void {
    const state = ensureState();
    if (state.buck_workflow_mode_active || state.plan_mode_active) {
      deactivateBuckWorkflowMode(state, true, "manual /b-mode off or alt+p toggle");
      writeState(state);
      updateWorkflowStatuses(ctx, state);
      ctx.ui.notify("🦌 Buck workflow mode disabled", "info");
      return;
    }

    activateBuckWorkflowMode(state, "manual", "manual /b-mode on or alt+p toggle");
    state.plan_mode_active = true;
    writeState(state);
    updateWorkflowStatuses(ctx, state);
    ctx.ui.notify(
      "✅ Buck workflow mode enabled - planning guard active (.context/, docs/ only)",
      "info",
    );
  }

  function maybeAutoEnableBuckWorkflowMode(ctx: any, text: string, state: SessionState): void {
    const intent = classifyWorkflowIntent(text, state.workflow_intent_count);
    if (intent.kind !== "none") {
      state.workflow_intent_count += 1;
      state.last_workflow_intent_at = new Date().toISOString();
    }

    if (!intent.shouldActivate || state.buck_workflow_mode_active || state.buck_workflow_mode_auto_disabled) {
      return;
    }

    activateBuckWorkflowMode(state, "auto", intent.reason ?? "workflow intent detected");
    if (intent.activatePlanMode) state.plan_mode_active = true;
    updateWorkflowStatuses(ctx, state);
    ctx.ui.notify(
      intent.activatePlanMode
        ? `🦌 Buck workflow mode auto-enabled (${intent.reason}); planning guard active`
        : `🦌 Buck workflow mode auto-enabled (${intent.reason})`,
      "info",
    );
  }

  // --- Buck mode keybind (alt+p, configurable via keybindings.json) ---

  pi.registerShortcut("alt+p", {
    description: "Toggle Buck workflow mode",
    handler: async (ctx) => {
      toggleBuckWorkflowMode(ctx);
    },
  });

  pi.registerCommand("b-mode", {
    description: "Control Buck workflow mode: /b-mode on|off|status",
    getArgumentCompletions: (prefix) => {
      const values = ["on", "off", "status"];
      return values
        .filter((value) => value.startsWith(prefix.trim()))
        .map((value) => ({ value, label: value }));
    },
    handler: async (args, ctx) => {
      const action = args.trim().toLowerCase() || "status";
      const state = ensureState();

      if (action === "on") {
        activateBuckWorkflowMode(state, "manual", "manual /b-mode on");
        state.plan_mode_active = true;
        writeState(state);
        updateWorkflowStatuses(ctx, state);
        ctx.ui.notify(
          "✅ Buck workflow mode enabled - planning guard active (.context/, docs/ only)",
          "info",
        );
        return;
      }

      if (action === "off") {
        deactivateBuckWorkflowMode(state, true, "manual /b-mode off");
        writeState(state);
        updateWorkflowStatuses(ctx, state);
        ctx.ui.notify("🦌 Buck workflow mode disabled; auto-enable suppressed for this session", "info");
        return;
      }

      if (action !== "status") {
        ctx.ui.notify("Usage: /b-mode on|off|status", "warning");
        return;
      }

      ctx.ui.notify(
        [
          `Buck workflow mode: ${state.buck_workflow_mode_active ? "active" : "inactive"}`,
          `Plan write guard: ${state.plan_mode_active ? "active" : "inactive"}`,
          `Auto-enable: ${state.buck_workflow_mode_auto_disabled ? "suppressed" : "enabled"}`,
          `Source: ${state.buck_workflow_mode_source ?? "none"}`,
          `Reason: ${state.buck_workflow_mode_reason ?? "none"}`,
          `Workflow intent count: ${state.workflow_intent_count}`,
        ].join("\n"),
        "info",
      );
    },
  });

  // --- CWD Restriction Command ---

  pi.registerCommand("b-restrict", {
    description: "Control CWD restriction mode: /b-restrict on|off|status",
    getArgumentCompletions: (prefix) => {
      const values = ["on", "off", "status"];
      return values
        .filter((value) => value.startsWith(prefix.trim()))
        .map((value) => ({ value, label: value }));
    },
    handler: async (args, ctx) => {
      const action = args.trim().toLowerCase() || "status";
      const state = ensureState();

      if (action === "on") {
        state.restrict_cwd_active = true;
        writeState(state);
        updateCwdRestrictStatus(ctx, true);
        ctx.ui.notify("🔒 CWD restriction enabled — writes outside project directory are blocked", "info");
        return;
      }

      if (action === "off") {
        state.restrict_cwd_active = false;
        writeState(state);
        updateCwdRestrictStatus(ctx, false);
        ctx.ui.notify("🔓 CWD restriction disabled — all write paths allowed", "info");
        return;
      }

      if (action !== "status") {
        ctx.ui.notify("Usage: /b-restrict on|off|status", "warning");
        return;
      }

      ctx.ui.notify(
        `CWD restriction: ${state.restrict_cwd_active ? "active 🔒" : "inactive 🔓"} (blocks writes outside ${cwd})`,
        "info",
      );
    },
  });

  pi.on("before_agent_start", async (event, ctx) => {
    if (pendingModelSwitchCommand && MODEL_SWITCH_COMMANDS.includes(pendingModelSwitchCommand)) {
      pendingModelSwitchCommand = null;
      await handleModelSwitch(pi, ctx);
    }

    const state = readState();
    const instructions: string[] = [];

    if (state?.buck_workflow_mode_active) {
      instructions.push(`[BUCK WORKFLOW MODE ACTIVE]

Use Buck workflow conventions for meaningful work:
- Prefer durable .context/ artifacts for plans, research, handoff notes, and useful session state.
- Do not create files immediately just because mode is active; wait for explicit user intent or a clear workflow threshold.
- When relevant, check .context/workflow/current-session.json, .context/memory/, .context/backlog/, and subject folders before acting.
- Suggest explicit Buck entrypoints when helpful: /b-explore, /b-research, /b-plan, /b-build, /b-build-hard, /b-review, /b-save.
- Buck mode is broad workflow scaffolding; plan mode below is the write-guard sub-mode when active.`);
    }

    if (state?.plan_mode_active) {
      instructions.push(`[PLAN MODE ACTIVE]

You are in plan mode. This is a PLANNING PHASE only.

Allowed writes:
- .context/ directory (Buck workflow: plans, specs, research, memory)
- docs/ directory (documentation)

Blocked:
- Source code files (.ts, .js, .py, etc.)
- Config files (.json, .yaml, .toml, etc.)
- .md or .txt files outside .context/ and docs/
- All other non-documentation files

Available tools:
- read: Read files to understand the codebase
- write/edit: Write to allowed paths only (.context/, docs/)
- bash: Run commands for exploration (safe commands allowed, others reviewed)

Help the user plan what needs to be done:
- Explore the codebase
- Discuss the approach  
- Create/update plans in .context/
- Update documentation in docs/
- When ready, run /b-build or /b-build-hard to exit plan mode`);
    }

    if (state?.restrict_cwd_active && !state?.plan_mode_active) {
      instructions.push(`[CWD RESTRICTION ACTIVE]

Write and edit operations are restricted to paths within the project directory.
Use \/b-restrict off to disable this restriction.`);
    }

    if (instructions.length === 0) return;

    return {
      systemPrompt: event.systemPrompt + "\n\n" + instructions.join("\n\n"),
    };
  });

  // --- State helpers ---

  function stateDir(): string {
    return join(cwd, STATE_DIR);
  }
  function statePath(): string {
    return join(stateDir(), STATE_FILE);
  }
  function memoryDir(): string {
    return join(cwd, MEMORY_DIR);
  }

  function readState(): SessionState | null {
    try {
      const p = statePath();
      if (!existsSync(p)) return null;
      const raw = readFileSync(p, "utf-8");
      const parsed = JSON.parse(raw) as Partial<SessionState>;
      return { ...defaultState(), ...parsed };
    } catch {
      return null;
    }
  }

  function writeState(state: SessionState): void {
    try {
      const dir = stateDir();
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(statePath(), JSON.stringify(state, null, 2) + "\n", "utf-8");
    } catch (e) {
      console.error("[buck-workflow] Failed to write session state:", e);
    }
  }

  function ensureState(): SessionState {
    let state = readState();
    if (!state) {
      state = defaultState();
      writeState(state);
    }
    return state;
  }

  function toRelativePath(absPath: string): string {
    const prefix = cwd + "/";
    return absPath.startsWith(prefix) ? absPath.slice(prefix.length) : absPath;
  }

  function trackFile(state: SessionState, filePath: string): void {
    const rel = toRelativePath(filePath);
    if (rel && !state.files_modified.includes(rel)) {
      state.files_modified.push(rel);
    }
  }

  function isMemoryFile(filePath: string): boolean {
    const rel = toRelativePath(filePath);
    return rel === ".context/memory/index.md" || rel.startsWith(".context/memory/");
  }

  // --- QMD reindex ---

  // Note: qmd update (re-index all collections) is not used here because it crashes on
  // an unrelated vault collection. The fix-qmd-index-crash backlog item tracks that issue.
  // qmd collection add creates or updates the buck-workflow-memory collection and indexes
  // its files, which is sufficient for making new memory entries searchable.
  function runQmdReindex(): void {
    if (qmdReindexRunning) {
      qmdReindexPending = true;
      return;
    }
    if (!existsSync(memoryDir())) return;

    qmdReindexRunning = true;
    const child = spawn(
      "sh",
      [
        "-lc",
        "command -v qmd >/dev/null 2>&1 && qmd collection add .context/memory --name buck-workflow-memory --mask '*.md' >/dev/null 2>&1 || true",
      ],
      { cwd, stdio: "ignore" },
    );

    child.on("error", () => {
      qmdReindexRunning = false;
    });
    child.on("close", () => {
      qmdReindexRunning = false;
      if (qmdReindexPending) {
        qmdReindexPending = false;
        scheduleQmdReindex(250);
      }
    });
  }

  function scheduleQmdReindex(delayMs = 1500): void {
    if (qmdReindexTimer) clearTimeout(qmdReindexTimer);
    qmdReindexTimer = setTimeout(() => {
      qmdReindexTimer = null;
      runQmdReindex();
    }, delayMs);
  }

  // --- Session lifecycle ---

  pi.on("session_start", async (_event, ctx) => {
    cwd = ctx.cwd;
    const contextDir = join(cwd, ".context");
    if (!existsSync(contextDir)) return;
    // Bootstrap state if missing
    if (!existsSync(statePath())) {
      writeState(defaultState());
    }

    // Restore Buck workflow / plan mode state from session
    const state = readState();
    if (state?.buck_workflow_mode_active || state?.plan_mode_active) {
      updateWorkflowStatuses(ctx, state);
      ctx.ui.notify(
        state.plan_mode_active ? "ℹ️ Buck workflow planning mode restored" : "ℹ️ Buck workflow mode restored",
        "info",
      );
    }
  });

  // --- Track b-* prompt template usage ---

  pi.on("input", async (event, ctx) => {
    const text = event.text?.trim() ?? "";
    const contextDir = join(cwd, ".context");
    if (!existsSync(contextDir)) return { action: "continue" as const };

    const state = ensureState();

    // Match /b-* prompt template invocations and extension commands.
    const match = text.match(/^\/(b-\w[\w-]*)(\s|$)/);
    if (match) {
      const command = match[1];
      if (!command.startsWith(BUCK_PREFIX)) return { action: "continue" as const };

      // /b-mode is handled by the registered command; avoid racing its state writes.
      if (command === "b-mode") return { action: "continue" as const };

      state.commands_run.push({ command, at: new Date().toISOString() });

      if (PLAN_MODE_COMMANDS.includes(command)) {
        activateBuckWorkflowMode(state, "command", `/${command} command`);
        state.plan_mode_active = true;
      }

      if (IMPLEMENTATION_COMMANDS.includes(command)) {
        state.implementation_happened = true;
        activateBuckWorkflowMode(state, "command", `/${command} command`);
        if (state.plan_mode_active) {
          state.plan_mode_active = false;
          ctx.ui.notify("📝 Plan mode disabled - entering implementation", "info");
        }
      }

      if (command === "b-save") {
        state.save_completed = true;
        scheduleQmdReindex(0);
      }

      writeState(state);
      updateWorkflowStatuses(ctx, state);

      if (PLAN_MODE_COMMANDS.includes(command)) {
        ctx.ui.notify(
          "✅ Buck workflow planning mode enabled - writes allowed to .context/, docs/ only",
          "info",
        );
      }

      // --- Model auto-switch for phased plans ---
      if (MODEL_SWITCH_COMMANDS.includes(command)) {
        pendingModelSwitchCommand = command;
      }

      return { action: "continue" as const };
    }

    // maybeAutoEnableBuckWorkflowMode(ctx, text, state);
    // NOTE: Auto-enable removed per user request. Planning mode is now opt-in only.
    // Re-enable by uncommenting or using /b-mode on, /b-plan, etc.
    writeState(state);

    return { action: "continue" as const };
  });


  // --- Plan Mode tool blocking ---

  pi.on("tool_call", async (event, ctx) => {
    const state = readState();

    // CWD restriction: block write/edit outside project directory (when active)
    // This runs independently of plan mode.
    if (state?.restrict_cwd_active) {
      const path = (event.input as any)?.path || "";
      if (event.toolName === "write" || event.toolName === "edit") {
        if (path && !isWithinCwd(path, cwd)) {
          return { block: true, reason: `CWD restriction: ${path} is outside project directory (${cwd})` };
        }
      }
    }

    if (!state?.plan_mode_active) return;

    // Handle write tool
    if (event.toolName === "write") {
      const path = (event.input as any)?.path || "";
      if (!isAllowedPlanWritePath(path, cwd)) {
        return { block: true, reason: `Plan mode: ${path} is not in allowed paths. Allowed: .context/, docs/` };
      }
      return;
    }

    // Handle edit tool
    if (event.toolName === "edit") {
      const path = (event.input as any)?.path || "";
      if (!isAllowedPlanWritePath(path, cwd)) {
        const reason = `Plan mode: ${path} is not in allowed paths. Allowed: .context/, docs/`;
        return { block: true, reason };
      }
      return;
    }

    // Handle bash tool
    if (event.toolName === "bash") {
      const command = (event.input as any)?.command || "";
      const entries = ctx.sessionManager.getEntries();

      if (getBashOverride(entries, command)) return;

      if (MUTATING_GIT_PATTERNS.some((p) => p.test(command))) {
        return { block: true, reason: "Plan mode: mutating git commands are not allowed." };
      }

      // Allow safe redirects: 2>/dev/null, 2>&1, &>/dev/null, >/dev/null
      const redirectMatches = command.match(/>[^>]*/g) || [];
      const unsafeRedirects = redirectMatches.filter((r) => {
        const target = r.slice(1).trim();
        // Safe redirect targets
        if (target === "/dev/null") return false;
        if (target.startsWith("&")) return false; // 2>&1, &>file
        return true;
      });
      if (unsafeRedirects.length > 0) {
        return { block: true, reason: "Plan mode: file redirects are not allowed." };
      }

      if (isWhitelistedBash(command)) return;

      // Allow commands that target allowed plan-mode paths (mkdir, touch, cp, mv within .context/)
      if (commandTargetsAllowedPath(command, cwd)) return;

      // AI review for non-whitelisted commands
      try {
        const currentModel = ctx.model;
        if (!currentModel) {
          return { block: true, reason: "Plan mode: cannot review command (no model available)." };
        }

        const authResult = await ctx.modelRegistry.getApiKeyAndHeaders(currentModel);
        if (!authResult.ok) {
          return { block: true, reason: "Plan mode: cannot review command (auth failed)." };
        }

        const response = await completeSimple(
          currentModel,
          {
            messages: [{
              role: "user",
              content: [{
                type: "text",
                text: `Is this bash command EXPLORATORY (read-only, safe in plan mode) or MUTATING (writes, deletes, or changes state)?\n\n$ ${command}\n\nRespond with a single word: EXPLORATORY or MUTATING`,
              }],
              timestamp: Date.now(),
            }],
          },
          { apiKey: authResult.apiKey, headers: authResult.headers, maxTokens: 256 },
        );

        const text = response.content
          .filter((c: any) => c.type === "text")
          .map((c: any) => c.text)
          .join(" ")
          .toLowerCase();

        if (text.includes("mutating")) {
          const allowed = await ctx.ui.confirm(
            "Plan mode: command blocked",
            `This command would mutate state:\n\n  $ ${command}\n\nAllow anyway?`,
          );

          if (allowed) {
            pi.appendEntry("plan-mode-bash-override", { command, timestamp: Date.now() });
            return;
          }
          return { block: true, reason: "Plan mode: command would mutate state." };
        }
        return;
      } catch (error: any) {
        console.error("[plan-mode] AI review failed:", error);
        const allowed = await ctx.ui.confirm(
          "Plan mode: AI review failed",
          `Could not review command:\n\n  ${error.message}\n\n  $ ${command}\n\nAllow anyway?`,
        );
        if (allowed) {
          pi.appendEntry("plan-mode-bash-override", { command, timestamp: Date.now() });
          return;
        }
        return { block: true, reason: "Plan mode: AI review failed. Command blocked." };
      }
    }
  });

  // --- Track file modifications via tool results ---

  pi.on("tool_result", async (event, _ctx) => {
    if (!cwd) return;
    const state = readState();
    if (!state) return;

    let changed = false;

    // Track write and edit tool file paths
    if (event.toolName === "write" || event.toolName === "edit") {
      const filePath = (event.input as any)?.path;
      if (filePath) {
        trackFile(state, filePath);
        const rel = toRelativePath(filePath);
        if (rel && !isAllowedPlanWritePath(rel)) {
          state.implementation_happened = true;
        }
        changed = true;
        if (isMemoryFile(filePath)) scheduleQmdReindex();
      }
    }

    if (changed) writeState(state);
  });

  // --- Model switch-back and save warning handled in unified agent_end below ---

  // --- Inject session state into compaction context ---

  pi.on("session_before_compact", async (event, _ctx) => {
    const state = readState();
    if (!state) return;

    const cmds = state.commands_run.map((c) => c.command).join(", ") || "none";
    const files = state.files_modified.join(", ") || "none";

    const context =
      `## Buck Workflow Session State\n` +
      `- Commands run: ${cmds}\n` +
      `- Implementation happened: ${state.implementation_happened}\n` +
      `- Save completed: ${state.save_completed}\n` +
      `- Files modified: ${files}\n` +
      `- Memory file: ${state.memory_file || "not yet created"}\n` +
      `- Mode: ${state.mode}\n` +
      `- Buck workflow mode: ${state.buck_workflow_mode_active} (${state.buck_workflow_mode_source ?? "none"})\n` +
      `- Plan write guard: ${state.plan_mode_active}`;

    return {
      compaction: {
        summary: context,
        firstKeptEntryId: event.preparation.firstKeptEntryId,
        tokensBefore: event.preparation.tokensBefore,
      },
    };
  });

  // --- Register /b-save command (no prompt template needed, uses extension logic) ---

  pi.registerCommand("b-save", {
    description: "Record session history — checkpoint memory, backlog, and cross-references",
    handler: async (_args, ctx) => {
      const state = readState();
      if (!state) {
        ctx.ui.notify("No .context/workflow state found. Nothing to save.", "warning");
        return;
      }

  // Send the b-save instructions as a user message to the LLM
      const savePrompt = `You are the b-save agent in the Buck workflow.

## Skills to Load
- **qmd**: Read \`~/.agents/skills/qmd/SKILL.md\` for proper QMD usage (collection management, search commands, query syntax).

## Your 10 Responsibilities

1. **Read Session State** — Read \`.context/workflow/current-session.json\` for context
2. **Subject Folder** — Create if missing; consolidate loose artifacts
3. **Memory Creation** — Create/update session memory file with proper frontmatter:
   \`\`\`yaml
   ---
   date: YYYY-MM-DD
   domains: [tooling, refactor]
   topics: [keyword, list]
   subject: YYYY-MM-DD.subject-name
   artifacts: [plan-file.md]
   related: []
   priority: high
   status: active
   ---
   \`\`\`
4. **Cross-Reference Stitching** — Back-fill \`memory:\` arrays in plan/spec files
5. **Backlog Update** — Read \`.context/backlog/todo.md\` (legacy fallback: \`.context/backlog.md\`). For completed items: remove from \`todo.md\`, update item file \`status: completed\` + \`completed: YYYY-MM-DD\`, move item file to \`archive/YYYY-MM/<slug>.md\`, add summary to \`archive/completed.md\`. For new/deferred items: create backing item file in \`items/<slug>.md\` + linked checkbox in \`todo.md\`. Only auto-archive explicitly completed items — if completion is inferred, surface it for user decision.
6. **Spec Status Updates** — Set \`status: completed\` on finished specs (no file moves)
7. **Index Update** — Update \`.context/memory/index.md\` with single-line entry at top
8. **QMD Re-index** — For QMD usage, read the qmd skill at \`~/.agents/skills/qmd/SKILL.md\` for proper command syntax. Ensure the memory collection is indexed:
    - Use: \`qmd collection add .context/memory --name buck-workflow-memory --mask '*.md'\`
    - Safe to run on existing collections; ignores qmd update failures on unrelated collections
    - The qmd skill documents collection management, search commands, and maintenance (BM25 vs vector search, query syntax, etc.)
9. **Phase State Consolidation** — If phased plan files exist in the subject folder:
   a. Read all \`phase-N-*.md\` files — verify their \`status\` matches reality (were acceptance criteria met?)
   b. Read the phases overview \`plan-*-phases.md\` — verify the summary table matches phase file states
   c. If any phase file shows \`status: in-progress\` but all criteria are checked, update to \`completed\` and set \`completed_at: YYYY-MM-DD\`
   d. If the overview table is stale (phase file says completed but overview says pending/in-progress), update the overview
   e. For legacy single-file format (no discrete phase files), skip this step
10. **Iterate Artifact Consolidation** — Scan subject folders for \`iterate-*.md\` files:
    a. If the session modified files listed in an active \`iterate-*.md\`, verify its acceptance items are addressed
    b. If the iterate file still shows \`status: active\` but work was done against it, update to \`status: completed\`
    c. Include \`iterate-*.md\` filenames in the memory file's \`artifacts:\` frontmatter array
    d. If the iterate file references the plan it came from, back-fill the plan with \`iterations: [iterate-<subject>.md]\`

## Session State
\`\`\`json
${JSON.stringify(state, null, 2)}
\`\`\`

## Key Principle
Plans live in subject folders (intent). History lives in \`.context/memory/\` (record). /b-save turns intent into record.

Execute all 9 steps now. Write only to \`.context/\`.`;

      pi.sendUserMessage(savePrompt, { deliverAs: "followUp" });

      state.save_completed = true;
      writeState(state);
      scheduleQmdReindex(0);
    },
  });

  // --- Model Auto-Switch Handler ---

  async function handleModelSwitch(pi: ExtensionAPI, ctx: any): Promise<void> {
    const mapping = readModelMapping(cwd);

    // No mapping configured — offer setup
    if (!mapping) {
      await offerModelMappingSetup(ctx);
      return;
    }

    const contextDir = join(cwd, ".context");
    const difficulty = findActivePhaseDifficulty(contextDir);

    if (!difficulty) {
      // Non-phased plan — soft suggestion
      await suggestModelForNonPhasedPlan(ctx, mapping, contextDir);
      return;
    }

    // Check current model
    const currentModel = ctx.model;
    if (!currentModel) return;

    const currentTier = getCurrentModelTier(
      { provider: currentModel.provider, id: currentModel.id },
      mapping,
    );

    // No mismatch or unknown tier — no switch needed
    if (currentTier === difficulty || currentTier === "unknown") return;

    // Switch model
    const targetModelId = mapping[difficulty];
    const parsed = parseModelId(targetModelId);
    if (!parsed) return;

    const targetModel = ctx.modelRegistry.find(parsed.provider, parsed.id);
    if (!targetModel) {
      ctx.ui.notify(`Model ${targetModelId} not found in registry`, "warning");
      return;
    }

    // Set flag BEFORE calling setModel so model_select handler knows it's us
    autoSwitchingModel = true;
    lastAutoSwitchTimestamp = Date.now();
    const success = await pi.setModel(targetModel);
    autoSwitchingModel = false;

    if (!success) {
      ctx.ui.notify(`No API key for ${targetModelId}`, "error");
      return;
    }

    // Save original model for switch-back
    modelSwitchState = {
      originalModel: { provider: currentModel.provider, id: currentModel.id },
      switchedForPhase: true,
      userOverrode: false,
      phaseDifficulty: difficulty,
    };

    ctx.ui.notify(
      `🔄 Switched to ${targetModelId} for ${difficulty} phase (was ${currentModel.provider}/${currentModel.id})`,
      "info",
    );
  }

  /**
   * Offer the user a grouped model picker to configure buckModelMapping.
   * Groups available models by tier (easy/medium/hard based on any current
   * mapping config), lets them pick one model per tier, then writes the
   * result to ~/.pi/agent/settings.json.
   */
  async function offerModelMappingSetup(ctx: any): Promise<void> {
    const settingsPath = join(homedir(), ".pi", "agent", "settings.json");

    // Read current mapping to know which tier each model belongs to
    let currentMapping: ModelMapping | null = null;
    try {
      if (existsSync(settingsPath)) {
        const raw = JSON.parse(readFileSync(settingsPath, "utf-8"));
        const m = raw?.buckModelMapping;
        if (m?.easy && m?.medium && m?.hard) {
          currentMapping = m as ModelMapping;
        }
      }
    } catch { /* ignore */ }

    // Collect available models from registry
    let availableModels: Array<{ id: string; label: string; tier: string }> = [];
    try {
      const models = ctx.modelRegistry.getAvailable();
      availableModels = models.map((m: any) => {
        const fullId = `${m.provider}/${m.id}`;
        let tier = "unassigned";
        if (currentMapping) {
          if (fullId === currentMapping.easy) tier = "easy";
          else if (fullId === currentMapping.medium) tier = "medium";
          else if (fullId === currentMapping.hard) tier = "hard";
        }
        const label = `${m.provider}/${m.id}`;
        return { id: fullId, label, tier };
      });
    } catch (e) {
      console.error("[buck-workflow] Could not read model registry:", e);
    }

    if (availableModels.length === 0) {
      ctx.ui.notify(
        "No models with API keys found. Configure models in Pi settings first.",
        "warning",
      );
      return;
    }

    // Group by tier
    const groups: Record<string, typeof availableModels> = {
      easy: [], medium: [], hard: [], unassigned: [],
    };
    for (const m of availableModels) {
      groups[m.tier].push(m);
    }

    const tiers: Array<"easy" | "medium" | "hard"> = ["easy", "medium", "hard"];
    const selected: Record<string, string | null> = {
      easy: null, medium: null, hard: null,
    };

    // Pre-select current choices
    for (const tier of tiers) {
      if (groups[tier].length > 0) {
        selected[tier] = groups[tier][0].id;
      }
    }

    const pickModelForTier = async (
      tier: "easy" | "medium" | "hard",
      choices: string[],
      current: string | null,
    ): Promise<string | undefined> => {
      const items: SelectItem[] = choices.map((choice) => ({
        value: choice,
        label: choice,
        description: choice === current ? "(current choice)" : undefined,
      }));

      return await ctx.ui.custom((tui: any, theme: any, _kb: any, done: (result: string | null) => void) => {
        const container = new Container();
        container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
        container.addChild(new Text(theme.fg("accent", `Pick the ${tier.toUpperCase()} model`), 1, 0));

        const selectList = new SelectList(items, Math.min(items.length, 10), {
          selectedPrefix: (text) => theme.fg("accent", text),
          selectedText: (text) => theme.fg("accent", text),
          description: (text) => theme.fg("muted", text),
          scrollInfo: (text) => theme.fg("dim", text),
          noMatch: (text) => theme.fg("warning", text),
        });

        if (current) {
          const currentIndex = items.findIndex((item) => item.value === current);
          if (currentIndex !== -1) {
            selectList.setSelectedIndex(currentIndex);
          }
        }

        selectList.onSelect = (item) => done(item.value);
        selectList.onCancel = () => done(null);

        container.addChild(selectList);
        container.addChild(new Text(theme.fg("dim", "↑↓ navigate • Enter select • Esc cancel"), 1, 0));
        container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

        return {
          render(width: number) {
            return container.render(width);
          },
          invalidate() {
            container.invalidate();
          },
          handleInput(data: string) {
            selectList.handleInput(data);
            tui.requestRender();
          },
        };
      });
    };

    // Show a picker per tier
    for (const tier of tiers) {
      let choices = groups[tier].map((m) => m.label);
      if (choices.length === 0) {
        // This tier has no models yet — pull from unassigned pool
        if (groups.unassigned.length > 0) {
          choices = groups.unassigned.map((m) => m.label);
        } else {
          choices = availableModels.map((m) => m.label);
        }
      }

      const current = selected[tier];
      if (current && choices.includes(current)) {
        choices = [current, ...choices.filter((choice) => choice !== current)];
      }
      choices = [...new Set(choices)];

      const choice = await pickModelForTier(tier, choices, current);
      if (!choice) {
        ctx.ui.notify("Model mapping setup skipped.", "info");
        return; // User cancelled
      }
      selected[tier] = choice;
    }

    // Write the mapping to settings.json
    const newMapping: ModelMapping = {
      easy: selected.easy ?? "zai-glm/glm-4.7-flash",
      medium: selected.medium ?? "anthropic/claude-sonnet-4-6",
      hard: selected.hard ?? "anthropic/claude-opus-4-7",
    };

    let settings: Record<string, any> = {};
    try {
      if (existsSync(settingsPath)) {
        settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      }
    } catch { /* start fresh */ }

    settings["buckModelMapping"] = newMapping;

    try {
      const dir = join(homedir(), ".pi", "agent");
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
    } catch (e: any) {
      ctx.ui.notify(`Failed to write settings: ${e.message}`, "error");
      return;
    }

    ctx.ui.notify(
      `\u2713 buckModelMapping saved to ~/.pi/agent/settings.json\n` +
      `   easy:   ${newMapping.easy}\n` +
      `   medium: ${newMapping.medium}\n` +
      `   hard:   ${newMapping.hard}\n` +
      `Run /reload to activate.`,
      "success",
    );
  }


  async function suggestModelForNonPhasedPlan(
    ctx: any,
    mapping: ModelMapping,
    contextDir: string,
  ): Promise<void> {
    const currentModel = ctx.model;
    if (!currentModel) return;

    const planPath = findMostRecentPlan(contextDir);
    if (!planPath) return;

    try {
      const planContent = readFileSync(planPath, "utf-8");
      const stepCount = (planContent.match(/^\d+\. /gm) || []).length;
      const fileCount = (planContent.match(/`[^`]+`/g) || []).length;

      let suggested: "easy" | "medium" | "hard";
      if (stepCount > 8 || fileCount > 5) suggested = "hard";
      else if (stepCount <= 3 && fileCount <= 2) suggested = "easy";
      else suggested = "medium";

      const currentTier = getCurrentModelTier(
        { provider: currentModel.provider, id: currentModel.id },
        mapping,
      );
      if (currentTier === suggested) return;

      const suggestedModelId = mapping[suggested];
      ctx.ui.notify(
        `💡 Tip: This plan looks ${suggested}. Consider switching to ${suggestedModelId} ` +
        `(currently on ${currentModel.provider}/${currentModel.id})`,
        "info",
      );
    } catch {
      // ignore read errors
    }
  }

  // --- Detect user-initiated model changes mid-phase ---

  pi.on("model_select", async (event, _ctx) => {
    if (!modelSwitchState.switchedForPhase) return;
    // If this is our own auto-switch, don't mark as user override
    if (autoSwitchingModel) return;
    // Accept our own auto-switch events that arrived after the flag cleared
    if (Date.now() - lastAutoSwitchTimestamp < AUTO_SWITCH_GRACE_MS) return;
    // Any other model selection during an active phase = user override
    modelSwitchState.userOverrode = true;
  });

  // --- Switch back to original model after phase completes ---

  pi.on("agent_end", async (_event, ctx) => {
    // Existing save warning logic
    const state = readState();
    if (state?.implementation_happened && !state.save_completed) {
      ctx.ui.notify(
        "⚠️ Implementation work unsaved. Run /b-save to record this session.",
        "warning",
      );
    }

    // Model switch-back
    if (!modelSwitchState.switchedForPhase) return;
    if (modelSwitchState.userOverrode) {
      // User manually switched — respect their choice, cancel switch-back
      modelSwitchState = {
        originalModel: null,
        switchedForPhase: false,
        userOverrode: false,
        phaseDifficulty: null,
      };
      return;
    }

    const original = modelSwitchState.originalModel;
    if (!original) return;

    const originalModel = ctx.modelRegistry.find(original.provider, original.id);
    if (!originalModel) return;

    autoSwitchingModel = true;
    lastAutoSwitchTimestamp = Date.now();
    const success = await pi.setModel(originalModel);
    autoSwitchingModel = false;

    if (success) {
      ctx.ui.notify(
        `🔄 Switched back to ${original.provider}/${original.id}`,
        "info",
      );
    }

    modelSwitchState = {
      originalModel: null,
      switchedForPhase: false,
      userOverrode: false,
      phaseDifficulty: null,
    };
  });
}
