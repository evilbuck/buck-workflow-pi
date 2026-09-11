import { describe, expect, it } from "vitest";

import { GithubInventory, PrResolutionError, checkState, feedbackDelta } from "../github.js";

const pr = {
  number: 42, url: "https://github.com/acme/widgets/pull/42", headRefName: "feature", baseRefName: "main", headRefOid: "head-1", baseRefOid: "base-1", isDraft: false, state: "OPEN", mergeable: "MERGEABLE", reviewDecision: "CHANGES_REQUESTED", autoMergeRequest: null,
  mergeCommit: null, repository: { nameWithOwner: "acme/widgets", squashMergeAllowed: true, rebaseMergeAllowed: true, mergeCommitAllowed: false }, statusCheckRollup: [{ name: "ci", status: "COMPLETED", conclusion: "SUCCESS", isRequired: true }],
};
const review = { id: 1, node_id: "R1", user: { login: "reviewer" }, body: "change this", html_url: "review-url", submitted_at: "2026-09-10T10:00:00Z" };
const inline = { id: 2, node_id: "C2", user: { login: "reviewer" }, body: "inline", html_url: "inline-url", created_at: "2026-09-10T10:01:00Z", updated_at: "2026-09-10T10:01:00Z", path: "src/a.ts", line: 5, original_commit_id: "old" };
const conversation = { id: 3, node_id: "C3", user: { login: "maintainer" }, body: "conversation", html_url: "conversation-url", created_at: "2026-09-10T10:02:00Z", updated_at: "2026-09-10T10:02:00Z" };
const thread = {
  data: { repository: { pullRequest: { reviewThreads: { nodes: [{
    id: "T4", isResolved: true, isOutdated: true, path: "src/a.ts", line: 6,
    comments: { nodes: [{ id: "thread-comment", body: "resolved", url: "thread-url", createdAt: "2026-09-10T10:03:00Z", updatedAt: "2026-09-10T10:03:00Z", author: { login: "reviewer" } }] },
  }] } } } },
};

function runner(responses: Record<string, string | string[]>): { run: (args: readonly string[]) => Promise<string>; calls: string[][] } {
  const calls: string[][] = [];
  return { calls, run: async (args) => { calls.push([...args]); const endpoint = args.find((part) => part.includes("pulls/42/") || part.includes("issues/42/")); const key = endpoint ? endpoint.split("repos/acme/widgets/")[1] : (args.includes("graphql") ? "graphql" : (args.includes("merge") ? "merge" : "view")); const result = responses[key]; if (Array.isArray(result)) return result.shift() ?? result.at(-1) ?? ""; return result ?? JSON.stringify(pr); } };
}

describe("GithubInventory", () => {
  it("paginates every feedback source and records review-thread state", async () => {
    const fake = runner({ view: JSON.stringify(pr), "pulls/42/reviews": `${JSON.stringify([review])}\n${JSON.stringify([])}`, "pulls/42/comments": JSON.stringify([inline]), "issues/42/comments": JSON.stringify([conversation]), graphql: JSON.stringify(thread) });
    const github = new GithubInventory(fake.run); const resolved = await github.resolvePr(42); const feedback = await github.readFeedback(resolved);
    expect(feedback.map((item) => item.kind)).toEqual(["review", "inline_comment", "conversation_comment", "review_thread"]);
    expect(feedback.find((item) => item.kind === "review_thread")).toMatchObject({ resolved: true, outdated: true, path: "src/a.ts", line: 6 });
    expect(fake.calls.filter((call) => call.includes("--paginate"))).toHaveLength(3);
  });

  it("makes edits a new deterministic feedback version and removes exact duplicate fingerprints", () => {
    const initial = new GithubInventory().constructor; void initial;
    const first = { schemaVersion: 1 as const, id: "2", nodeId: "2", kind: "inline_comment" as const, author: "a", url: "u", createdAt: "a", updatedAt: "a", resolved: false, outdated: false, content: "one", contentDigest: "d1", fingerprint: "2:a:d1" };
    const edited = { ...first, updatedAt: "b", content: "two", contentDigest: "d2", fingerprint: "2:b:d2" };
    expect(feedbackDelta([edited, edited], [first])).toEqual([edited]);
    expect(feedbackDelta([first], [first])).toEqual([]);
  });

  it("refreshes immediately and sees a comment that arrived after push", async () => {
    const later = { ...conversation, id: 9, node_id: "C9", body: "new gate comment", updated_at: "2026-09-10T11:00:00Z" };
    const fake = runner({ view: JSON.stringify(pr), "pulls/42/reviews": JSON.stringify([]), "pulls/42/comments": JSON.stringify([]), "issues/42/comments": [JSON.stringify([]), JSON.stringify([later])], graphql: JSON.stringify(thread) });
    const github = new GithubInventory(fake.run); const resolved = await github.resolvePr(42); const before = await github.readFeedback(resolved); const after = await github.readFeedback(resolved);
    expect(feedbackDelta(after, before)).toMatchObject([{ id: "9", content: "new gate comment" }]);
  });

  it("reports merge gate state exactly as GitHub reports it and recognizes only complete success", async () => {
    const fake = runner({ view: JSON.stringify({ ...pr, autoMergeRequest: { enabledAt: "now" }, statusCheckRollup: [{ name: "ci", status: "IN_PROGRESS", conclusion: null }], mergeable: "CONFLICTING", reviewDecision: "REVIEW_REQUIRED" }) });
    const github = new GithubInventory(fake.run); const resolved = await github.resolvePr(42); const gate = await github.readMergeGate(resolved);
    expect(gate).toMatchObject({ autoMerge: true, mergeable: false, reviewDecision: "REVIEW_REQUIRED", githubState: "OPEN" });
    expect(checkState(gate.requiredChecks)).toBe("pending");
    expect(checkState([{ name: "ci", status: "COMPLETED", conclusion: "FAILURE" }])).toBe("failure");
    expect(checkState([{ name: "ci", status: "COMPLETED", conclusion: "SUCCESS" }])).toBe("success");
  });

  it("requires MERGED plus a merge OID and mutates idempotently without privileged flags", async () => {
    const merged = { ...pr, state: "MERGED", mergeCommit: { oid: "merge-1" } }; const fake = runner({ view: [JSON.stringify(pr), JSON.stringify(pr), JSON.stringify(pr), JSON.stringify(merged)], merge: "" });
    const github = new GithubInventory(fake.run); const resolved = await github.resolvePr(42);
    expect(await github.enableAutoMerge(resolved, "squash", "wrong-head")).toBe(false);
    expect(await github.enableAutoMerge(resolved, "squash", "head-1")).toBe(true);
    expect(await github.readMergedState(resolved)).toEqual({ merged: true, mergeCommitOid: "merge-1" });
    expect(fake.calls.flat()).not.toContain("--admin"); expect(fake.calls.flat()).toContain("--squash");
  });

  it("returns a typed rerun error for zero or multiple PR matches", async () => {
    const zero = new GithubInventory(runner({ view: JSON.stringify([]) }).run);
    await expect(zero.resolvePr()).rejects.toBeInstanceOf(PrResolutionError);
    await expect(zero.resolvePr()).rejects.toThrow("/b-pr-manager <PR>");
    const many = new GithubInventory(runner({ view: JSON.stringify([pr, pr]) }).run);
    await expect(many.resolvePr()).rejects.toMatchObject({ code: "ambiguous_pr", matchCount: 2 });
  });
});
