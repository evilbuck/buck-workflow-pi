/**
 * Pure doctor for `/buck-models --doctor`.
 *
 * Inventories every configured model across project and user-global profiles,
 * classifies availability against a live registry, marks the effective active
 * profile using the same precedence as runtime routing, and emits a deterministic
 * report. Holds no I/O, no UI, no filesystem access.
 */
import {
  BUCK_STAGE_KEYS,
  type BuckConfigSource,
  type BuckModelCandidate,
  type BuckModelsConfig,
  type BuckStageConfig,
  type BuckStageKey,
} from "../omp-models.js";

export type DoctorSeverity = "info" | "warning" | "error";

export type DoctorStatus = "available" | "unavailable" | "empty";

export interface DoctorConfiguredModel {
  id: string;
  status: DoctorStatus;
  /** Index of this occurrence within its stage list; 0-based. */
  position: number;
}

export interface DoctorStage {
  stage: BuckStageKey;
  thinking: string;
  ownedBy: "project" | "user-global";
  models: DoctorConfiguredModel[];
}

export interface DoctorProfile {
  scope: BuckConfigSource;
  name: string;
  stages: DoctorStage[];
}

export interface DoctorActiveResolution {
  /** Effective active name resolved by the same precedence as runtime routing. */
  name: string | null;
  /** Source scope for the active name, when one was chosen. */
  source: BuckConfigSource | null;
  /** Health: `ok` when active resolves cleanly, `blank` or `unknown` otherwise. */
  health: "ok" | "blank" | "unknown";
  /** Profile names that existed in either scope (informational). */
  configuredProfiles: string[];
}

export interface DoctorCounts {
  configuredOccurrences: number;
  uniqueIds: number;
  unavailableOccurrences: number;
}

export interface DoctorReport {
  severity: DoctorSeverity;
  summary: string;
  active: DoctorActiveResolution;
  profiles: DoctorProfile[];
  /** Stable textual report ready for `ui.notify`. */
  text: string;
  configuredOccurrences: number;
  uniqueIds: number;
  unavailableOccurrences: number;
}

export interface DoctorLoad {
  /** Parsed project config, or `null` when the file is absent (valid empty scope). */
  project: BuckModelsConfig | null;
  /** Parsed user-global config, or `null` when the file is absent. */
  global: BuckModelsConfig | null;
  /** Path of a config file that is unreadable or not valid YAML. */
  invalidPath: string | null;
  /** Why `invalidPath` failed. Absent means invalid YAML, matching older callers. */
  invalidReason?: "yaml" | "unreadable";
  /** Live registry ids, normalized to `provider/id`. Absent registry means `null`. */
  availableIds: ReadonlySet<string> | null;
}

function isProjectStage(config: BuckModelsConfig, profile: string, stage: BuckStageKey): boolean {
  return Object.prototype.hasOwnProperty.call(config.profiles[profile]?.stages ?? {}, stage);
}

function stageOwnership(
  scope: BuckConfigSource,
  project: BuckModelsConfig | null,
  globalConfig: BuckModelsConfig | null,
  profile: string,
  stage: BuckStageKey,
): { stage: BuckStageConfig | null; ownedBy: "project" | "user-global" } {
  if (scope === "project") {
    const projectStage = project?.profiles[profile]?.stages[stage];
    if (projectStage) return { stage: projectStage, ownedBy: "project" };
    const globalStage = globalConfig?.profiles[profile]?.stages[stage];
    return { stage: globalStage ?? null, ownedBy: "user-global" };
  }
  const globalStage = globalConfig?.profiles[profile]?.stages[stage];
  return { stage: globalStage ?? null, ownedBy: "user-global" };
}

function profileExistsIn(config: BuckModelsConfig | null, profile: string): boolean {
  if (!config) return false;
  return Object.prototype.hasOwnProperty.call(config.profiles, profile);
}

/**
 * Resolve the effective active profile using runtime-equivalent precedence:
 *   1. nonblank project `active`
 *   2. nonblank global `active`
 *   3. sole profile when exactly one is configured across both scopes
 * Blank/unknown selections are reported without silently substituting.
 */
export function resolveEffectiveActive(load: DoctorLoad): DoctorActiveResolution {
  const configuredProfiles = uniqueConfiguredProfileNames(load);
  const projectActive = load.project?.active.trim() ?? "";
  const globalActive = load.global?.active.trim() ?? "";
  if (projectActive) return resolveCandidate(load, "project", projectActive, configuredProfiles);
  if (globalActive) return resolveCandidate(load, "global", globalActive, configuredProfiles);
  return resolveSoleProfile(load, configuredProfiles);
}

function resolveCandidate(
  load: DoctorLoad,
  scope: BuckConfigSource,
  candidate: string,
  configuredProfiles: string[],
): DoctorActiveResolution {
  // Runtime `nameKnown` accepts the active name from either scope regardless of
  // which scope declared it (extensions/omp-models.ts resolveActiveName).
  const known = profileExistsIn(load.project, candidate) || profileExistsIn(load.global, candidate);
  return known
    ? { name: candidate, source: scope, health: "ok", configuredProfiles }
    : { name: candidate, source: scope, health: "unknown", configuredProfiles };
}

function resolveSoleProfile(
  load: DoctorLoad,
  configuredProfiles: string[],
): DoctorActiveResolution {
  if (configuredProfiles.length !== 1) {
    return { name: null, source: null, health: "blank", configuredProfiles };
  }
  const only = configuredProfiles[0]!;
  const scope = profileExistsIn(load.project, only) ? "project" : "global";
  return { name: only, source: scope, health: "ok", configuredProfiles };
}

function uniqueConfiguredProfileNames(load: DoctorLoad): string[] {
  const seen: Record<string, true> = {};
  const names: string[] = [];
  for (const config of [load.project, load.global]) {
    if (!config) continue;
    for (const name of Object.keys(config.profiles)) {
      if (seen[name]) continue;
      seen[name] = true;
      names.push(name);
    }
  }
  return names.sort();
}

function classifyModels(
  models: readonly BuckModelCandidate[],
  available: ReadonlySet<string>,
): DoctorConfiguredModel[] {
  return models.map((model, position) => ({
    id: model.id,
    status: available.has(model.id) ? "available" : "unavailable",
    position,
  }));
}

/**
 * Inventory one profile+scope pairing. Always returns a profile entry so the
 * active resolution can surface blank/unknown selection; stages are only
 * included when they exist in either scope.
 */
function inventoryProfile(
  scope: BuckConfigSource,
  profile: string,
  project: BuckModelsConfig | null,
  globalConfig: BuckModelsConfig | null,
  available: ReadonlySet<string>,
): DoctorProfile {
  const stages: DoctorStage[] = [];
  for (const key of BUCK_STAGE_KEYS) {
    const stage = inventoryStage(scope, profile, key, project, globalConfig, available);
    if (stage) stages.push(stage);
  }
  return { scope, name: profile, stages };
}

function inventoryStage(
  scope: BuckConfigSource,
  profile: string,
  stage: BuckStageKey,
  project: BuckModelsConfig | null,
  globalConfig: BuckModelsConfig | null,
  available: ReadonlySet<string>,
): DoctorStage | null {
  const projectHas = projectHasStage(project, profile, stage);
  const globalHas = globalHasStage(globalConfig, profile, stage);
  // Global scope inventories only its own configured stages; project scope also
  // lists inherited global stages (flagged by `ownedBy`).
  if (scope === "global" && !globalHas) return null;
  if (!projectHas && !globalHas) return null;
  const { stage: stageConfig, ownedBy } = stageOwnership(scope, project, globalConfig, profile, stage);
  return {
    stage,
    thinking: stageConfig?.thinking ?? "off",
    ownedBy,
    models: stageConfig ? classifyModels(stageConfig.models, available) : [],
  };
}

function projectHasStage(config: BuckModelsConfig | null, profile: string, stage: BuckStageKey): boolean {
  return isProjectStage(config ?? { active: "", profiles: {} }, profile, stage);
}

function globalHasStage(config: BuckModelsConfig | null, profile: string, stage: BuckStageKey): boolean {
  return isProjectStage(config ?? { active: "", profiles: {} }, profile, stage);
}

/**
 * Build the deterministic doctor report. The report is read-only: it never
 * edits configurations, never opens dialogs, never touches the filesystem.
 */
export function buildDoctorReport(load: DoctorLoad): DoctorReport {
  if (load.invalidPath) {
    const detail = load.invalidReason === "unreadable"
      ? "could not be read"
      : "is not valid YAML";
    return errorReport(`buckModels config at "${load.invalidPath}" ${detail}; fix it or move it aside.`);
  }
  if (load.availableIds === null) {
    return errorReport("Model registry unavailable; cannot verify saved model ids.");
  }
  // Inventory each saved scope/profile independently: same-named profiles in
  // different scopes both appear, and overridden global stages stay visible.
  const profiles: DoctorProfile[] = [];
  for (const [scope, config] of [
    ["project", load.project] as const,
    ["global", load.global] as const,
  ]) {
    if (!config) continue;
    for (const name of Object.keys(config.profiles).sort()) {
      profiles.push(inventoryProfile(scope, name, load.project, load.global, load.availableIds));
    }
  }
  const active = resolveEffectiveActive(load);
  const counts = countConfigured(profiles);
  const severity = doctorSeverity(active, counts);
  const text = formatReport({ severity, active, profiles, counts });
  return {
    severity,
    summary: formatSummary(counts, active, severity),
    active,
    profiles,
    text,
    configuredOccurrences: counts.configuredOccurrences,
    uniqueIds: counts.uniqueIds,
    unavailableOccurrences: counts.unavailableOccurrences,
  };
}

/**
 * Severity evaluates active health before any empty-inventory special case:
 * an unknown or blank-with-profiles selection is always a warning, even when
 * no profile stages are configured. A genuinely empty configuration stays info.
 */
function doctorSeverity(active: DoctorActiveResolution, counts: DoctorCounts): DoctorSeverity {
  if (active.health === "unknown") return "warning";
  if (active.health === "blank" && active.configuredProfiles.length > 0) return "warning";
  if (counts.unavailableOccurrences > 0) return "warning";
  return "info";
}

function countConfigured(profiles: DoctorProfile[]): DoctorCounts {
  let configuredOccurrences = 0;
  let unavailableOccurrences = 0;
  const ids = new Set<string>();
  for (const profile of profiles) {
    for (const stage of profile.stages) {
      // Inherited stages are displayed for context but counted once, under the
      // scope that actually saved them.
      const savedHere = profile.scope === "project"
        ? stage.ownedBy === "project"
        : stage.ownedBy === "user-global";
      if (!savedHere) continue;
      for (const model of stage.models) {
        configuredOccurrences += 1;
        ids.add(model.id);
        if (model.status === "unavailable") unavailableOccurrences += 1;
      }
    }
  }
  return { configuredOccurrences, uniqueIds: ids.size, unavailableOccurrences };
}

function errorReport(message: string): DoctorReport {
  return {
    severity: "error",
    summary: message,
    active: { name: null, source: null, health: "blank", configuredProfiles: [] },
    profiles: [],
    text: message,
    configuredOccurrences: 0,
    uniqueIds: 0,
    unavailableOccurrences: 0,
  };
}

function formatSummary(counts: DoctorCounts, _active: DoctorActiveResolution, severity: DoctorSeverity): string {
  const level = severity.toUpperCase();
  return `${level}: ${counts.configuredOccurrences} configured occurrence(s), ${counts.uniqueIds} unique id(s), ${counts.unavailableOccurrences} unavailable.`;
}

function formatReport(input: {
  severity: DoctorSeverity;
  active: DoctorActiveResolution;
  profiles: DoctorProfile[];
  counts: DoctorCounts;
}): string {
  const lines: string[] = [];
  lines.push(formatSummary(input.counts, input.active, input.severity));
  lines.push(formatActiveLine(input.active));
  if (input.profiles.length === 0) {
    lines.push("No configured Buck model profiles.");
    return lines.join("\n");
  }
  for (const profile of input.profiles) {
    lines.push(formatProfileHeader(profile, input.active, input.profiles));
    for (const stage of profile.stages) {
      lines.push(formatStageLine(stage));
    }
  }
  return lines.join("\n");
}

function formatActiveLine(active: DoctorActiveResolution): string {
  if (active.health === "ok" && active.name) {
    return `Active: ${active.name} (${active.source})`;
  }
  if (active.health === "unknown" && active.name) {
    return `Active: ${active.name} — UNKNOWN (no such profile in ${active.source ?? "either"} scope)`;
  }
  return `Active: (none) — ${active.configuredProfiles.length === 0 ? "no profiles configured" : "blank selection, multiple profiles exist"}`;
}

function formatProfileHeader(
  profile: DoctorProfile,
  active: DoctorActiveResolution,
  profiles: readonly DoctorProfile[],
): string {
  // Mark the active row in the scope that sourced the active name. When that
  // scope has no row for the name (cross-scope selection), fall back to any
  // row whose name matches so the effective active profile stays visible.
  const sourceRowExists = profiles.some(
    (candidate) => candidate.name === active.name && candidate.scope === active.source,
  );
  const nameMatch = active.name === profile.name;
  const marker = nameMatch && (active.source === profile.scope || !sourceRowExists) ? " *active*" : "";
  const scope = profile.scope === "project" ? "project" : "user-global";
  return `[${scope}] ${profile.name}${marker}`;
}

function formatStageLine(stage: DoctorStage): string {
  if (stage.models.length === 0) {
    return `  - ${stage.stage} (${stage.ownedBy}, thinking=${stage.thinking}): (no models)`;
  }
  const parts = stage.models.map((model) => {
    const tag = model.status === "available" ? "ok" : "MISSING";
    return `${model.id} [${tag}]`;
  });
  return `  - ${stage.stage} (${stage.ownedBy}, thinking=${stage.thinking}): ${parts.join(", ")}`;
}