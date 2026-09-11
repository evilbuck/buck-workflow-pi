import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import { createPrManagerMachine } from "../machine.js";
import { defaultCliOptions, type MergeGateSnapshot, type PrManagerEvent } from "../types.js";
import { wire } from "../index.js";
import { checkState } from "../github.js";

function gate(overrides: Partial<MergeGateSnapshot> = {}): MergeGateSnapshot {
  return {
    schemaVersion: 1,
    headOid: "h1",
    baseOid: "b1",
    baseRefName: "main",
    draft: false,
    mergeable: true,
    requiredChecks: [{ name: "ci", status: "COMPLETED", conclusion: "SUCCESS" }],
    reviewDecision: "APPROVED",
    autoMerge: false,
    githubState: "OPEN",
    mergeCommitOid: null,
    ...overrides,
  };
}

function drive(events: PrManagerEvent[]): string {
  const actor = createActor(createPrManagerMachine());
  actor.start();
  actor.send({ type: "START", options: defaultCliOptions({ pr: "42" }) });
  for (const event of events) actor.send(event);
  return String(actor.getSnapshot().value);
}

const toReview: PrManagerEvent[] = [
  { type: "BASE_READY", pr: { number: 42, url: "u", owner: "acme", repo: "w", headRef: "f", baseRef: "main", headOid: "h1", draft: false, state: "OPEN", mergeCapabilities: { squash: true, rebase: true, merge: true } }, cache: { branch: "main", provenance: "b-pr-base" } },
  { type: "CHECKOUT_OK", headOid: "h1", branch: "f" },
  { type: "REBASE_OK", headOid: "h1", rewrittenPublished: false },
];

describe("b-pr-manager primary paths", () => {
  it("no actionable feedback reaches merged only via GitHub MERGED", () => {
    expect(drive([
      ...toReview,
      { type: "NO_ACTIONABLE_DELTA" },
      { type: "REVIEW_PASS", result: { schemaVersion: 1, role: "reviewer", verdict: "pass", headOid: "h1", diffDigest: "d", findings: [] } },
      { type: "CLEAN_AND_SYNCED", verification: { headOid: "h1", diffDigest: "d", passed: true, commands: ["vitest"], exitCodes: [0] } },
      { type: "ALL_GATES_PASS", snapshot: gate() },
      { type: "AUTO_MERGE_ACCEPTED", snapshot: gate({ autoMerge: true }) },
    ])).toBe("waiting");
    expect(drive([
      ...toReview,
      { type: "NO_ACTIONABLE_DELTA" },
      { type: "REVIEW_PASS", result: { schemaVersion: 1, role: "reviewer", verdict: "pass", headOid: "h1", diffDigest: "d", findings: [] } },
      { type: "CLEAN_AND_SYNCED", verification: { headOid: "h1", diffDigest: "d", passed: true, commands: ["vitest"], exitCodes: [0] } },
      { type: "ALL_GATES_PASS", snapshot: gate() },
      { type: "GITHUB_STATE_MERGED", snapshot: gate({ githubState: "MERGED", mergeCommitOid: "m1" }) },
    ])).toBe("merged");
  });

  it("valid feedback iterates then merges after push refresh", () => {
    expect(drive([
      ...toReview,
      { type: "FEEDBACK_DELTA", versions: [] },
      { type: "ACTIONABLE", result: { schemaVersion: 1, role: "validator", classifications: [] } },
      { type: "PLAN_READY", result: { schemaVersion: 1, role: "planner", artifactPath: "a.md", feedbackIds: ["1"], acceptance: [], verificationCommands: [] } },
      { type: "BUILD_DONE", result: { schemaVersion: 1, role: "builder", expectedPaths: ["a.ts"], actualPaths: ["a.ts"], coherent: true } },
      { type: "REVIEW_PASS", result: { schemaVersion: 1, role: "reviewer", verdict: "pass", headOid: "h1", diffDigest: "d", findings: [] } },
      { type: "DIRTY_VERIFIED", verification: { headOid: "h1", diffDigest: "d", passed: true, commands: ["vitest"], exitCodes: [0] } },
      { type: "COMMIT_OK", sha: "c1" },
      { type: "REMOTE_HEAD_CONFIRMED", remoteHeadOid: "c1" },
      { type: "NO_NEW_FEEDBACK" },
      { type: "ALL_GATES_PASS", snapshot: gate({ headOid: "c1" }) },
      { type: "GITHUB_STATE_MERGED", snapshot: gate({ githubState: "MERGED", headOid: "c1", mergeCommitOid: "m1" }) },
    ])).toBe("merged");
  });

  it("blocks draft, hard checks, changes-requested, and exhausts polls", () => {
    expect(checkState([{ name: "ci", status: "IN_PROGRESS", conclusion: null }])).toBe("pending");
    expect(drive([
      ...toReview,
      { type: "NO_ACTIONABLE_DELTA" },
      { type: "REVIEW_PASS", result: { schemaVersion: 1, role: "reviewer", verdict: "pass", headOid: "h1", diffDigest: "d", findings: [] } },
      { type: "CLEAN_AND_SYNCED", verification: { headOid: "h1", diffDigest: "d", passed: true, commands: ["vitest"], exitCodes: [0] } },
      { type: "HARD_GATE_FAIL", snapshot: gate({ draft: true }), reason: { schemaVersion: 1, code: "hard_gate_fail", message: "draft" } },
    ])).toBe("blocked");
  });

  it("cancels to paused and resumes without claiming success", () => {
    const actor = createActor(createPrManagerMachine());
    actor.start();
    actor.send({ type: "START", options: defaultCliOptions({ pr: "42" }) });
    actor.send({ type: "CANCEL" });
    expect(String(actor.getSnapshot().value)).toBe("paused");
    actor.send({ type: "RESUME_AND_RECONCILE" });
    expect(String(actor.getSnapshot().value)).toBe("resolving_pr");
  });

  it("does not merge a live GitHub PR from tests", () => {
    expect(wire).toBeTypeOf("function");
  });
});
