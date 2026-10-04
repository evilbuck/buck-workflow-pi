import { afterEach, describe, expect, it, vi } from "vitest";
import { createActivityCard } from "./activity-widget.js";
import { parseArgs } from "./index.js";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { TUI, ProcessTerminal, type Component } from "@mariozechner/pi-tui";
import type { Snapshot } from "./types.js";
import { handleLoop } from "./loop.js";
import { cleanupRepos, git, repo, writeTree } from "./__tests__/fixtures.js";
const snapshot: Snapshot = {
  state: "building", subject: "demo", planPath: "plan.md", phasePath: "phase.md", planFacts: { kind: "phased-incomplete" },
  workFacts: { sessionOutcome: "ok", retriesUsed: 0, postcondition: "confirmed" }, reviewFacts: { kind: "pending" },
  loopCount: 1, maxLoops: 12, iterateCyclesOnPhase: 2, lastChoice: null, history: [],
};

function harness() {
  const tui = new TUI(new ProcessTerminal());
  const repaint = vi.spyOn(tui, "requestRender").mockImplementation(() => {});
  let component: (Component & { dispose?(): void }) | undefined;
  const setWidget: ExtensionContext["ui"]["setWidget"] = (_key, content) => {
    if (typeof content === "function") component = content(tui, {} as never);
    else if (content === undefined) component?.dispose?.();
  };
  const card = createActivityCard({ setWidget, notify: vi.fn() }, "standard");
  return { card, repaint, render: (width = 80) => component!.render(width).join("\n"), disposeHost: () => component?.dispose?.() };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); cleanupRepos(); });
describe("live card", () => {
  it("updates child occupancy independently of work tokens and clears it for each child", () => {
    const h = harness();
    h.card.snapshot(snapshot);
    h.card.context({ tokens: 42000, contextWindow: 200000, percent: 21 });
    expect(h.render(44)).toContain("ctx 21%");
    h.card.context({ tokens: 60000, contextWindow: 200000, percent: 30 });
    expect(h.render(44)).toContain("ctx 30%");
    expect(h.render(44)).not.toContain("ctx 21%");
    h.card.context({ tokens: null, contextWindow: 200000, percent: null });
    expect(h.render(44)).toContain("ctx /200k");
    expect(h.render(44)).not.toContain("0%");
    h.card.session({ type: "session_start", skill: "b-review" }, "child/model");
    expect(h.render(44)).not.toContain("ctx");
    h.card.context({ tokens: 1000, contextWindow: 100000, percent: 1 });
    h.card.snapshot({ ...snapshot, state: "reviewing" });
    expect(h.render(44)).not.toContain("ctx");
    h.card.context(undefined);
    expect(h.render(44)).not.toContain("%");
    h.card.dispose();
  });
  it("keeps visit model/cost across transitions and switches density", () => {
    const h = harness();
    h.card.snapshot({ ...snapshot, workFacts: { ...snapshot.workFacts, sessionOutcome: "pending" } });
    h.card.session({ type: "message_end", message: { role: "assistant", usage: { input: 10, output: 20 } } }, "provider/build-model");
    h.card.snapshot({ ...snapshot, state: "reviewing" });
    expect(h.render()).toContain("provider/build-model · 30 tokens");
    h.card.setProfile("compact");
    expect(h.render(44)).not.toContain("build-model");
    h.card.setProfile("verbose");
    expect(h.render()).toContain("I 10 / O 20");
    h.card.dispose();
  });
  it("animates and stops all repaint after disposal, including late events", () => {
    vi.useFakeTimers();
    const h = harness();
    const first = h.render();
    vi.advanceTimersByTime(160);
    expect(h.render()).not.toBe(first);
    h.card.dispose();
    const calls = h.repaint.mock.calls.length;
    vi.advanceTimersByTime(2000);
    h.card.ingest({ kind: "text", delta: "late event" });
    h.card.snapshot(snapshot);
    expect(h.repaint.mock.calls.length).toBe(calls);
    expect(h.render()).toBe("");
  });
  it("stops the loader and ignores late events when the host removes the component", () => {
    vi.useFakeTimers();
    const h = harness();
    h.disposeHost();
    const calls = h.repaint.mock.calls.length;
    vi.advanceTimersByTime(2000);
    h.card.session({ type: "session_start", skill: "b-build-hard" }, "late-model");
    h.card.ingest({ kind: "text", delta: "late event" });
    expect(h.repaint.mock.calls.length).toBe(calls);
    expect(h.render()).toBe("");
  });
  it("archives review cost before a chooser-selected skill starts inline", async () => {
    vi.stubEnv("SQL_MEMORY_URL", "");
    const cwd = repo("card-inline-choice-");
    const plan = ".context/2026-10-02.card-test/plan-card.md";
    writeTree(cwd, { [plan]: "---\nstatus: active\n---\n# Card test\n" });
    git(cwd, ["add", "."]);
    git(cwd, ["commit", "-qm", "fixture"]);
    const h = harness();
    const documenting: string[] = [];
    const result = await handleLoop({
      cwd, command: "start", path: plan,
      deps: {
        onSnapshot: value => h.card.snapshot(value),
        onSessionEvent: (event, model) => h.card.session(event, model),
        runStep: async opts => {
          const usage = opts.skill === "b-docs" ? { input: 5, output: 6 } : { input: 10, output: 20 };
          opts.onSessionEvent?.({ type: "session_start", skill: opts.skill }, `test/${opts.skill}`);
          opts.onSessionEvent?.({ type: "message_end", message: { role: "assistant", usage } }, `test/${opts.skill}`);
          if (opts.skill === "b-docs") {
            documenting.push(h.render());
            return { ok: false, text: "Fixture documentation failure" };
          }
          return { ok: true, text: opts.skill === "b-review" ? "# Review\nSomething went wrong.\n" : "Built" };
        },
        choose: async () => ({ status: "accepted", accepted: { choice: { kind: "document" }, reason: "Fixture choice" } }),
      },
    });
    h.card.dispose();
    expect(documenting[0]).toContain("CURRENT documenting");
    expect(documenting[0]).toContain("PREVIOUS reviewing · test/b-review · 30 tokens");
    expect(documenting[0]).toContain("11 tokens");
    expect(result.state).toBe("blocked");
  });
  it("accepts all runtime profiles and rejects ambiguous profile commands", () => {
    for (const profile of ["compact", "standard", "verbose"]) expect(parseArgs(`--profile ${profile}`)).toEqual({ ok: true, command: "profile", profile });
    expect(parseArgs("--profile dense").ok).toBe(false);
    expect(parseArgs("--profile compact --resume").ok).toBe(false);
  });

  it("renders every activity event kind, with and without a target or message", () => {
    const h = harness();
    h.card.setProfile("verbose");
    h.card.snapshot(snapshot);
    h.card.ingest({ kind: "text", delta: "first line " });
    // A second text delta must join the open line rather than start a new one.
    h.card.ingest({ kind: "text", delta: "continued" });
    h.card.ingest({ kind: "toolStart", tool: "read", target: "file.ts" });
    h.card.ingest({ kind: "toolStart", tool: "grep" });
    h.card.ingest({ kind: "toolEnd", tool: "read", ok: true, message: "ok" });
    h.card.ingest({ kind: "toolEnd", tool: "grep", ok: false });
    h.card.ingest({ kind: "retry", message: "transient" });
    h.card.ingest({ kind: "complete", ok: true });
    h.card.ingest({ kind: "complete", ok: false, message: "blocked" });
    const rendered = h.render(120);
    expect(rendered).toContain("first line continued");
    expect(rendered).toContain("▸ read → file.ts");
    expect(rendered).toContain("▸ grep");
    expect(rendered).toContain("✓ read: ok");
    expect(rendered).toContain("✗ grep");
    expect(rendered).toContain("↻ retry: transient");
    expect(rendered).toContain("✓ buck-loop");
    expect(rendered).toContain("✗ buck-loop: blocked");
    h.card.dispose();
  });

  it("replaces a rank error line and clears the open text run on decision", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const h = harness();
    h.card.snapshot(snapshot);
    await h.card.decision({ ...snapshot, workFacts: { ...snapshot.workFacts, postcondition: "ambiguous" } });
    // Without a judge key the ranking cannot run; the card must still show why.
    expect(h.render(120)).toMatch(/Jev display ranking/);
    h.card.dispose();
  });

  it("notifies the operator on success and failure without rendering", () => {
    const notify = vi.fn();
    const tui = new TUI(new ProcessTerminal());
    vi.spyOn(tui, "requestRender").mockImplementation(() => {});
    const card = createActivityCard({ setWidget: () => {}, notify }, "standard");
    card.succeed("finished");
    card.fail("blocked");
    expect(notify).toHaveBeenCalledWith("buck-loop: finished", "info");
    expect(notify).toHaveBeenCalledWith("buck-loop: blocked", "warning");
    card.dispose();
    // Disposal is idempotent: a second call must not re-notify the host.
    expect(() => card.dispose()).not.toThrow();
  });

  it("tolerates a session event that is not an object", () => {
    const h = harness();
    h.card.session(null, "some/model");
    h.card.session("not-an-object", "other/model");
    h.card.session({ type: "session_start" }, "third/model");
    expect(h.render(120)).toContain("third/model");
    h.card.dispose();
  });
});
