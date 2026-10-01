import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupRepos, phaseMd, repo, writeTree } from "./fixtures.js";
import { syncCheckedPhasesAt } from "../phase-completion.js";
import { scan } from "../scan.js";

const SUBJECT = ".context/2026-09-18.demo";
const PLAN = `${SUBJECT}/plan-demo.md`;
afterEach(cleanupRepos);

describe("unphased checked acceptance synchronization", () => {
  it("resolves subject input, preserves boxes, and keeps completion metadata stable", () => {
    const cwd = repo();
    writeTree(cwd, { [PLAN]: "---\nstatus: active\n---\n## Acceptance criteria\n- [x] Verified\n## Other\n- [ ] Not acceptance\n" });
    syncCheckedPhasesAt(cwd, SUBJECT, "2026-09-18");
    const completed = readFileSync(join(cwd, PLAN), "utf8");
    expect(completed).toContain("status: completed\ncompleted_at: 2026-09-18");
    expect(completed).toContain("- [x] Verified\n## Other\n- [ ] Not acceptance");
    syncCheckedPhasesAt(cwd, PLAN, "2026-09-19");
    expect(readFileSync(join(cwd, PLAN), "utf8")).toBe(completed);
  });

  it("does not complete a phased parent with checked body boxes", () => {
    const cwd = repo();
    const text = "---\nstatus: active\n---\n## Acceptance criteria\n- [x] Verified\n";
    writeTree(cwd, { [PLAN]: text, [`${SUBJECT}/phase-1-demo.md`]: phaseMd(1, "pending", [], "plan-demo.md") });
    syncCheckedPhasesAt(cwd, PLAN, "2026-09-18");
    expect(readFileSync(join(cwd, PLAN), "utf8")).toBe(text);
  });

  it.each(["- [ ] Open", "- [X] Uppercase", ""])("leaves unverified or empty list unchanged: %s", (criteria) => {
    const cwd = repo();
    const text = `---\nstatus: active\n---\n## Acceptance criteria\n${criteria}\n`;
    writeTree(cwd, { [PLAN]: text });
    syncCheckedPhasesAt(cwd, PLAN, "2026-09-18");
    expect(readFileSync(join(cwd, PLAN), "utf8")).toBe(text);
    const facts = scan({ projectRoot: cwd, path: PLAN }).planFacts;
    expect(facts.kind === "unphased" && facts.closeEligible).toBe(false);
  });

  it.each(["", "## Acceptance criteria\n"])("preserves status-only eligibility for missing or empty sections: %s", (body) => {
    const cwd = repo();
    writeTree(cwd, { [PLAN]: `---\nstatus: completed\n---\n${body}` });
    const facts = scan({ projectRoot: cwd, path: PLAN }).planFacts;
    expect(facts.kind === "unphased" && facts.closeEligible).toBe(true);
  });

  it("rejects uppercase boxes even when plan status is completed", () => {
    const cwd = repo();
    writeTree(cwd, { [PLAN]: "---\nstatus: completed\n---\n## Acceptance criteria\n- [X] Unverified\n" });
    const facts = scan({ projectRoot: cwd, path: PLAN }).planFacts;
    expect(facts.kind === "unphased" && facts.closeEligible).toBe(false);
  });
});
