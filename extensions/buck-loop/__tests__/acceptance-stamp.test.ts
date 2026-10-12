import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupRepos, repo, writeTree } from "./fixtures.js";
import { describeAcceptanceGap, stampAcceptance, type AcceptanceJudge } from "../acceptance-stamp.js";
import { diagnoseAmbiguity } from "../ambiguity.js";
import { phaseFileDone, syncCheckedPhasesAt } from "../phase-completion.js";

afterEach(cleanupRepos);

const SUBJECT = "2026-09-18.demo";
const PHASE = `.context/${SUBJECT}/phase-1-p1.md`;

function setup(list = '  - "[ ] tests pass"\n  - "[ ] live query works"'): { cwd: string; abs: string } {
  const cwd = repo();
  writeTree(cwd, {
    [`.context/${SUBJECT}/plan-demo.md`]: "---\nstatus: active\n---\n# Plan\n",
    [`.context/${SUBJECT}/plan-demo-phases.md`]: "---\nformat: discrete\n---\n| Phase | Status | File |\n|---|---|---|\n| 1 | pending | phase-1-p1.md |\n",
    [PHASE]: `---\nstatus: in-progress\nphase: 1\norder: 1\ndepends_on: []\ndependency_type: NONE\nacceptance_criteria:\n${list}\ncompleted_at: null\n---\n# Phase 1\n`,
  });
  return { cwd, abs: join(cwd, PHASE) };
}

const answers = (...nouls: number[]) => ({
  details: { answers: Object.fromEntries(nouls.map((noul, i) => [`criterion_${i + 1}`, { type: "noul", noul }])) },
});

describe("loop-owned acceptance stamp", () => {
  it("ticks criteria at noul >= 0.7 and leaves the rest open", async () => {
    const { abs } = setup();
    const judge = vi.fn<AcceptanceJudge>(async () => answers(0.9, 0.4));
    const stamp = await stampAcceptance(abs, "ran npm test: 12 passed", judge);
    expect(stamp).toEqual({ ticked: ["[ ] tests pass"], open: ["[ ] live query works"] });
    const [state, questions] = judge.mock.calls[0]!;
    expect(state).toMatchObject({ evidence: "ran npm test: 12 passed", criteria: ["tests pass", "live query works"] });
    expect(questions.criterion_2.instructions).toContain("live query works");
    expect(readFileSync(abs, "utf8")).toContain('"[x] tests pass"');
  });

  it("lets the existing sync complete the phase once every box is stamped", async () => {
    const { cwd, abs } = setup();
    await stampAcceptance(abs, "evidence", async () => answers(0.95, 0.8));
    expect(phaseFileDone(abs)).toBe(true);
    syncCheckedPhasesAt(cwd, PHASE, "2026-09-18");
    expect(readFileSync(abs, "utf8")).toMatch(/^status: completed$/m);
    expect(readFileSync(join(cwd, `.context/${SUBJECT}/plan-demo-phases.md`), "utf8")).toContain("| completed |");
  });

  it.each([
    ["throws", (async () => { throw new Error("network down"); }) as AcceptanceJudge, "jev unavailable: network down"],
    ["returns an error", (async () => ({ details: { error: true, message: "TypeSafe API key is unavailable." } })) as AcceptanceJudge, "jev unavailable: TypeSafe API key is unavailable."],
    ["returns nothing", (async () => undefined) as AcceptanceJudge, "jev unavailable: no answers returned"],
  ] as Array<[string, AcceptanceJudge, string]>)("keeps every box open and reports why when jev %s", async (_label, judge, reason) => {
    const { abs } = setup();
    const before = readFileSync(abs, "utf8");
    const stamp = await stampAcceptance(abs, "evidence", judge);
    expect(stamp.unavailable).toBe(reason);
    expect(stamp.ticked).toEqual([]);
    expect(readFileSync(abs, "utf8")).toBe(before);
    const gap = describeAcceptanceGap(stamp)!;
    expect(gap).toContain(reason);
    expect(gap).toContain('"[ ] tests pass"');
    expect(gap).toContain('"[ ] live query works"');
  });

  it("does not call jev when nothing is open", async () => {
    const { abs } = setup('  - "[X] done already"');
    const judge = vi.fn<AcceptanceJudge>();
    expect(await stampAcceptance(abs, "", judge)).toEqual({ ticked: [], open: [] });
    expect(judge).not.toHaveBeenCalled();
    expect(phaseFileDone(abs)).toBe(true);
  });

  it("puts the gap in the retry diagnosis", () => {
    const { abs } = setup();
    const text = diagnoseAmbiguity({ abs, sessionText: "done", why: "w", acceptanceGap: 'jev unavailable: x; unchecked acceptance: "[ ] tests pass"' });
    expect(text).toContain("Acceptance stamp: jev unavailable: x");
    expect(text).toContain("Unchecked: [ ] tests pass; [ ] live query works");
  });
});
