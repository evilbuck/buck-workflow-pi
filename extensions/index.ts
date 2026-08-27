import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { wire as wireTpsTracker } from "./tps-tracker.js";
import { wire as wireBprImproved } from "./b-pr-improved/index.js";
import { wire as wireBCommitImproved } from "./b-commit-improved/index.js";
import { wire as wireKamalRelease } from "./b-kamal-release/index.js";
import { wire as wirePlanArtifact } from "./plan-artifact.js";
import { wire as wireBSaveImproved } from "./b-save-improved/index.js";
import { mappingFromOmpRoles } from "./omp-models.js";


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

/** Minimal shape of the extension context used by model-switch handlers. */
interface ModelSwitchContext {
  ui: {
    notify: (message: string, level: string) => void;
  };
  model: { provider: string; id: string } | undefined;
  modelRegistry: {
    getAvailable: () => Array<{ provider: string; id: string }>;
    find: (provider: string, id: string) => unknown;
    getApiKeyAndHeaders: (model: { provider: string; id: string }) => Promise<{ ok: boolean; apiKey?: string; headers?: Record<string, string> }>;
  };
}


// --- Model Auto-Switch Helpers ---

function readModelMapping(projectDir: string): ModelMapping | null {
  const fromOmp = mappingFromOmpRoles(projectDir);
  if (fromOmp) return fromOmp;

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

// --- Extension ---

const MODEL_SWITCH_COMMANDS: ReadonlySet<string> = new Set([
  "b-build", "b-build-hard", "b-iterate", "b-review",
]);

export default function (pi: ExtensionAPI) {
  let cwd = "";

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

  // --- TPS tracker ---
  wireTpsTracker(pi);
  // --- b-pr-improved: deterministic PR creation ---
  wireBprImproved(pi);
  // --- b-commit-improved: deterministic Conventional Commit ---
  wireBCommitImproved(pi);
  // --- b-kamal-release: tag + deploy with Kamal ---
  wireKamalRelease(pi);
  // --- plan-artifact: durable .context persistence for OMP plan mode (opt-in) ---
  wirePlanArtifact(pi);
  // --- b-save-improved: deterministic session-record checkpoint ---
  wireBSaveImproved(pi);

  // --- Session lifecycle ---

  pi.on("session_start", async (_event, ctx) => {
    cwd = ctx.cwd;
  });

  // --- Detect model-switch commands ---

  pi.on("input", async (event) => {
    const text = event.text?.trim() ?? "";
    const match = text.match(/^\/(b-\w[\w-]*)(\s|$)/);
    if (match && MODEL_SWITCH_COMMANDS.has(match[1])) {
      pendingModelSwitchCommand = match[1];
    }
    return { action: "continue" as const };
  });

  // --- Fire pending model switch ---

  pi.on("before_agent_start", async (_event, ctx: ModelSwitchContext) => {
    if (pendingModelSwitchCommand && MODEL_SWITCH_COMMANDS.has(pendingModelSwitchCommand)) {
      pendingModelSwitchCommand = null;
      await handleModelSwitch(pi, ctx);
    }
  });

  // --- Detect user-initiated model changes mid-phase ---

  pi.on("model_select", async () => {
    if (!modelSwitchState.switchedForPhase) return;
    if (autoSwitchingModel) return;
    if (Date.now() - lastAutoSwitchTimestamp < AUTO_SWITCH_GRACE_MS) return;
    modelSwitchState.userOverrode = true;
  });

  // --- Switch back to original model after phase completes ---

  pi.on("agent_end", async (_event, ctx: ModelSwitchContext) => {
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
    const success = await pi.setModel(originalModel as Parameters<typeof pi.setModel>[0]);
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

  // --- Model Auto-Switch Handler ---

  async function handleModelSwitch(pi: ExtensionAPI, ctx: ModelSwitchContext): Promise<void> {
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
    const success = await pi.setModel(targetModel as Parameters<typeof pi.setModel>[0]);
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
   * No OMP modelRoles (and no leftover Pi buckModelMapping). Point at
   * ~/.omp/agent/config.yml instead of writing ~/.pi/agent/settings.json.
   */
  async function offerModelMappingSetup(ctx: ModelSwitchContext): Promise<void> {
    ctx.ui.notify(
      "No OMP modelRoles configured. Add default/slow/smol to ~/.omp/agent/config.yml (or .omp/config.yml) to enable phase-based model switching.",
      "warning",
    );
  }


  async function suggestModelForNonPhasedPlan(
    ctx: ModelSwitchContext,
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

      const suggested: "easy" | "medium" | "hard" =
        stepCount > 8 || fileCount > 5 ? "hard"
          : stepCount <= 3 && fileCount <= 2 ? "easy"
          : "medium";

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
}
