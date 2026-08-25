import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, existsSync, rmSync, writeFileSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import buckWorkflowExtension from "./index.js";
import { wire, findPlanExit, slugFromPlanUrl, withFrontmatter } from "./plan-artifact.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const TEST_ROOT = join("/tmp", "plan-artifact-test-" + process.pid);

/** Real entry shapes as OMP writes them (see session .jsonl files). */
function modeChange(id: string, mode: string, data?: Record<string, unknown>) {
  return { type: "mode_change", id, parentId: "p", timestamp: "2026-08-25T00:00:00.000Z", mode, data };
}

function markerEntry(exitId: string) {
  return { type: "custom", customType: "plan-artifact", data: { exitId, target: "/x", subject: "s" } };
}

function createMockPi() {
  const handlers = new Map<string, Array<(event: unknown, ctx: unknown) => Promise<void> | void>>();
  const pi = {
    on: vi.fn((event: string, handler: (event: unknown, ctx: unknown) => Promise<void> | void) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    }),
    appendEntry: vi.fn(),
  } as unknown as ExtensionAPI;
  wire(pi);
  return { pi, handlers };
}

function createMockCtx(cwd: string, artifactsDir: string | null) {
  return {
    cwd,
    hasUI: true,
    ui: { notify: vi.fn(), theme: { fg: (_k: string, t: string) => t } },
    sessionManager: {
      getEntries: vi.fn(() => [] as unknown[]),
      getArtifactsDir: vi.fn(() => artifactsDir),
    },
  };
}

async function fireTurnEnd(handlers: Map<string, Array<(event: unknown, ctx: unknown) => Promise<void> | void>>, ctx: unknown) {
  for (const handler of handlers.get("turn_end") ?? []) {
    await handler({ type: "turn_end" }, ctx);
  }
}

describe("findPlanExit", () => {
  it("finds a plan→none transition with its planFilePath", () => {
    const entries = [
      modeChange("e1", "plan", { planFilePath: "local://feature-x-plan.md" }),
      modeChange("e2", "none"),
    ];
    expect(findPlanExit(entries)).toEqual({ exitId: "e2", planFilePath: "local://feature-x-plan.md" });
  });

  it("accepts plan_paused interleaves before the exit", () => {
    const entries = [
      modeChange("e1", "plan", { planFilePath: "local://PLAN.md" }),
      modeChange("e2", "plan_paused"),
      modeChange("e3", "none"),
    ];
    expect(findPlanExit(entries)).toEqual({ exitId: "e3", planFilePath: "local://PLAN.md" });
  });

  it("rejects an exit entered from a different mode", () => {
    const entries = [
      modeChange("e1", "plan", { planFilePath: "local://x-plan.md" }),
      modeChange("e2", "goal", { goal: {} }),
      modeChange("e3", "none"),
    ];
    expect(findPlanExit(entries)).toBeNull();
  });

  it("returns null with no mode entries or no planFilePath", () => {
    expect(findPlanExit([])).toBeNull();
    expect(findPlanExit([modeChange("e1", "none")])).toBeNull();
    expect(findPlanExit([modeChange("e1", "plan"), modeChange("e2", "none")])).toBeNull();
  });

  it("uses the latest plan entry when plan mode ran twice", () => {
    const entries = [
      modeChange("e1", "plan", { planFilePath: "local://first-plan.md" }),
      modeChange("e2", "none"),
      modeChange("e3", "plan", { planFilePath: "local://second-plan.md" }),
      modeChange("e4", "none"),
    ];
    expect(findPlanExit(entries)).toEqual({ exitId: "e4", planFilePath: "local://second-plan.md" });
  });
});

describe("slugFromPlanUrl", () => {
  it("strips local://, .md, and a trailing -plan segment", () => {
    expect(slugFromPlanUrl("local://production-feedback-form-plan.md")).toBe("production-feedback-form");
  });

  it("falls back to 'plan' for bare PLAN.md", () => {
    expect(slugFromPlanUrl("local://PLAN.md")).toBe("plan");
  });

  it("kebab-cases arbitrary names", () => {
    expect(slugFromPlanUrl("local://My_Feature Plan!.md")).toBe("my-feature-plan");
  });
});

describe("withFrontmatter", () => {
  it("prepends b-plan frontmatter when absent", () => {
    const out = withFrontmatter("# Plan: Thing\nbody", { date: "2026-08-25", subject: "2026-08-25.thing", planUrl: "local://thing-plan.md" });
    expect(out.startsWith("---\nstatus: active\ndate: 2026-08-25\nsubject: 2026-08-25.thing\nsource: omp-plan-mode\nsource_plan: local://thing-plan.md\n---\n\n# Plan: Thing")).toBe(true);
  });

  it("leaves existing frontmatter untouched", () => {
    const content = "---\nstatus: active\n---\n# Plan";
    expect(withFrontmatter(content, { date: "d", subject: "s", planUrl: "local://x.md" })).toBe(content);
  });
});

describe("wire (integration)", () => {
  beforeEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    mkdirSync(TEST_ROOT, { recursive: true });
    delete process.env.BUCK_PLAN_ARTIFACT;
  });
  afterEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    delete process.env.BUCK_PLAN_ARTIFACT;
  });

  function setupSession(planName: string) {
    // Session artifacts dir with the plan the agent wrote via local://
    const artifactsDir = join(TEST_ROOT, "session-artifacts");
    mkdirSync(join(artifactsDir, "local"), { recursive: true });
    writeFileSync(join(artifactsDir, "local", planName), "# Plan: Widget\n\nDo the thing.\n");

    // Project cwd with opt-in settings
    const cwd = join(TEST_ROOT, "project");
    mkdirSync(join(cwd, ".omp"), { recursive: true });
    writeFileSync(join(cwd, ".omp", "settings.json"), JSON.stringify({ buckPlanArtifact: { enabled: true } }));

    const { pi, handlers } = createMockPi();
    const ctx = createMockCtx(cwd, artifactsDir);
    return { pi, handlers, ctx, cwd };
  }

  it("does nothing by default when not enabled", async () => {
    const artifactsDir = join(TEST_ROOT, "bare-session");
    mkdirSync(join(artifactsDir, "local"), { recursive: true });
    writeFileSync(join(artifactsDir, "local", "x-plan.md"), "# Plan");
    const cwd = join(TEST_ROOT, "bare-project");
    mkdirSync(cwd, { recursive: true });

    const { pi, handlers } = createMockPi();
    const ctx = createMockCtx(cwd, artifactsDir);
    ctx.sessionManager.getEntries = vi.fn(() => [
      modeChange("e1", "plan", { planFilePath: "local://x-plan.md" }),
      modeChange("e2", "none"),
    ] as unknown[]);

    await fireTurnEnd(handlers, ctx);
    expect(existsSync(join(cwd, ".context"))).toBe(false);
    expect(pi.appendEntry).not.toHaveBeenCalled();
  });

  it("persists the plan into .context and dedupes via marker entry", async () => {
    const { pi, handlers, ctx, cwd } = setupSession("widget-plan.md");
    const entries = [
      modeChange("e1", "plan", { planFilePath: "local://widget-plan.md" }),
      modeChange("e2", "none"),
    ];
    ctx.sessionManager.getEntries = vi.fn(() => entries as unknown[]);

    await fireTurnEnd(handlers, ctx);

    const subjectDir = join(cwd, ".context", `${new Date().toISOString().slice(0, 10)}.widget`);
    const target = join(subjectDir, "plan-widget.md");
    const indexPath = join(subjectDir, "index.md");
    expect(existsSync(target)).toBe(true);
    expect(existsSync(indexPath)).toBe(true);
    const written = readFileSync(target, "utf8");
    expect(written.startsWith("---\nstatus: active\n")).toBe(true);
    expect(written).toContain("# Plan: Widget");
    const indexContent = readFileSync(indexPath, "utf8");
    expect(indexContent).toContain("status: active");
    expect(indexContent).toContain("[plan-widget.md](plan-widget.md)");
    expect(pi.appendEntry).toHaveBeenCalledTimes(1);
    expect(pi.appendEntry).toHaveBeenCalledWith("plan-artifact", expect.objectContaining({ exitId: "e2" }));
    expect(ctx.ui.notify).toHaveBeenCalledTimes(1);

    // Second turn_end with the marker entry present → no duplicate write.
    entries.push(markerEntry("e2") as unknown as never);
    await fireTurnEnd(handlers, ctx);
    expect(pi.appendEntry).toHaveBeenCalledTimes(1);
  });

  it("respects BUCK_PLAN_ARTIFACT=0 overriding enabled settings", async () => {
    process.env.BUCK_PLAN_ARTIFACT = "0";
    const { pi, handlers, ctx, cwd } = setupSession("off-plan.md");
    ctx.sessionManager.getEntries = vi.fn(() => [
      modeChange("e1", "plan", { planFilePath: "local://off-plan.md" }),
      modeChange("e2", "none"),
    ] as unknown[]);

    await fireTurnEnd(handlers, ctx);
    expect(existsSync(join(cwd, ".context"))).toBe(false);
    expect(pi.appendEntry).not.toHaveBeenCalled();
  });

  it("works through the production entry (extensions/index.ts default export)", async () => {
    // Load the real wired bundle (index.ts default export), not the bare module.
    const handlers = new Map<string, Array<(event: unknown, ctx: unknown) => Promise<void> | void>>();
    const pi = {
      on: (event: string, handler: (event: unknown, ctx: unknown) => Promise<void> | void) => {
        const list = handlers.get(event) ?? [];
        list.push(handler);
        handlers.set(event, list);
      },
      registerCommand: () => {},
      appendEntry: vi.fn(),
    } as unknown as ExtensionAPI;
    buckWorkflowExtension(pi);

    const artifactsDir = join(TEST_ROOT, "idx-session");
    mkdirSync(join(artifactsDir, "local"), { recursive: true });
    writeFileSync(join(artifactsDir, "local", "entry-plan.md"), "# Plan: Entry\n");
    const cwd = join(TEST_ROOT, "idx-project");
    mkdirSync(join(cwd, ".omp"), { recursive: true });
    writeFileSync(join(cwd, ".omp", "settings.json"), JSON.stringify({ buckPlanArtifact: { enabled: true } }));
    const ctx = createMockCtx(cwd, artifactsDir);
    ctx.sessionManager.getEntries = vi.fn(() => [
      modeChange("e1", "plan", { planFilePath: "local://entry-plan.md" }),
      modeChange("e2", "none"),
    ] as unknown[]);

    await fireTurnEnd(handlers, ctx);
    expect(existsSync(join(cwd, ".context", `${new Date().toISOString().slice(0, 10)}.entry`, "plan-entry.md"))).toBe(true);
  });

  it("silently skips when the plan file is missing on disk", async () => {
    const { pi, handlers, ctx, cwd } = setupSession("never-written-plan.md");
    rmSync(join(TEST_ROOT, "session-artifacts", "local", "never-written-plan.md"), { force: true });
    ctx.sessionManager.getEntries = vi.fn(() => [
      modeChange("e1", "plan", { planFilePath: "local://never-written-plan.md" }),
      modeChange("e2", "none"),
    ] as unknown[]);

    await fireTurnEnd(handlers, ctx);
    expect(existsSync(join(cwd, ".context"))).toBe(false);
    expect(pi.appendEntry).not.toHaveBeenCalled();
  });
  it("rejects a plan URL that traverses outside the session local directory", async () => {
    const { pi, handlers, ctx, cwd } = setupSession("unused-plan.md");
    writeFileSync(join(TEST_ROOT, "secret.md"), "# Secret");
    ctx.sessionManager.getEntries = vi.fn(() => [
      modeChange("e1", "plan", { planFilePath: "local://../../secret.md" }),
      modeChange("e2", "none"),
    ] as unknown[]);

    await fireTurnEnd(handlers, ctx);

    expect(existsSync(join(cwd, ".context"))).toBe(false);
    expect(pi.appendEntry).not.toHaveBeenCalled();
  });

  it("rejects a plan URL that is a symlink escaping the session local directory", async () => {
    const { pi, handlers, ctx, cwd } = setupSession("unused-plan.md");
    const secret = join(TEST_ROOT, "secret.md");
    writeFileSync(secret, "# Secret");
    symlinkSync(secret, join(TEST_ROOT, "session-artifacts", "local", "evil-plan.md"));
    ctx.sessionManager.getEntries = vi.fn(() => [
      modeChange("e1", "plan", { planFilePath: "local://evil-plan.md" }),
      modeChange("e2", "none"),
    ] as unknown[]);

    await fireTurnEnd(handlers, ctx);

    expect(existsSync(join(cwd, ".context"))).toBe(false);
    expect(pi.appendEntry).not.toHaveBeenCalled();
  });

  it("rejects a plan URL under a directory symlink that escapes local/", async () => {
    const { pi, handlers, ctx, cwd } = setupSession("unused-plan.md");
    const outsideDir = join(TEST_ROOT, "outside");
    mkdirSync(outsideDir, { recursive: true });
    writeFileSync(join(outsideDir, "leaked-plan.md"), "# Secret");
    symlinkSync(outsideDir, join(TEST_ROOT, "session-artifacts", "local", "alias"));
    ctx.sessionManager.getEntries = vi.fn(() => [
      modeChange("e1", "plan", { planFilePath: "local://alias/leaked-plan.md" }),
      modeChange("e2", "none"),
    ] as unknown[]);

    await fireTurnEnd(handlers, ctx);

    expect(existsSync(join(cwd, ".context"))).toBe(false);
    expect(pi.appendEntry).not.toHaveBeenCalled();
  });

  it("persists a plan URL that is a symlink staying inside local/", async () => {
    const { pi, handlers, ctx, cwd } = setupSession("widget-plan.md");
    symlinkSync(
      join(TEST_ROOT, "session-artifacts", "local", "widget-plan.md"),
      join(TEST_ROOT, "session-artifacts", "local", "alias-plan.md"),
    );
    ctx.sessionManager.getEntries = vi.fn(() => [
      modeChange("e1", "plan", { planFilePath: "local://alias-plan.md" }),
      modeChange("e2", "none"),
    ] as unknown[]);

    await fireTurnEnd(handlers, ctx);

    const subjectDir = join(cwd, ".context", `${new Date().toISOString().slice(0, 10)}.alias`);
    expect(existsSync(join(subjectDir, "plan-alias.md"))).toBe(true);
    expect(pi.appendEntry).toHaveBeenCalledTimes(1);
  });
});
