import { afterEach, describe, expect, it } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { wireBuckLoop } from "../index.js";
import { readProjection, writeProjection } from "../persist.js";
import { cleanupRepos, phaseMd, planMd, repo, writeTree } from "./fixtures.js";

const SUBJECT = "2026-09-18.demo";
const PLAN = `.context/${SUBJECT}/plan-demo.md`;
const PHASE = `.context/${SUBJECT}/phase-2-p2.md`;
const BLOCKER = "nested skill left unstaged non-.context changes:  M skills/fix-pr/SKILL.md";

function blockedRun(from: "building" | "committing" = "committing"): string {
  const cwd = repo();
  writeTree(cwd, {
    [PLAN]: planMd(),
    [`.context/${SUBJECT}/plan-demo-phases.md`]: "---\nstatus: active\n---\n# Phases\n",
    [`.context/${SUBJECT}/phase-1-p1.md`]: phaseMd(1, "completed"),
    [PHASE]: phaseMd(2, "pending", [1]),
  });
  writeProjection(cwd, {
    version: 1,
    state: "blocked",
    subject: SUBJECT,
    planPath: PLAN,
    phasePath: PHASE,
    loopCount: 1,
    iterateCyclesOnPhase: 0,
    maxLoops: 12,
    lastChoice: null,
    history: [{ from, to: "blocked", at: "2026-09-18T00:00:00Z", why: BLOCKER }],
  });
  return cwd;
}

function command() {
  let handler: ((args: string, ctx: { cwd: string; ui: { notify: (message: string, level?: string) => void } }) => Promise<void>) | undefined;
  wireBuckLoop({
    registerCommand: (_name: string, spec: { handler: typeof handler }) => { handler = spec.handler; },
    sendMessage: () => undefined,
  } as unknown as ExtensionAPI);
  if (!handler) throw new Error("buck-loop command not registered");
  return handler;
}

afterEach(cleanupRepos);

describe("buck-loop stopped-run presentation", () => {
  it("shows the interrupted commit cause and safe completion path on status", async () => {
    const cwd = blockedRun();
    const notices: Array<{ message: string; level?: string }> = [];
    await command()("--status", { cwd, ui: { notify: (message, level) => notices.push({ message, level }) } });

    expect(notices).toEqual([expect.objectContaining({
      level: "info",
      message: expect.stringContaining(BLOCKER),
    })]);
    expect(notices[0]?.message).toContain("/b-commit");
    expect(notices[0]?.message).toContain(`/buck-loop ${PHASE}`);
    expect(notices[0]?.message).not.toContain("/buck-loop --resume");
    expect(readProjection(cwd)?.state).toBe("blocked");
  });

  it("offers resume after a recoverable non-commit block", async () => {
    const cwd = blockedRun("building");
    const notices: string[] = [];
    await command()("--status", { cwd, ui: { notify: (message) => notices.push(message) } });
    expect(notices[0]).toContain(BLOCKER);
    expect(notices[0]).toContain("/buck-loop --resume");
  });

  it("reports stop, status, and resume-after-stop as informational with a fresh-run path", async () => {
    const cwd = blockedRun();
    const notices: Array<{ message: string; level?: string }> = [];
    const ctx = { cwd, ui: { notify: (message: string, level?: string) => notices.push({ message, level }) } };
    const handler = command();

    await handler("--stop", ctx);
    await handler("--status", ctx);
    await handler("--stop", ctx);
    await handler("--resume", ctx);

    expect(readProjection(cwd)?.state).toBe("aborted");
    expect(readProjection(cwd)?.history).toHaveLength(2);
    expect(readProjection(cwd)?.history.at(-1)).toMatchObject({ from: "blocked", to: "aborted" });
    expect(notices).toHaveLength(4);
    for (const notice of notices) {
      expect(notice.level).toBe("info");
      expect(notice.message).toContain(BLOCKER);
      expect(notice.message).toContain("/b-commit");
      expect(notice.message).toContain(`/buck-loop ${PHASE}`);
      expect(notice.message).not.toContain("STOP requested by operator from blocked");
    }
  });
});
