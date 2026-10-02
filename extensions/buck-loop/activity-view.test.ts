import { describe, it, expect } from "vitest";
import { renderActivityView, type ActivityView } from "./activity-view.js";
import { visibleWidth } from "@mariozechner/pi-tui";

const view: ActivityView = {
  state: "reviewing", skill: "b-review", attempt: 2, iteration: 3,
  usage: { input: 1200, output: 3456 }, model: "provider/current-model",
  context: { usedTokens: 42000, contextWindow: 200000, percent: 21 },
  previous: { state: "building", model: "provider/previous-model", usage: { input: 100, output: 200 } },
  visits: [], activity: ["▸ read → src/file.ts", "✓ read", "↻ retry: upstream busy", "some streamed text"],
  choices: [{ kind: "save", score: 4 }, { kind: "iterate", score: 2 }], reason: "review unclear",
};
describe("stacked activity cards", () => {
  for (const profile of ["compact", "standard", "verbose"] as const) {
    for (const width of [44, 80, 110]) {
      it(`${profile} preserves live tokens inside a closed box at ${width}`, () => {
        const lines = renderActivityView(view, profile, width, "⠙");
        expect(lines.every(line => visibleWidth(line) <= width)).toBe(true);
        expect(lines.join("\n")).toContain("4656 tokens ⠙");
        expect(lines.join("\n")).toContain(profile === "verbose" ? "ctx 42k / 200k · 21%" : profile === "standard" ? "ctx 21%" : "21%");
        expect(lines.some(line => line.startsWith("┏") && line.endsWith("┓"))).toBe(true);
        expect(lines.some(line => line.startsWith("┗") && line.endsWith("┛"))).toBe(true);
        expect(lines).toEqual(renderActivityView(view, profile, width, "⠙"));
      });
    }
  }
  it.each(["compact", "standard", "verbose"] as const)("shows only the known window after compaction in %s", profile => {
    const text = renderActivityView({ ...view, context: { usedTokens: null, contextWindow: 200000, percent: null } }, profile, 44, "⠙").join("\n");
    expect(text).toContain("ctx /200k");
    expect(text).not.toContain("0%");
    const unavailable = renderActivityView({ ...view, context: undefined }, profile, 44, "⠙").join("\n");
    expect(unavailable).not.toContain("ctx");
    expect(unavailable).not.toContain("%");
  });
  it("budgets fields by density without losing verbose tool detail", () => {
    const compact = renderActivityView(view, "compact", 80, "⠋").join("\n");
    expect(compact).not.toContain("previous-model");
    expect(compact).not.toContain("src/file.ts");
    const standard = renderActivityView(view, "standard", 80, "⠋").join("\n");
    expect(standard).toContain("previous-model");
    expect(standard).toContain("ranked, not pre-selected");
    expect(standard).not.toContain("▸ read");
    const verbose = renderActivityView(view, "verbose", 80, "⠋").join("\n");
    for (const line of view.activity) expect(verbose).toContain(line);
  });
  it("does not claim ranks or zero usage when unavailable", () => {
    const text = renderActivityView({ ...view, usage: undefined, choices: [], expectedState: "saving" }, "standard", 44, "⠋").join("\n");
    expect(text).toContain("→ saving");
    expect(text).toContain("tokens unknown ⠋");
    expect(text).not.toContain("ranked");
  });
});
