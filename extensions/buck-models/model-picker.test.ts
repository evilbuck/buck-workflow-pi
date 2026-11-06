import { KeybindingsManager, TUI_KEYBINDINGS, visibleWidth } from "@mariozechner/pi-tui";
import { describe, expect, it } from "vitest";
import { BUCK_STAGE_KEYS, type BuckStageConfig, type BuckStageKey, type BuckThinking } from "../omp-models.js";
import {
  candidatesFromSelection,
  createProfileEditor,
  deriveStageUpdates,
  type ProfileEditorOutcome,
  seedProfileEditorState,
  stageModelChoices,
} from "./model-picker.js";

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

describe("stage model choices and candidates", () => {
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
});

function cfg(
  models: Array<string | [string, string | undefined]>,
  thinking: BuckThinking = "off",
): BuckStageConfig {
  return {
    models: models.map((m) => (typeof m === "string" ? { id: m } : { id: m[0], note: m[1] })),
    thinking,
  };
}

describe("seedProfileEditorState", () => {
  it("seeds deduped drafts, thinking defaults, and neutral per-category views", () => {
    const baselines: Partial<Record<BuckStageKey, BuckStageConfig>> = {
      build: cfg([["provider/original", "keep me"], "provider/duplicate", "provider/original"], "high"),
      review: cfg(["provider/reviewer"]),
    };
    const state = seedProfileEditorState(baselines);

    expect(state.tab).toBe(0);
    expect(state.drafts.build.ids).toEqual(["provider/original", "provider/duplicate"]);
    expect(state.drafts.build.thinking).toBe("high");
    expect(state.drafts.review.thinking).toBe("off");
    expect(state.drafts.review.ids).toEqual(["provider/reviewer"]);
    expect(state.drafts["brainstorm-plan"].ids).toEqual([]);
    for (const key of BUCK_STAGE_KEYS) {
      expect(state.views[key]).toEqual({ focus: "catalog", selectedCursor: 0, catalogCursor: 0, query: "" });
    }
  });

  it("copies baseline ids so draft edits never mutate the baseline", () => {
    const baselines: Partial<Record<BuckStageKey, BuckStageConfig>> = { build: cfg(["a", "b"]) };
    const state = seedProfileEditorState(baselines);
    state.drafts.build.ids.push("c");
    expect(baselines.build!.models.map((m) => m.id)).toEqual(["a", "b"]);
  });
});

describe("deriveStageUpdates", () => {
  const baselines: Partial<Record<BuckStageKey, BuckStageConfig>> = {
    build: cfg([["provider/a", "keep me"], "provider/dropped"], "high"),
    review: cfg(["provider/reviewer"]),
  };

  function draftsFor(overrides: Partial<Record<BuckStageKey, { ids: string[]; thinking: BuckThinking }>>) {
    return { ...seedProfileEditorState(baselines).drafts, ...overrides };
  }

  it("omits untouched categories", () => {
    expect(deriveStageUpdates(draftsFor({}), baselines)).toEqual({});
  });

  it("omits a net-no-op remove-then-readd even when order changed", () => {
    const drafts = draftsFor({ build: { ids: ["provider/dropped", "provider/a"], thinking: "high" } });
    expect(deriveStageUpdates(drafts, baselines)).toEqual({});
  });

  it("preserves baseline order after reselecting a model and changing thinking", () => {
    const drafts = draftsFor({
      build: { ids: ["provider/dropped", "provider/new", "provider/a"], thinking: "low" },
    });
    expect(deriveStageUpdates(drafts, baselines).build).toEqual({
      models: [
        { id: "provider/a", note: "keep me" },
        { id: "provider/dropped" },
        { id: "provider/new" },
      ],
      thinking: "low",
    });
  });

  it("writes a changed stage preserving retained notes/order and appending new models", () => {
    const drafts = draftsFor({ build: { ids: ["provider/a", "provider/new"], thinking: "high" } });
    const updates = deriveStageUpdates(drafts, baselines);
    expect(updates.build!.models).toEqual([
      { id: "provider/a", note: "keep me" },
      { id: "provider/new" },
    ]);
    expect(updates.build!.thinking).toBe("high");
    expect(Object.keys(updates)).toEqual(["build"]);
  });

  it("persists an explicit empty override when a populated stage is cleared", () => {
    const drafts = draftsFor({ build: { ids: [], thinking: "high" } });
    const updates = deriveStageUpdates(drafts, baselines);
    expect(updates.build!.models).toEqual([]);
    expect(updates.build!.thinking).toBe("high");
    expect(updates.review).toBeUndefined();
  });

  it("omits unset stages when their draft stays empty", () => {
    const drafts = draftsFor({ commit: { ids: [], thinking: "off" } });
    expect(deriveStageUpdates(drafts, baselines)).toEqual({});
  });

  it("writes thinking-only changes and drops off thinking from the write", () => {
    const cleared = deriveStageUpdates(
      draftsFor({ build: { ids: ["provider/a", "provider/dropped"], thinking: "off" } }),
      baselines,
    );
    expect(cleared.build!.models).toEqual([{ id: "provider/a", note: "keep me" }, { id: "provider/dropped" }]);
    expect(cleared.build!.thinking).toBeUndefined();

    const raised = deriveStageUpdates(
      draftsFor({ review: { ids: ["provider/reviewer"], thinking: "high" } }),
      baselines,
    );
    expect(raised.review!.models).toEqual([{ id: "provider/reviewer" }]);
    expect(raised.review!.thinking).toBe("high");
  });

  it("does not mutate drafts or baselines", () => {
    const drafts = draftsFor({ build: { ids: ["provider/a", "provider/new"], thinking: "low" } });
    const baselineSnapshot = JSON.stringify(baselines);
    const draftsSnapshot = JSON.stringify(drafts);
    deriveStageUpdates(drafts, baselines);
    expect(JSON.stringify(baselines)).toBe(baselineSnapshot);
    expect(JSON.stringify(drafts)).toBe(draftsSnapshot);
  });
});

const KEY = {
  tab: "\t",
  shiftTab: "\x1b[Z",
  enter: "\r",
  space: " ",
  esc: "\x1b",
  backspace: "\x7f",
  up: "\x1b[A",
  down: "\x1b[B",
  right: "\x1b[C",
  left: "\x1b[D",
  ctrlT: "\x14",
} as const;

function makeEditor(overrides: {
  baselines?: Partial<Record<BuckStageKey, BuckStageConfig>>;
  ownerships?: Partial<Record<BuckStageKey, string>>;
  available?: string[];
  terminalRows?: () => number | undefined;
} = {}) {
  const baselines = overrides.baselines ?? {};
  const outcomes: ProfileEditorOutcome[] = [];
  const state = seedProfileEditorState(baselines);
  const ownerships = Object.fromEntries(
    BUCK_STAGE_KEYS.map((key) => [key, overrides.ownerships?.[key] ?? "unset"]),
  ) as Record<BuckStageKey, string>;
  const component = createProfileEditor({
    profile: "work",
    scope: "project",
    state,
    baselines,
    ownerships,
    available: overrides.available ?? ["openai/gpt", "anthropic/claude"],
    theme,
    keybindings: new KeybindingsManager(TUI_KEYBINDINGS),
    done: (outcome) => {
      outcomes.push(outcome);
    },
    requestRender: () => {},
    terminalRows: overrides.terminalRows,
  });
  return { component, outcomes, state };
}

describe("createProfileEditor", () => {
  it("filters the catalog by typed text and treats t as a filter character", () => {
    const e = makeEditor({ available: ["tmod/one", "twomod/two", "aa/bb"] });
    expect(e.component.render(80).join("\n")).toContain("aa/bb");
    e.component.handleInput("t");
    expect(e.outcomes).toEqual([]);
    expect(e.state.views["brainstorm-plan"].query).toBe("t");
    e.component.handleInput("w");
    e.component.handleInput("o");
    const view = e.component.render(80).join("\n");
    expect(view).toContain("twomod/two");
    expect(view).not.toContain("tmod/one");
    expect(view).not.toContain("aa/bb");
  });

  it("emits a thinking request with an intact resume state on Ctrl+T", () => {
    const e = makeEditor({ available: ["claude/one", "claude/two"] });
    e.component.handleInput("c");
    e.component.handleInput(KEY.down);
    e.component.handleInput(KEY.ctrlT);
    expect(e.outcomes).toHaveLength(1);
    const outcome = e.outcomes[0]!;
    expect(outcome.kind).toBe("thinking-request");
    if (outcome.kind !== "thinking-request") throw new Error("unreachable");
    expect(outcome.stage).toBe("brainstorm-plan");
    expect(outcome.resume.views["brainstorm-plan"]).toEqual({
      focus: "catalog",
      selectedCursor: 0,
      catalogCursor: 1,
      query: "c",
    });
    expect(outcome.resume.drafts["brainstorm-plan"]).toEqual({ ids: [], thinking: "off" });
    expect(outcome.resume).toEqual(e.state);
  });

  it("wraps tab navigation across all thirteen tabs and keeps per-tab state isolated", () => {
    const e = makeEditor({ available: ["openai/gpt"] });
    e.component.handleInput("g");
    e.component.handleInput(KEY.space);
    expect(e.state.drafts["brainstorm-plan"].ids).toEqual(["openai/gpt"]);
    e.component.handleInput(KEY.shiftTab);
    expect(e.state.tab).toBe(12);
    e.component.handleInput(KEY.tab);
    expect(e.state.tab).toBe(0);
    expect(e.state.views["brainstorm-plan"].query).toBe("g");
    e.component.handleInput(KEY.tab);
    expect(e.state.tab).toBe(1);
    expect(e.state.views["phase"].query).toBe("");
    expect(e.state.drafts["phase"].ids).toEqual([]);
  });

  it("moves column focus with Left/Right and wraps cursors with Up/Down", () => {
    const e = makeEditor({ available: ["a/1", "b/2", "c/3"] });
    expect(e.component.render(80).join("\n")).toMatch(/> CATALOG/);
    e.component.handleInput(KEY.left);
    expect(e.state.views["brainstorm-plan"].focus).toBe("selected");
    expect(e.component.render(80).join("\n")).toMatch(/> SELECTED/);
    e.component.handleInput(KEY.up);
    expect(e.state.views["brainstorm-plan"].selectedCursor).toBe(0);
    e.component.handleInput(KEY.right);
    e.component.handleInput(KEY.up);
    expect(e.state.views["brainstorm-plan"].catalogCursor).toBe(2);
    e.component.handleInput(KEY.down);
    expect(e.state.views["brainstorm-plan"].catalogCursor).toBe(0);
  });

  it("toggles with Space/Enter, prevents duplicates, appends new ids, and removes from the selected column", () => {
    const baselines = { build: cfg(["openai/gpt"]) };
    const e = makeEditor({ baselines, available: ["openai/gpt", "anthropic/claude"] });
    for (let i = 0; i < 2; i++) e.component.handleInput(KEY.tab);
    expect(e.state.tab).toBe(2);
    e.component.handleInput(KEY.space);
    expect(e.state.drafts.build.ids).toEqual([]);
    e.component.handleInput(KEY.space);
    expect(e.state.drafts.build.ids).toEqual(["openai/gpt"]);
    e.component.handleInput(KEY.down);
    e.component.handleInput(KEY.enter);
    expect(e.state.drafts.build.ids).toEqual(["openai/gpt", "anthropic/claude"]);
    e.component.handleInput(KEY.up);
    e.component.handleInput(KEY.space);
    e.component.handleInput(KEY.space);
    expect(e.state.drafts.build.ids).toEqual(["anthropic/claude", "openai/gpt"]);
    e.component.handleInput(KEY.left);
    e.component.handleInput(KEY.space);
    expect(e.state.drafts.build.ids).toEqual(["openai/gpt"]);
  });

  it("keeps the selected column visible regardless of the filter", () => {
    const baselines = { build: cfg(["openai/gpt"]) };
    const e = makeEditor({ baselines, available: ["anthropic/claude"] });
    for (let i = 0; i < 2; i++) e.component.handleInput(KEY.tab);
    e.component.handleInput("c");
    e.component.handleInput("l");
    const view = e.component.render(80).join("\n");
    expect(view).toContain("openai/gpt");
    expect(view).toContain("anthropic/claude");
  });

  it("marks unavailable saved ids and lets the engineer remove them", () => {
    const baselines = { build: cfg(["gone/model"]) };
    const e = makeEditor({ baselines, available: ["openai/gpt"] });
    for (let i = 0; i < 2; i++) e.component.handleInput(KEY.tab);
    expect(e.component.render(80).join("\n")).toContain("gone/model (not on this machine)");
    e.component.handleInput(KEY.left);
    e.component.handleInput(KEY.space);
    expect(e.state.drafts.build.ids).toEqual([]);
  });

  it("stays navigable with an empty catalog and with zero filter matches", () => {
    const e = makeEditor({ available: [] });
    expect(e.component.render(80).join("\n")).toMatch(/no models/i);
    e.component.handleInput(KEY.space);
    e.component.handleInput(KEY.up);
    e.component.handleInput(KEY.down);
    e.component.handleInput(KEY.enter);
    expect(e.outcomes).toEqual([]);
    const e2 = makeEditor({ available: ["a/1"] });
    e2.component.handleInput("z");
    e2.component.handleInput("z");
    expect(e2.component.render(80).join("\n")).toMatch(/no models/i);
    e2.component.handleInput(KEY.backspace);
    expect(e2.state.views["brainstorm-plan"].query).toBe("z");
  });

  it("submits drafts from the Save tab on Enter and Space and stays navigable", () => {
    const baselines = { "brainstorm-plan": cfg([["openai/gpt", "fast"]]) };
    const e = makeEditor({ baselines, available: ["openai/gpt", "anthropic/claude"] });
    e.component.handleInput(KEY.down);
    e.component.handleInput(KEY.space);
    e.component.handleInput(KEY.shiftTab);
    expect(e.state.tab).toBe(12);
    expect(e.component.render(80).join("\n")).toContain("brainstorm-plan");
    e.component.handleInput(KEY.tab);
    expect(e.state.tab).toBe(0);
    e.component.handleInput(KEY.shiftTab);
    e.component.handleInput(KEY.enter);
    expect(e.outcomes).toHaveLength(1);
    const outcome = e.outcomes[0]!;
    expect(outcome.kind).toBe("submit");
    if (outcome.kind !== "submit") throw new Error("unreachable");
    expect(outcome.drafts["brainstorm-plan"]).toEqual({
      ids: ["openai/gpt", "anthropic/claude"],
      thinking: "off",
    });
    expect(Object.keys(outcome.drafts).sort()).toEqual([...BUCK_STAGE_KEYS].sort());

    const e2 = makeEditor();
    e2.component.handleInput(KEY.shiftTab);
    e2.component.handleInput(KEY.space);
    expect(e2.outcomes.map((o) => o.kind)).toEqual(["submit"]);
  });

  it("cancels with Esc from category tabs and from the Save tab exactly once", () => {
    const e = makeEditor();
    e.component.handleInput(KEY.esc);
    e.component.handleInput(KEY.esc);
    expect(e.outcomes).toEqual([{ kind: "cancel" }]);
    const e2 = makeEditor();
    e2.component.handleInput(KEY.shiftTab);
    e2.component.handleInput(KEY.esc);
    expect(e2.outcomes).toEqual([{ kind: "cancel" }]);
  });

  it("shows a resize-needed view at tiny sizes where only Esc works", () => {
    const e = makeEditor();
    const view = e.component.render(40);
    expect(view.join("\n")).toMatch(/resize/i);
    expect(view.join("\n")).toContain("Esc cancels without changes");
    for (const line of view) expect(visibleWidth(line)).toBeLessThanOrEqual(40);
    e.component.handleInput(KEY.tab);
    e.component.handleInput("x");
    e.component.handleInput(KEY.up);
    expect(e.state.tab).toBe(0);
    expect(e.state.views["brainstorm-plan"].query).toBe("");
    e.component.handleInput(KEY.esc);
    expect(e.outcomes).toEqual([{ kind: "cancel" }]);
  });

  it("uses the resize view when the terminal is too short", () => {
    const e = makeEditor({ terminalRows: () => 8 });
    expect(e.component.render(80).join("\n")).toMatch(/resize/i);
  });

  it("keeps the Save control and every line inside the terminal at every supported height", () => {
    let rows = 24;
    const e = makeEditor({ terminalRows: () => rows, available: ["openai/gpt"] });
    for (const key of BUCK_STAGE_KEYS) e.state.drafts[key].ids = ["openai/gpt"];
    e.component.handleInput(KEY.shiftTab);
    expect(e.state.tab).toBe(12);
    for (const height of [40, 24, 20, 18, 17, 16, 12, 10]) {
      rows = height;
      const lines = e.component.render(80);
      expect(lines.length).toBeLessThanOrEqual(height);
      expect(lines.join("\n")).toContain("[ Save ]");
    }
    rows = 10;
    e.component.handleInput(KEY.shiftTab);
    expect(e.state.tab).toBe(11);
    const category = e.component.render(80);
    expect(category.length).toBeLessThanOrEqual(10);
    expect(category.join("\n")).toContain("filter: ");

    e.component.handleInput(KEY.tab);
    expect(e.state.tab).toBe(12);
    const tight = e.component.render(80);
    expect(tight).toHaveLength(10);
    expect(tight[4]).toContain("[ Save ]");
    expect(tight.join("\n")).toContain("+8 more edit(s)");
  });

  it("clamps the selected cursor when a catalog toggle removes an earlier model", () => {
    const baselines = { build: cfg(["aaa/one", "bbb/two"]) };
    const e = makeEditor({ baselines, available: ["aaa/one", "bbb/two"] });
    for (let i = 0; i < 2; i++) e.component.handleInput(KEY.tab);
    e.component.handleInput(KEY.left);
    e.component.handleInput(KEY.down);
    expect(e.state.views.build.selectedCursor).toBe(1);
    e.component.handleInput(KEY.right);
    e.component.handleInput(KEY.space);
    expect(e.state.drafts.build.ids).toEqual(["bbb/two"]);
    expect(e.state.views.build.selectedCursor).toBe(0);
    e.component.handleInput(KEY.left);
    expect(e.component.render(80).join("\n")).toMatch(/> \[x\] bbb\/two/);
    e.component.handleInput(KEY.space);
    expect(e.state.drafts.build.ids).toEqual([]);
  });

  it("keeps every rendered line within width and the active tab visible when the strip scrolls", () => {
    const e = makeEditor({ available: ["openai/gpt", "anthropic/claude"] });
    for (const width of [120, 80, 60]) {
      for (const line of e.component.render(width)) {
        expect(visibleWidth(line)).toBeLessThanOrEqual(width);
      }
    }
    for (let i = 0; i < 11; i++) e.component.handleInput(KEY.tab);
    expect(e.state.tab).toBe(11);
    const view = e.component.render(60);
    expect(view.join("\n")).toContain("present");
    expect(view.join("\n")).toContain("‹");
    for (const line of view) expect(visibleWidth(line)).toBeLessThanOrEqual(60);
    e.component.handleInput(KEY.tab);
    e.component.handleInput(KEY.tab);
    expect(e.state.tab).toBe(0);
    expect(e.component.render(60).join("\n")).toContain("›");
  });

  it("shows ownership and thinking state on a category tab", () => {
    const baselines = { build: cfg(["openai/gpt"], "high") };
    const e = makeEditor({ baselines, ownerships: { build: "user-global fallthrough" } });
    for (let i = 0; i < 2; i++) e.component.handleInput(KEY.tab);
    const view = e.component.render(80).join("\n");
    expect(view).toContain("thinking: high");
    expect(view).toContain("user-global fallthrough");
  });
});
