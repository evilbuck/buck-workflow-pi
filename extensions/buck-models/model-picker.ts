/**
 * Searchable checkbox list of installed model ids for `/buck-models`.
 * Enter saves the checked set. Escape cancels. Space toggles. Typing filters.
 */
import { decodeKittyPrintable, fuzzyFilter, matchesKey, truncateToWidth, visibleWidth, type KeybindingsManager } from "@mariozechner/pi-tui";
import {
  BUCK_STAGE_KEYS,
  type BuckModelCandidate,
  type BuckStageConfig,
  type BuckStageKey,
  type BuckStageWrite,
  type BuckThinking,
} from "../omp-models.js";

export interface StageModelChoice {
  id: string;
  unavailable: boolean;
}

export interface ModelPickerTheme {
  fg(color: string, text: string): string;
  bold(text: string): string;
}

export interface ModelPickerHost {
  custom?: <T>(factory: (
    tui: { requestRender(): void; terminal?: { rows?: number } },
    theme: ModelPickerTheme,
    keybindings: KeybindingsManager,
    done: (result: T) => void,
  ) => { render(width: number): string[]; invalidate(): void; handleInput?(data: string): void }, options?: {
    // Overlay mount keeps host-global chords (e.g. ctrl+t) from being consumed pre-focus.
    overlay?: boolean;
  }) => Promise<T>;
  notify(message: string, level?: "info" | "warning" | "error"): void;
}

export function stageModelChoices(
  available: readonly string[],
  current: readonly BuckModelCandidate[],
): StageModelChoice[] {
  const seen = new Set<string>();
  const choices: StageModelChoice[] = [];
  for (const model of current) {
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    choices.push({ id: model.id, unavailable: !available.includes(model.id) });
  }
  for (const id of [...available].filter((id) => !seen.has(id)).sort()) {
    seen.add(id);
    choices.push({ id, unavailable: false });
  }
  return choices;
}

export function candidatesFromSelection(
  selected: readonly string[],
  current: readonly BuckModelCandidate[],
): BuckModelCandidate[] {
  const notes = new Map(current.map((model) => [model.id, model.note]));
  const seen = new Set<string>();
  const models: BuckModelCandidate[] = [];
  for (const id of selected) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const note = notes.get(id);
    models.push(note === undefined ? { id } : { id, note });
  }
  return models;
}

export interface StageDraft {
  ids: string[];
  thinking: BuckThinking;
}

export type ProfileDrafts = Record<BuckStageKey, StageDraft>;

export interface CategoryViewState {
  focus: "selected" | "catalog";
  selectedCursor: number;
  catalogCursor: number;
  query: string;
}

export interface ProfileEditorState {
  tab: number;
  drafts: ProfileDrafts;
  views: Record<BuckStageKey, CategoryViewState>;
}

export interface ProfileEditorRunInput {
  profile: string;
  scope: string;
  state: ProfileEditorState;
  baselines: Partial<Record<BuckStageKey, BuckStageConfig>>;
  ownerships: Record<BuckStageKey, string>;
  available: readonly string[];
}

export type ProfileEditorOutcome =
  | { kind: "cancel" }
  | { kind: "thinking-request"; stage: BuckStageKey; resume: ProfileEditorState }
  | { kind: "submit"; drafts: ProfileDrafts };

export function seedProfileEditorState(
  baselines: Partial<Record<BuckStageKey, BuckStageConfig>>,
): ProfileEditorState {
  const drafts = {} as ProfileDrafts;
  const views = {} as Record<BuckStageKey, CategoryViewState>;
  for (const key of BUCK_STAGE_KEYS) {
    const baseline = baselines[key];
    drafts[key] = {
      ids: [...new Set((baseline?.models ?? []).map((model) => model.id))],
      thinking: baseline?.thinking ?? "off",
    };
    views[key] = { focus: "catalog", selectedCursor: 0, catalogCursor: 0, query: "" };
  }
  return { tab: 0, drafts, views };
}

function sameIdSet(a: readonly BuckModelCandidate[], b: readonly BuckModelCandidate[]): boolean {
  const aIds = new Set(a.map((model) => model.id));
  const bIds = new Set(b.map((model) => model.id));
  return aIds.size === bIds.size && [...aIds].every((id) => bIds.has(id));
}

export function deriveStageUpdates(
  drafts: ProfileDrafts,
  baselines: Partial<Record<BuckStageKey, BuckStageConfig>>,
): Partial<Record<BuckStageKey, BuckStageWrite>> {
  const updates: Partial<Record<BuckStageKey, BuckStageWrite>> = {};
  for (const key of BUCK_STAGE_KEYS) {
    const baseline = baselines[key];
    const draft = drafts[key];
    const current = baseline?.models ?? [];
    const selectedIds = new Set(draft.ids);
    const orderedIds = [...current.map((model) => model.id).filter((id) => selectedIds.has(id)), ...draft.ids];
    const models = candidatesFromSelection(orderedIds, current);
    const baselineModels = candidatesFromSelection(
      current.map((model) => model.id),
      current,
    );
    const baselineThinking = baseline?.thinking ?? "off";
    if (sameIdSet(models, baselineModels) && draft.thinking === baselineThinking) continue;
    updates[key] = { models, thinking: draft.thinking === "off" ? undefined : draft.thinking };
  }
  return updates;
}

const EDITOR_TAB_LABELS = [
  ...BUCK_STAGE_KEYS.map((key) => (key === "save" ? "save (models)" : key)),
  "Save",
];
const SAVE_TAB = BUCK_STAGE_KEYS.length;
const EDITOR_CHROME_ROWS = 7;
const MIN_EDITOR_WIDTH = 60;
const MIN_EDITOR_ROWS = 10;

export interface ProfileEditorHost {
  profile: string;
  scope: string;
  state: ProfileEditorState;
  baselines: Partial<Record<BuckStageKey, BuckStageConfig>>;
  ownerships: Record<BuckStageKey, string>;
  available: readonly string[];
  theme: ModelPickerTheme;
  keybindings: KeybindingsManager;
  done(outcome: ProfileEditorOutcome): void;
  requestRender(): void;
  terminalRows?(): number | undefined;
}

function cloneDrafts(drafts: ProfileDrafts): ProfileDrafts {
  const out = {} as ProfileDrafts;
  for (const key of BUCK_STAGE_KEYS) {
    out[key] = { ids: [...drafts[key].ids], thinking: drafts[key].thinking };
  }
  return out;
}

function cloneState(state: ProfileEditorState): ProfileEditorState {
  const views = {} as Record<BuckStageKey, CategoryViewState>;
  for (const key of BUCK_STAGE_KEYS) {
    views[key] = { ...state.views[key] };
  }
  return { tab: state.tab, drafts: cloneDrafts(state.drafts), views };
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

export function createProfileEditor(input: ProfileEditorHost): {
  render(width: number): string[];
  invalidate(): void;
  handleInput(data: string): void;
} {
  const state = input.state;
  let finished = false;
  let lastWidth = MIN_EDITOR_WIDTH;

  const emit = (outcome: ProfileEditorOutcome): void => {
    if (finished) return;
    finished = true;
    input.done(outcome);
  };

  const rowCapacity = (): number =>
    Math.max(3, Math.min(12, (input.terminalRows?.() ?? 24) - EDITOR_CHROME_ROWS));

  const resizeNeeded = (): boolean => {
    const rows = input.terminalRows?.();
    return lastWidth < MIN_EDITOR_WIDTH || (rows !== undefined && rows < MIN_EDITOR_ROWS);
  };

  const stageKey = (): BuckStageKey => BUCK_STAGE_KEYS[state.tab] as BuckStageKey;

  const catalogRows = (key: BuckStageKey): StageModelChoice[] =>
    fuzzyFilter(
      stageModelChoices(input.available, input.baselines[key]?.models ?? []),
      state.views[key].query,
      (row) => row.id,
    );

  const cell = (text: string, width: number): string =>
    truncateToWidth(text, width, "…", true);

  const tabStrip = (width: number): string => {
    const parts = EDITOR_TAB_LABELS.map((label, index) =>
      index === state.tab ? input.theme.bold(`[${label}]`) : ` ${label} `);
    let start = 0;
    let end = parts.length;
    const budget = width - 2;
    while (end - start > 1 && visibleWidth(parts.slice(start, end).join("")) > budget) {
      if (state.tab - start > end - 1 - state.tab) start++;
      else end--;
    }
    const prefix = start > 0 ? "‹" : "";
    const suffix = end < parts.length ? "›" : "";
    return truncateToWidth(`${prefix}${parts.slice(start, end).join("")}${suffix}`, width);
  };

  const selectedRowText = (key: BuckStageKey, index: number, focused: boolean): string => {
    const id = state.drafts[key].ids[index] as string;
    const note = input.baselines[key]?.models.find((model) => model.id === id)?.note;
    const unavailable = input.available.includes(id) ? "" : " (not on this machine)";
    const cursor = focused ? "> " : "  ";
    return `${cursor}[x] ${id}${note ? ` (${note})` : ""}${unavailable}`;
  };

  const catalogRowText = (
    key: BuckStageKey,
    row: StageModelChoice,
    index: number,
    focused: boolean,
  ): string => {
    const checked = state.drafts[key].ids.includes(row.id);
    const cursor = focused ? "> " : "  ";
    const unavailable = row.unavailable ? " (not on this machine)" : "";
    return `${cursor}[${checked ? "x" : " "}] ${row.id}${unavailable}`;
  };

  const windowStart = (cursor: number, length: number, capacity: number): number =>
    Math.max(0, Math.min(cursor - Math.floor(capacity / 2), length - capacity));

  const categoryPane = (key: BuckStageKey, width: number): string[] => {
    const view = state.views[key];
    const draft = state.drafts[key];
    const catalog = catalogRows(key);
    const leftWidth = Math.max(20, Math.floor((width - 1) / 2));
    const rightWidth = width - leftWidth - 1;
    const capacity = rowCapacity();
    const lines: string[] = [];
    const selectedMark = view.focus === "selected" ? "> " : "  ";
    const catalogMark = view.focus === "catalog" ? "> " : "  ";
    lines.push(`${cell(`${selectedMark}SELECTED (${draft.ids.length})`, leftWidth)}│${cell(`${catalogMark}CATALOG (${catalog.length}/${stageModelChoices(input.available, input.baselines[key]?.models ?? []).length})`, rightWidth)}`);
    const selectedStart = windowStart(view.selectedCursor, draft.ids.length, capacity);
    const catalogStart = windowStart(view.catalogCursor, catalog.length, capacity);
    for (let i = 0; i < capacity; i++) {
      const selectedIndex = selectedStart + i;
      const left = selectedIndex < draft.ids.length
        ? selectedRowText(key, selectedIndex, view.focus === "selected" && selectedIndex === view.selectedCursor)
        : "";
      const catalogIndex = catalogStart + i;
      let right = "";
      if (catalog.length === 0 && i === 0) {
        right = view.query ? `No models match '${view.query}'` : "(no models available)";
      } else if (catalogIndex < catalog.length) {
        right = catalogRowText(
          key,
          catalog[catalogIndex] as StageModelChoice,
          catalogIndex,
          view.focus === "catalog" && catalogIndex === view.catalogCursor,
        );
      }
      lines.push(`${cell(left, leftWidth)}│${cell(right, rightWidth)}`);
    }
    lines.push(input.theme.fg("muted", `filter: ${view.query}`));
    return lines.map((line) => truncateToWidth(line, width));
  };

  const savePane = (width: number): string[] => {
    const updates = deriveStageUpdates(state.drafts, input.baselines);
    const changed = BUCK_STAGE_KEYS.filter((key) => updates[key] !== undefined);
    const lines: string[] = [];
    if (changed.length === 0) {
      lines.push(input.theme.fg("muted", "  No deliberate edits yet"));
    } else {
      for (const key of changed) {
        const update = updates[key] as BuckStageWrite;
        lines.push(`  ${key}: ${update.models.length} model(s), thinking ${update.thinking ?? "off"}`);
      }
    }
    lines.push("");
    lines.push(input.theme.fg("accent", input.theme.bold("> [ Save ]")));
    return lines.map((line) => truncateToWidth(line, width));
  };

  const paint = (width: number): string[] => {
    lastWidth = width;
    const title = input.theme.fg("accent", input.theme.bold(
      `buck-models · ${input.profile} profile · ${input.scope} scope`));
    if (resizeNeeded()) {
      return [
        title,
        input.theme.fg("muted", "Resize to at least 60 columns x 10 rows to edit models."),
        input.theme.fg("muted", "Esc cancels without changes."),
      ].map((line) => truncateToWidth(line, width));
    }
    const onSaveTab = state.tab === SAVE_TAB;
    const help = onSaveTab
      ? "Tab/Shift+Tab tabs · Enter/Space saves · Esc cancels"
      : "Tab/Shift+Tab tabs · Left/Right columns · Up/Down rows · Space/Enter toggle · Ctrl+T thinking · Esc cancels";
    const key = onSaveTab ? undefined : stageKey();
    const meta = onSaveTab
      ? `${BUCK_STAGE_KEYS.filter((k) => deriveStageUpdates(state.drafts, input.baselines)[k] !== undefined).length} deliberate edit(s)`
      : `thinking: ${state.drafts[key as BuckStageKey].thinking} · ${input.ownerships[key as BuckStageKey]} · ${state.drafts[key as BuckStageKey].ids.length} selected`;
    const lines = [
      title,
      tabStrip(width),
      input.theme.fg("muted", help),
      input.theme.fg("muted", meta),
      "",
    ];
    if (onSaveTab) {
      lines.push(...savePane(width));
    } else {
      lines.push(...categoryPane(key as BuckStageKey, width));
    }
    return lines.map((line) => truncateToWidth(line, width));
  };

  const handleTabNav = (data: string): boolean => {
    if (matchesKey(data, "tab")) {
      state.tab = wrapIndex(state.tab + 1, EDITOR_TAB_LABELS.length);
      input.requestRender();
      return true;
    }
    if (matchesKey(data, "shift+tab")) {
      state.tab = wrapIndex(state.tab - 1, EDITOR_TAB_LABELS.length);
      input.requestRender();
      return true;
    }
    return false;
  };

  const handleThinking = (data: string): boolean => {
    if (state.tab >= SAVE_TAB || !matchesKey(data, "ctrl+t")) return false;
    emit({ kind: "thinking-request", stage: stageKey(), resume: cloneState(state) });
    return true;
  };

  const handleSaveTab = (data: string): boolean => {
    if (!input.keybindings.matches(data, "tui.select.confirm") && !matchesKey(data, "space")) {
      return false;
    }
    emit({ kind: "submit", drafts: cloneDrafts(state.drafts) });
    return true;
  };

  const handleColumnNav = (data: string): boolean => {
    const view = state.views[stageKey()];
    if (matchesKey(data, "left")) {
      view.focus = "selected";
      input.requestRender();
      return true;
    }
    if (matchesKey(data, "right")) {
      view.focus = "catalog";
      input.requestRender();
      return true;
    }
    const up = input.keybindings.matches(data, "tui.select.up");
    const down = input.keybindings.matches(data, "tui.select.down");
    if (!up && !down) return false;
    const delta = up ? -1 : 1;
    if (view.focus === "selected") {
      const length = state.drafts[stageKey()].ids.length;
      if (length > 0) view.selectedCursor = wrapIndex(view.selectedCursor + delta, length);
    } else {
      const length = catalogRows(stageKey()).length;
      if (length > 0) view.catalogCursor = wrapIndex(view.catalogCursor + delta, length);
    }
    input.requestRender();
    return true;
  };

  const handleToggle = (data: string): boolean => {
    const isToggle = matchesKey(data, "space") || input.keybindings.matches(data, "tui.select.confirm");
    if (!isToggle) return false;
    const key = stageKey();
    const view = state.views[key];
    const draft = state.drafts[key];
    if (view.focus === "selected") {
      const id = draft.ids[view.selectedCursor];
      if (id !== undefined) {
        draft.ids.splice(view.selectedCursor, 1);
        if (draft.ids.length > 0 && view.selectedCursor >= draft.ids.length) {
          view.selectedCursor = draft.ids.length - 1;
        }
        input.requestRender();
      }
    } else {
      const id = catalogRows(key)[view.catalogCursor]?.id;
      if (id !== undefined) {
        const at = draft.ids.indexOf(id);
        if (at >= 0) draft.ids.splice(at, 1);
        else draft.ids.push(id);
        input.requestRender();
      }
    }
    return true;
  };

  const handleQueryEdit = (data: string): boolean => {
    const view = state.views[stageKey()];
    if (input.keybindings.matches(data, "tui.editor.deleteCharBackward")) {
      view.query = view.query.slice(0, -1);
      view.catalogCursor = 0;
      input.requestRender();
      return true;
    }
    const printable = decodeKittyPrintable(data)
      ?? (data.length === 1 && data >= "!" && data <= "~" ? data : undefined);
    if (printable === undefined) return false;
    view.query += printable;
    view.catalogCursor = 0;
    input.requestRender();
    return true;
  };

  return {
    invalidate() {},
    render: paint,
    handleInput(data: string) {
      if (finished) return;
      if (input.keybindings.matches(data, "tui.select.cancel")) {
        emit({ kind: "cancel" });
        return;
      }
      if (resizeNeeded()) return;
      if (handleTabNav(data)) return;
      if (handleThinking(data)) return;
      if (state.tab === SAVE_TAB) {
        handleSaveTab(data);
        return;
      }
      if (handleColumnNav(data)) return;
      if (handleToggle(data)) return;
      handleQueryEdit(data);
    },
  };
}
