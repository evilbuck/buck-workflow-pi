/**
 * Searchable checkbox list of installed model ids for `/buck-models`.
 * Enter saves the checked set. Escape cancels. Space toggles. Typing filters.
 */
import { fuzzyFilter, truncateToWidth, type KeybindingsManager } from "@mariozechner/pi-tui";
import type { BuckModelCandidate } from "../omp-models.js";

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
    tui: { requestRender(): void },
    theme: ModelPickerTheme,
    keybindings: KeybindingsManager,
    done: (result: T) => void,
  ) => { render(width: number): string[]; invalidate(): void; handleInput?(data: string): void }) => Promise<T>;
  notify(message: string, level?: "info" | "warning" | "error"): void;
}

const MAX_VISIBLE = 12;

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

export function createModelChecklist(input: {
  title: string;
  choices: readonly StageModelChoice[];
  selected: readonly string[];
  theme: ModelPickerTheme;
  keybindings: KeybindingsManager;
  done: (result: string[] | null) => void;
  requestRender: () => void;
}): { render(width: number): string[]; invalidate(): void; handleInput(data: string): void } {
  const selected = input.selected.filter((id, index) => id && input.selected.indexOf(id) === index);
  let query = "";
  let cursor = 0;

  const visible = () => {
    const checked = new Set(selected);
    const ordered = [
      ...selected.map((id) => input.choices.find((choice) => choice.id === id)).filter((choice) => choice !== undefined),
      ...input.choices.filter((choice) => !checked.has(choice.id)),
    ];
    return fuzzyFilter(ordered, query, (choice) => choice.id);
  };

  const paint = (width: number): string[] => {
    const rows = visible();
    const lines = [
      input.theme.fg("accent", input.theme.bold(input.title)),
      input.theme.fg("muted", "Type to filter · Space toggles · Enter saves · Esc cancels"),
      input.theme.fg("muted", query ? `filter: ${query}` : "filter:"),
      "",
    ];
    if (rows.length === 0) {
      lines.push(input.theme.fg("muted", "  No matching models"));
      return lines.map((line) => truncateToWidth(line, width));
    }
    const start = Math.max(0, Math.min(cursor - Math.floor(MAX_VISIBLE / 2), rows.length - MAX_VISIBLE));
    for (const [offset, choice] of rows.slice(start, start + MAX_VISIBLE).entries()) {
      const index = start + offset;
      const mark = selected.includes(choice.id) ? "[x]" : "[ ]";
      const cursorMark = index === cursor ? ">" : " ";
      const unavailable = choice.unavailable ? " (not on this machine)" : "";
      lines.push(truncateToWidth(`${cursorMark} ${mark} ${choice.id}${unavailable}`, width));
    }
    lines.push(input.theme.fg("muted", `${selected.length} selected`));
    return lines;
  };

  const applyCursorMove = (rows: readonly { id: string }[], delta: 1 | -1): boolean => {
    if (rows.length === 0) return false;
    cursor = delta === -1
      ? (cursor === 0 ? rows.length - 1 : cursor - 1)
      : (cursor === rows.length - 1 ? 0 : cursor + 1);
    return true;
  };

  const toggleAtCursor = (rows: readonly { id: string }[]): boolean => {
    const id = rows[cursor]?.id;
    if (id === undefined) return false;
    const index = selected.indexOf(id);
    if (index >= 0) selected.splice(index, 1);
    else selected.push(id);
    return true;
  };

  const applyQueryEdit = (data: string): boolean => {
    if (input.keybindings.matches(data, "tui.editor.deleteCharBackward")) {
      query = query.slice(0, -1);
      cursor = 0;
      return true;
    }
    if (data.length === 1 && data >= "!" && data <= "~") {
      query += data;
      cursor = 0;
      return true;
    }
    return false;
  };

  return {
    invalidate() {},
    render: paint,
    handleInput(data: string) {
      const rows = visible();
      if (input.keybindings.matches(data, "tui.select.cancel")) {
        input.done(null);
        return;
      }
      if (input.keybindings.matches(data, "tui.select.confirm")) {
        input.done([...selected]);
        return;
      }
      const up = input.keybindings.matches(data, "tui.select.up");
      const down = input.keybindings.matches(data, "tui.select.down");
      if ((up || down) && applyCursorMove(rows, up ? -1 : 1)) {
        input.requestRender();
      } else if (data === " " && toggleAtCursor(rows)) {
        input.requestRender();
      } else if (applyQueryEdit(data)) {
        input.requestRender();
      }
    },
  };
}

export async function pickStageModels(
  ui: ModelPickerHost,
  title: string,
  choices: readonly StageModelChoice[],
  selected: readonly string[],
): Promise<string[] | null> {
  if (choices.length === 0) {
    ui.notify("No installed models to choose, and this stage has no saved ids.", "error");
    return null;
  }
  if (!ui.custom) {
    ui.notify("/buck-models needs a checklist picker. This host UI cannot show one.", "error");
    return null;
  }
  return ui.custom((tui, theme, keybindings, done) => createModelChecklist({
    title,
    choices,
    selected,
    theme,
    keybindings,
    done,
    requestRender: () => tui.requestRender(),
  }));
}
