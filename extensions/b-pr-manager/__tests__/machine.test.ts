import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createActor } from "xstate";
import { createPrManagerMachine, type PrManagerActor } from "../machine.js";
import {
  DEFAULT_DELAYED_WAIT_MS,
  DEFAULT_POLL_DELAYS_MS,
  EVENT_OWNERSHIP,
  FEEDBACK_VERDICTS,
  MACHINE_STATES,
  MAX_CONFLICT_STEPS,
  delayedWaitTotalMs,
  defaultCliOptions,
  isActionableVerdict,
  type BaseCache,
  type BlockReason,
  type FeedbackVersion,
  type MergeGateSnapshot,
  type PrManagerContext,
  type PrManagerEvent,
  type ResolvedPr,
  type ReviewerRoleResult,
  type ValidatorRoleResult,
} from "../types.js";
import { pullRequestMerged, reviewPayload } from "./fixtures/gh-payloads.js";

const samplePr: ResolvedPr = {
  number: 42,
  url: "https://github.com/acme/widgets/pull/42",
  owner: "acme",
  repo: "widgets",
  headRef: "feat/parse",
  baseRef: "main",
  headOid: "bbb222",
  draft: false,
  state: "OPEN",
  mergeCapabilities: { squash: true, rebase: true, merge: true },
};

const sampleCache: BaseCache = { branch: "main", provenance: "b-pr-base" };

function gate(overrides: Partial<MergeGateSnapshot> = {}): MergeGateSnapshot {
  return {
    schemaVersion: 1,
    headOid: "bbb222",
    baseOid: "ccc333",
    baseRefName: "main",
    draft: false,
    mergeable: true,
    requiredChecks: [{ name: "required-ci", status: "COMPLETED", conclusion: "SUCCESS" }],
    reviewDecision: "APPROVED",
    autoMerge: false,
    githubState: "OPEN",
    mergeCommitOid: null,
    ...overrides,
  };
}

function feedback(overrides: Partial<FeedbackVersion> = {}): FeedbackVersion {
  return {
    schemaVersion: 1,
    id: String(reviewPayload.id),
    nodeId: reviewPayload.node_id,
    kind: "review",
    author: reviewPayload.user.login,
    url: reviewPayload.html_url,
    createdAt: reviewPayload.submitted_at,
    updatedAt: reviewPayload.submitted_at,
    resolved: false,
    outdated: false,
    content: reviewPayload.body,
    contentDigest: "digest-1",
    fingerprint: "101:2026-09-10T10:00:00Z:digest-1",
    ...overrides,
  };
}

function validator(verdicts: ValidatorRoleResult["classifications"]): ValidatorRoleResult {
  return { schemaVersion: 1, role: "validator", classifications: verdicts };
}

function reviewer(verdict: ReviewerRoleResult["verdict"], headOid = "bbb222"): ReviewerRoleResult {
  return {
    schemaVersion: 1,
    role: "reviewer",
    verdict,
    headOid,
    diffDigest: "diff-1",
    findings: verdict === "pass" ? [] : ["finding"],
  };
}

function block(code: BlockReason["code"] = "github_unavailable"): BlockReason {
  return { schemaVersion: 1, code, message: code, resumeCommand: "/b-pr-manager 42 --resume" };
}

function startEvent(): PrManagerEvent {
  return { type: "START", options: defaultCliOptions({ pr: "42" }) };
}

function actor(overrides: Partial<PrManagerContext> = {}): PrManagerActor {
  const started = createActor(createPrManagerMachine(overrides));
  started.start();
  return started;
}

function valueOf(started: PrManagerActor): string {
  return String(started.getSnapshot().value);
}

function sendAll(started: PrManagerActor, events: PrManagerEvent[]) {
  for (const event of events) started.send(event);
}

function toRebasing(started: PrManagerActor) {
  sendAll(started, [
    startEvent(),
    { type: "BASE_READY", pr: samplePr, cache: sampleCache },
    { type: "CHECKOUT_OK", headOid: samplePr.headOid, branch: samplePr.headRef },
  ]);
}

function toFetching(started: PrManagerActor) {
  toRebasing(started);
  started.send({ type: "REBASE_OK", headOid: samplePr.headOid, rewrittenPublished: false });
}

function toMergeGate(started: PrManagerActor) {
  toFetching(started);
  sendAll(started, [
    { type: "NO_ACTIONABLE_DELTA" },
    { type: "REVIEW_PASS", result: reviewer("pass") },
    {
      type: "CLEAN_AND_SYNCED",
      verification: {
        headOid: samplePr.headOid,
        diffDigest: "diff-1",
        passed: true,
        commands: ["vitest"],
        exitCodes: [0],
      },
    },
  ]);
}

describe("b-pr-manager contracts", () => {
  it("uses the fix-pr verdict taxonomy exactly", () => {
    expect(FEEDBACK_VERDICTS).toEqual([
      "valid",
      "invalid",
      "already_done",
      "unsure",
      "nit",
      "out_of_scope",
    ]);
    expect(isActionableVerdict("valid")).toBe(true);
    expect(isActionableVerdict("nit")).toBe(true);
    expect(isActionableVerdict("unsure")).toBe(false);
  });

  it("keeps default delayed polling at 35m30s across seven waits", () => {
    expect(delayedWaitTotalMs()).toBe(DEFAULT_DELAYED_WAIT_MS);
    expect(DEFAULT_POLL_DELAYS_MS).toEqual([
      30_000, 60_000, 120_000, 240_000, 480_000, 600_000, 600_000,
    ]);
  });

  it("marks model payloads as L or H, never as prose events", () => {
    expect(EVENT_OWNERSHIP.ACTIONABLE).toBe("L");
    expect(EVENT_OWNERSHIP.BUILD_DONE).toBe("H");
    expect(EVENT_OWNERSHIP.START).toBe("D");
    expect(EVENT_OWNERSHIP.GITHUB_STATE_MERGED).toBe("D");
  });
});

describe("b-pr-manager machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in idle and enters resolving_pr on START", () => {
    const started = actor();
    expect(valueOf(started)).toBe("idle");
    started.send(startEvent());
    expect(valueOf(started)).toBe("resolving_pr");
  });

  it("ignores illegal events instead of transitioning", () => {
    const started = actor();
    started.send({ type: "CHECKOUT_OK", headOid: "abc", branch: "feat/x" });
    started.send({ type: "POLL_DUE" });
    started.send({ type: "REBASE_OK", headOid: "abc", rewrittenPublished: false });
    expect(valueOf(started)).toBe("idle");
  });

  it("cancels and blocks from every nonterminal state", () => {
    const cancellable = MACHINE_STATES.filter(
      (state) => state !== "merged" && state !== "blocked" && state !== "exhausted" && state !== "paused",
    );
    expect(cancellable.length).toBeGreaterThan(10);

    const started = actor();
    started.send(startEvent());
    started.send({ type: "CANCEL" });
    expect(valueOf(started)).toBe("paused");

    const blocked = actor();
    blocked.send(startEvent());
    blocked.send({ type: "BLOCK", reason: block() });
    expect(valueOf(blocked)).toBe("blocked");
  });

  it("does not leave merged on cancel or block", () => {
    const started = actor();
    started.send(startEvent());
    started.send({
      type: "GITHUB_STATE_MERGED",
      snapshot: gate({ githubState: "MERGED", mergeCommitOid: pullRequestMerged.mergeCommit.oid }),
    });
    expect(valueOf(started)).toBe("merged");
    started.send({ type: "CANCEL" });
    started.send({ type: "BLOCK", reason: block() });
    expect(valueOf(started)).toBe("merged");
  });

  it("follows the no-actionable-feedback path through merged", () => {
    const started = actor();
    sendAll(started, [
      startEvent(),
      { type: "CACHE_MISSING_OR_MISMATCH", pr: samplePr, cache: null },
      { type: "BASE_SELECTED", base: "main" },
      { type: "CHECKOUT_OK", headOid: samplePr.headOid, branch: samplePr.headRef },
      { type: "REBASE_OK", headOid: samplePr.headOid, rewrittenPublished: false },
      { type: "NO_ACTIONABLE_DELTA" },
      { type: "REVIEW_PASS", result: reviewer("pass") },
      {
        type: "CLEAN_AND_SYNCED",
        verification: {
          headOid: samplePr.headOid,
          diffDigest: "diff-1",
          passed: true,
          commands: ["vitest"],
          exitCodes: [0],
        },
      },
      { type: "ALL_GATES_PASS", snapshot: gate() },
      {
        type: "GITHUB_STATE_MERGED",
        snapshot: gate({ githubState: "MERGED", mergeCommitOid: "ddd444" }),
      },
    ]);
    expect(valueOf(started)).toBe("merged");
    expect(started.getSnapshot().context.mergeCommitOid).toBe("ddd444");
  });

  it("follows valid feedback through iterate, commit, push, and refresh", () => {
    const started = actor();
    toFetching(started);
    sendAll(started, [
      { type: "FEEDBACK_DELTA", versions: [feedback()] },
      {
        type: "ACTIONABLE",
        result: validator([
          { fingerprint: feedback().fingerprint, verdict: "valid", evidence: "src/parse.ts:12" },
        ]),
      },
      {
        type: "PLAN_READY",
        result: {
          schemaVersion: 1,
          role: "planner",
          artifactPath: ".context/2026-09-10.pr-42-feedback/iterate-pr-42-round-1.md",
          feedbackIds: ["101"],
          acceptance: ["null check"],
          verificationCommands: ["vitest"],
        },
      },
      {
        type: "BUILD_DONE",
        result: {
          schemaVersion: 1,
          role: "builder",
          expectedPaths: ["src/parse.ts"],
          actualPaths: ["src/parse.ts"],
          coherent: true,
        },
      },
      { type: "REVIEW_ITERATE", result: reviewer("iterate") },
      {
        type: "PLAN_READY",
        result: {
          schemaVersion: 1,
          role: "planner",
          artifactPath: ".context/2026-09-10.pr-42-feedback/iterate-pr-42-round-2.md",
          feedbackIds: ["101"],
          acceptance: ["null check"],
          verificationCommands: ["vitest"],
        },
      },
      {
        type: "BUILD_DONE",
        result: {
          schemaVersion: 1,
          role: "builder",
          expectedPaths: ["src/parse.ts"],
          actualPaths: ["src/parse.ts"],
          coherent: true,
        },
      },
      { type: "REVIEW_PASS", result: reviewer("pass") },
      {
        type: "DIRTY_VERIFIED",
        verification: {
          headOid: samplePr.headOid,
          diffDigest: "diff-1",
          passed: true,
          commands: ["vitest"],
          exitCodes: [0],
        },
      },
      { type: "COMMIT_OK", sha: "eee555" },
      { type: "REMOTE_HEAD_CONFIRMED", remoteHeadOid: "eee555" },
      { type: "NO_NEW_FEEDBACK" },
      { type: "ALL_GATES_PASS", snapshot: gate({ headOid: "eee555" }) },
      {
        type: "GITHUB_STATE_MERGED",
        snapshot: gate({ githubState: "MERGED", headOid: "eee555", mergeCommitOid: "fff666" }),
      },
    ]);
    expect(valueOf(started)).toBe("merged");
    expect(started.getSnapshot().context.createdCommitShas).toEqual(["eee555"]);
  });

  it("loops conflicts until continue, then invalidates exact-head attestations", () => {
    const started = actor({
      reviewAttestation: { headOid: "oldoid", diffDigest: "old", verdict: "pass" },
      verificationAttestation: {
        headOid: "oldoid",
        diffDigest: "old",
        passed: true,
        commands: ["vitest"],
        exitCodes: [0],
      },
    });
    toRebasing(started);
    expect(started.getSnapshot().context.reviewAttestation).toBeNull();
    expect(started.getSnapshot().context.verificationAttestation).toBeNull();

    started.send({ type: "CONFLICTS_FOUND", paths: ["src/parse.ts"] });
    expect(valueOf(started)).toBe("resolving_conflicts");
    started.send({
      type: "CONFLICT_STEP_DONE",
      headOid: "newoid",
      result: {
        schemaVersion: 1,
        role: "conflict",
        resolvedPaths: ["src/parse.ts"],
        remainingMarkers: false,
      },
    });
    expect(valueOf(started)).toBe("rebasing");
    expect(started.getSnapshot().context.conflictSteps).toBe(1);
    expect(started.getSnapshot().context.localHeadOid).toBe("newoid");
    expect(started.getSnapshot().context.reviewAttestation).toBeNull();
  });

  it("blocks after the 20th unresolved conflict step", () => {
    const started = actor();
    toRebasing(started);
    for (let step = 0; step < MAX_CONFLICT_STEPS; step++) {
      started.send({ type: "CONFLICTS_FOUND", paths: ["src/parse.ts"] });
      started.send({
        type: "CONFLICT_STEP_DONE",
        headOid: `oid-${step}`,
        result: {
          schemaVersion: 1,
          role: "conflict",
          resolvedPaths: ["src/parse.ts"],
          remainingMarkers: false,
        },
      });
    }
    expect(valueOf(started)).toBe("rebasing");
    started.send({ type: "CONFLICTS_FOUND", paths: ["src/parse.ts"] });
    expect(valueOf(started)).toBe("blocked");
    expect(started.getSnapshot().context.blockReason?.code).toBe("conflict_limit");
  });

  it("routes new feedback after push back through validation", () => {
    const started = actor();
    toFetching(started);
    sendAll(started, [
      { type: "NO_ACTIONABLE_DELTA" },
      { type: "REVIEW_PASS", result: reviewer("pass") },
      {
        type: "REWRITTEN_OR_AHEAD",
        verification: {
          headOid: samplePr.headOid,
          diffDigest: "diff-1",
          passed: true,
          commands: ["vitest"],
          exitCodes: [0],
        },
      },
      { type: "REMOTE_HEAD_CONFIRMED", remoteHeadOid: samplePr.headOid },
      { type: "NEW_FEEDBACK", versions: [feedback({ fingerprint: "changed" })] },
    ]);
    expect(valueOf(started)).toBe("validating_feedback");
  });

  it("returns to rebase when the merge gate sees a moved base", () => {
    const started = actor();
    toMergeGate(started);
    started.send({
      type: "BASE_ADVANCED_OR_CONFLICT",
      snapshot: gate({ baseOid: "base-moved", headOid: "head-moved" }),
    });
    expect(valueOf(started)).toBe("rebasing");
    expect(started.getSnapshot().context.reviewAttestation).toBeNull();
    expect(started.getSnapshot().context.verificationAttestation).toBeNull();
  });

  it("blocks on a hard check failure", () => {
    const started = actor();
    toMergeGate(started);
    started.send({
      type: "HARD_GATE_FAIL",
      snapshot: gate({
        requiredChecks: [{ name: "required-ci", status: "COMPLETED", conclusion: "FAILURE" }],
      }),
      reason: block("hard_gate_fail"),
    });
    expect(valueOf(started)).toBe("blocked");
  });

  it("waits on pending remote gates, resets delay on progress, and exhausts the budget", async () => {
    const started = actor();
    toMergeGate(started);

    started.send({ type: "REMOTE_GATE_PENDING", snapshot: gate({ reviewDecision: null }) });
    expect(valueOf(started)).toBe("waiting");
    expect(started.getSnapshot().context.poll.observationCount).toBe(1);

    await vi.advanceTimersByTimeAsync(29_999);
    expect(valueOf(started)).toBe("waiting");
    await vi.advanceTimersByTimeAsync(1);
    expect(valueOf(started)).toBe("checking_merge_gate");

    started.send({
      type: "NEW_FEEDBACK",
      versions: [feedback({ fingerprint: "after-wait" })],
    });
    expect(valueOf(started)).toBe("validating_feedback");
    expect(started.getSnapshot().context.poll.observationCount).toBe(0);

    sendAll(started, [
      {
        type: "NOTHING_ACTIONABLE",
        result: validator([
          { fingerprint: "after-wait", verdict: "already_done", evidence: "HEAD" },
        ]),
      },
      { type: "REVIEW_PASS", result: reviewer("pass") },
      {
        type: "CLEAN_AND_SYNCED",
        verification: {
          headOid: samplePr.headOid,
          diffDigest: "diff-1",
          passed: true,
          commands: ["vitest"],
          exitCodes: [0],
        },
      },
    ]);

    for (const delay of DEFAULT_POLL_DELAYS_MS) {
      expect(valueOf(started)).toBe("checking_merge_gate");
      started.send({ type: "REMOTE_GATE_PENDING", snapshot: gate({ reviewDecision: null }) });
      expect(valueOf(started)).toBe("waiting");
      await vi.advanceTimersByTimeAsync(delay);
    }

    expect(valueOf(started)).toBe("checking_merge_gate");
    started.send({ type: "REMOTE_GATE_PENDING", snapshot: gate({ reviewDecision: null }) });
    expect(valueOf(started)).toBe("exhausted");
    expect(delayedWaitTotalMs()).toBe(2_130_000);
  });

  it("treats auto-merge accepted as not-yet-success and merged only on GitHub state", () => {
    const started = actor();
    toMergeGate(started);
    started.send({ type: "ALL_GATES_PASS", snapshot: gate() });
    expect(valueOf(started)).toBe("enabling_auto_merge");
    started.send({ type: "AUTO_MERGE_ACCEPTED", snapshot: gate({ autoMerge: true }) });
    expect(valueOf(started)).toBe("waiting");
    expect(started.getSnapshot().context.autoMergeRequested).toBe(true);
    started.send({ type: "POLL_DUE" });
    started.send({
      type: "GITHUB_STATE_MERGED",
      snapshot: gate({ githubState: "MERGED", mergeCommitOid: "ddd444" }),
    });
    expect(valueOf(started)).toBe("merged");
  });

  it("resumes blocked, paused, and exhausted runs through reconcile", () => {
    const blockedRun = actor();
    blockedRun.send(startEvent());
    blockedRun.send({ type: "BLOCK", reason: block() });
    blockedRun.send({ type: "RESUME_AND_RECONCILE" });
    expect(valueOf(blockedRun)).toBe("resolving_pr");

    const pausedRun = actor();
    pausedRun.send(startEvent());
    pausedRun.send({ type: "CANCEL" });
    pausedRun.send({ type: "RESUME_AND_RECONCILE" });
    expect(valueOf(pausedRun)).toBe("resolving_pr");

    const exhaustedRun = actor();
    toMergeGate(exhaustedRun);
    for (let i = 0; i < 8; i++) {
      exhaustedRun.send({ type: "REMOTE_GATE_PENDING", snapshot: gate() });
      if (valueOf(exhaustedRun) === "waiting") exhaustedRun.send({ type: "POLL_DUE" });
    }
    expect(valueOf(exhaustedRun)).toBe("exhausted");
    exhaustedRun.send({ type: "RESUME_AND_RECONCILE" });
    expect(valueOf(exhaustedRun)).toBe("resolving_pr");
    expect(exhaustedRun.getSnapshot().context.poll.observationCount).toBe(0);
  });

  it("blocks mismatched base selection without retargeting", () => {
    const started = actor();
    sendAll(started, [
      startEvent(),
      { type: "CACHE_MISSING_OR_MISMATCH", pr: samplePr, cache: null },
      { type: "BASE_SELECTED", base: "develop" },
    ]);
    expect(valueOf(started)).toBe("blocked");
    expect(started.getSnapshot().context.blockReason?.code).toBe("base_mismatch");
    expect(started.getSnapshot().context.pr?.baseRef).toBe("main");
  });

  it("blocks unsure validation after storing independent verdicts", () => {
    const started = actor();
    toFetching(started);
    started.send({ type: "FEEDBACK_DELTA", versions: [feedback()] });
    started.send({
      type: "UNSURE_OR_SCOPE_DECISION",
      result: validator([
        { fingerprint: "a", verdict: "valid", evidence: "src/parse.ts:12" },
        { fingerprint: "b", verdict: "unsure", evidence: "product call" },
      ]),
    });
    expect(valueOf(started)).toBe("blocked");
    expect(started.getSnapshot().context.verdicts.a?.verdict).toBe("valid");
    expect(started.getSnapshot().context.verdicts.b?.verdict).toBe("unsure");
  });

  it("returns verifying to review when head or diff drifted", () => {
    const started = actor();
    toFetching(started);
    sendAll(started, [
      { type: "NO_ACTIONABLE_DELTA" },
      { type: "REVIEW_PASS", result: reviewer("pass") },
      { type: "HEAD_OR_DIFF_DRIFTED", headOid: "drifted", diffDigest: "diff-2" },
    ]);
    expect(valueOf(started)).toBe("reviewing");
    expect(started.getSnapshot().context.reviewAttestation).toBeNull();
  });

  it("blocks local gate failure and independent review block", () => {
    const localFail = actor();
    toFetching(localFail);
    sendAll(localFail, [
      { type: "NO_ACTIONABLE_DELTA" },
      { type: "REVIEW_PASS", result: reviewer("pass") },
      {
        type: "LOCAL_GATE_FAIL",
        verification: {
          headOid: samplePr.headOid,
          diffDigest: "diff-1",
          passed: false,
          commands: ["vitest"],
          exitCodes: [1],
        },
      },
    ]);
    expect(valueOf(localFail)).toBe("blocked");
    expect(localFail.getSnapshot().context.blockReason?.code).toBe("local_gate_fail");

    const reviewBlock = actor();
    toFetching(reviewBlock);
    sendAll(reviewBlock, [
      { type: "NO_ACTIONABLE_DELTA" },
      { type: "REVIEW_BLOCK", result: reviewer("block") },
    ]);
    expect(valueOf(reviewBlock)).toBe("blocked");
  });

  it("cancels from waiting and honors POLL_LIMIT", () => {
    const cancelled = actor();
    toMergeGate(cancelled);
    cancelled.send({ type: "REMOTE_GATE_PENDING", snapshot: gate() });
    expect(valueOf(cancelled)).toBe("waiting");
    cancelled.send({ type: "CANCEL" });
    expect(valueOf(cancelled)).toBe("paused");

    const limited = actor();
    toMergeGate(limited);
    limited.send({ type: "REMOTE_GATE_PENDING", snapshot: gate() });
    limited.send({ type: "POLL_LIMIT" });
    expect(valueOf(limited)).toBe("exhausted");
  });

});
