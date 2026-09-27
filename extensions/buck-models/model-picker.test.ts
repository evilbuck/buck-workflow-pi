import { KeybindingsManager, TUI_KEYBINDINGS } from "@mariozechner/pi-tui";
import { describe, expect, it } from "vitest";
import {
  candidatesFromSelection,
  createModelChecklist,
  stageModelChoices,
} from "./model-picker.js";

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

function checklist(choices: Array<{ id: string; unavailable?: boolean }>, selected: string[] = []) {
  const keybindings = new KeybindingsManager(TUI_KEYBINDINGS);
  let result: string[] | null | undefined;
  const component = createModelChecklist({
    title: "Models for build",
    choices: choices.map((choice) => ({ id: choice.id, unavailable: choice.unavailable ?? false })),
    selected,
    theme,
    keybindings,
    done: (value) => {
      result = value;
    },
    requestRender: () => {},
  });
  return { component, keybindings, result: () => result };
}

describe("stage model checklist", () => {
  it("lists saved ids first, including ones missing from this machine, then installed ids", () => {
    expect(stageModelChoices(
      ["zai/glm-5.3", "openai-codex/gpt-5.6-terra", "zai/glm-5.3"],
      [{ id: "portable/other", note: "keep" }, { id: "zai/glm-5.3" }],
    )).toEqual([
      { id: "portable/other", unavailable: true },
      { id: "zai/glm-5.3", unavailable: false },
      { id: "openai-codex/gpt-5.6-terra", unavailable: false },
    ]);
  });

  it("keeps notes for ids that stay checked and appends newly checked ids without notes", () => {
    expect(candidatesFromSelection(
      ["provider/original", "provider/new", "provider/original"],
      [{ id: "provider/original", note: "fast, cheap" }, { id: "provider/dropped" }],
    )).toEqual([
      { id: "provider/original", note: "fast, cheap" },
      { id: "provider/new" },
    ]);
  });

  it("filters by typed text, toggles with space, saves with enter, and cancels with escape", () => {
    const picker = checklist([
      { id: "zai/glm-5.3" },
      { id: "openai-codex/gpt-5.6-terra" },
      { id: "anthropic/claude-sonnet-5" },
    ], ["openai-codex/gpt-5.6-terra"]);

    picker.component.handleInput("g");
    picker.component.handleInput("l");
    picker.component.handleInput("m");
    expect(picker.component.render(80).join("\n")).toContain("zai/glm-5.3");
    expect(picker.component.render(80).join("\n")).not.toContain("gpt-5.6-terra");
    picker.component.handleInput(" ");
    picker.component.handleInput("\r");
    expect(picker.result()).toEqual(["openai-codex/gpt-5.6-terra", "zai/glm-5.3"]);

    const cancelled = checklist([{ id: "zai/glm-5.3" }], ["zai/glm-5.3"]);
    cancelled.component.handleInput("\x1b");
    expect(cancelled.result()).toBeNull();
  });
});
