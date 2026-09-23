import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AttributionDatabase, type AttributionRecord } from "../db.js";
import { buildTokenReport } from "../report.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function setup(): AttributionDatabase {
  const root = mkdtempSync(join(tmpdir(), "token-report-"));
  roots.push(root);
  const ledger = new AttributionDatabase(join(root, "stats.db"));
  const base: AttributionRecord = {
    recordedAt: "2026-09-23T10:00:00.000Z",
    sessionFile: "/sessions/main.jsonl",
    sessionId: "s1",
    entryKey: "one",
    projectKey: "git@example.test:repo.git",
    branch: "main",
    worktreeRoot: "/repo",
    provider: "openai",
    model: "gpt-5",
    api: "openai-responses",
    inputTokens: 100,
    outputTokens: 50,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 20,
    totalTokens: 150,
    costUsd: 0.01,
    costSource: "usage",
  };
  ledger.insert(base);
  ledger.insert({ ...base, entryKey: "two", branch: "feature/a", provider: "anthropic", model: "claude", totalTokens: 250, inputTokens: 200, outputTokens: 50, costUsd: 0.02 });
  ledger.insert({ ...base, entryKey: "three", projectKey: "https://example.test/other.git", branch: "main", totalTokens: 999, costUsd: 0.5 });
  return ledger;
}

describe("buildTokenReport", () => {
  it("prints current-project totals grouped by branch and provider/model", () => {
    const ledger = setup();
    const text = buildTokenReport(ledger, "git@example.test:repo.git", "");
    ledger.close();

    expect(text).toContain("git@example.test:repo.git");
    expect(text).toContain("400 tokens");
    expect(text).toContain("Estimated cost: $0.0300");
    expect(text).toMatch(/feature\/a\s+250/);
    expect(text).toMatch(/main\s+150/);
    expect(text).toMatch(/anthropic\/claude\s+250/);
    expect(text).not.toContain("999");
  });

  it("filters an exact current-project branch before considering project substrings", () => {
    const ledger = setup();
    const text = buildTokenReport(ledger, "git@example.test:repo.git", "feature/a");
    ledger.close();

    expect(text).toContain("Branch: feature/a");
    expect(text).toContain("250 tokens");
    expect(text).not.toMatch(/main\s+150/);
  });

  it("lists matching projects when the argument is not a current-project branch", () => {
    const ledger = setup();
    const text = buildTokenReport(ledger, "git@example.test:repo.git", "other");
    ledger.close();

    expect(text).toContain("https://example.test/other.git");
    expect(text).toContain("999");
  });

  it("returns a one-line empty state", () => {
    const root = mkdtempSync(join(tmpdir(), "token-report-empty-"));
    roots.push(root);
    const ledger = new AttributionDatabase(join(root, "stats.db"));
    expect(buildTokenReport(ledger, "/tmp/no-repo", "")).toBe("No attributed turns yet.");
    ledger.close();
  });
});
