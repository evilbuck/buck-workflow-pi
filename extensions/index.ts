import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import { Container, type SelectItem, SelectList, Text } from "@mariozechner/pi-tui";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { wire as wireTpsTracker } from "./tps-tracker.js";

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
    custom: <T>(factory: (tui: unknown, theme: UiTheme, kb: unknown, done: (result: T | null) => void) => TuiComponent) => Promise<T | null>;
  };
  model: { provider: string; id: string } | undefined;
  modelRegistry: {
    getAvailable: () => Array<{ provider: string; id: string }>;
    find: (provider: string, id: string) => unknown;
    getApiKeyAndHeaders: (model: { provider: string; id: string }) => Promise<{ ok: boolean; apiKey?: string; headers?: Record<string, string> }>;
  };
}

interface UiTheme {
  fg: (kind: string, text: string) => string;
}

interface TuiComponent {
  render: (width: number) => string;
  invalidate: () => void;
  handleInput: (data: string) => void;
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
   * Offer the user a grouped model picker to configure buckModelMapping.
   * Groups available models by tier (easy/medium/hard based on any current
   * mapping config), lets them pick one model per tier, then writes the
   * result to ~/.pi/agent/settings.json.
   */
  async function offerModelMappingSetup(ctx: ModelSwitchContext): Promise<void> {
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
      availableModels = models.map((m) => {
        const fullId = `${m.provider}/${m.id}`;
        let tier = "unassigned";
        if (currentMapping) {
          if (fullId === currentMapping.easy) tier = "easy";
          else if (fullId === currentMapping.medium) tier = "medium";
          else if (fullId === currentMapping.hard) tier = "hard";
        }
        return { id: fullId, label: `${m.provider}/${m.id}`, tier };
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
    const groups: Record<string, Array<{ id: string; label: string; tier: string }>> = {
      easy: [], medium: [], hard: [], unassigned: [],
    };
    for (const m of availableModels) {
      groups[m.tier].push(m);
    }

    const tiers: ReadonlyArray<"easy" | "medium" | "hard"> = ["easy", "medium", "hard"];
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

      return await ctx.ui.custom<string>((tui: unknown, theme: UiTheme, _kb: unknown, done: (result: string | null) => void) => {
        const container = new Container();
        container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
        container.addChild(new Text(theme.fg("accent", `Pick the ${tier.toUpperCase()} model`), 1, 0));

        const selectList = new SelectList(items, Math.min(items.length, 10), {
          selectedPrefix: (text: string) => theme.fg("accent", text),
          selectedText: (text: string) => theme.fg("accent", text),
          description: (text: string) => theme.fg("muted", text),
          scrollInfo: (text: string) => theme.fg("dim", text),
          noMatch: (text: string) => theme.fg("warning", text),
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
            (tui as { requestRender: () => void }).requestRender();
          },
        } satisfies TuiComponent;
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

    let settings: Record<string, unknown> = {};
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      ctx.ui.notify(`Failed to write settings: ${msg}`, "error");
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
