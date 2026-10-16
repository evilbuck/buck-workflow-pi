import { describe, expect, it } from "vitest";
import { buildTokenReport } from "../report.js";
import { fixture, openLedger, record } from "./fixtures.js";

async function setup() {
  const { root } = fixture();
  const ledger = openLedger();
  const base = record(root, { entryKey: "one", branch: "main", totalTokens: 150, costUsd: 0.01 });
  await ledger.insert(base);
  await ledger.insert({ ...base, entryKey: "two", branch: "feature/a", provider: "anthropic", model: "claude", totalTokens: 250, costUsd: 0.02 });
  await ledger.insert({ ...base, entryKey: "three", projectKey: "https://example.test/other.git", branch: "main", totalTokens: 999, costUsd: 0.5 });
  return { ledger, root };
}

describe("buildTokenReport", () => {
  it("prints current-project totals grouped by branch and provider/model", async () => {
    const { ledger, root } = await setup();
    const text = await buildTokenReport(ledger, root, "git@example.test:repo.git", "");
    expect(text).toContain("git@example.test:repo.git");
    expect(text).toContain("400 tokens");
    expect(text).toContain("Estimated cost: $0.0300");
    expect(text).toMatch(/feature\/a\s+250/);
    expect(text).toMatch(/main\s+150/);
    expect(text).toMatch(/anthropic\/claude\s+250/);
    expect(text).not.toContain("999");
  });

  it("filters an exact current-project branch before considering project substrings", async () => {
    const { ledger, root } = await setup();
    const text = await buildTokenReport(ledger, root, "git@example.test:repo.git", "feature/a");
    expect(text).toContain("Branch: feature/a");
    expect(text).toContain("250 tokens");
    expect(text).not.toMatch(/main\s+150/);
  });

  it("lists case-insensitive matching projects when the argument is not a current-project branch", async () => {
    const { ledger, root } = await setup();
    const text = await buildTokenReport(ledger, root, "git@example.test:repo.git", "OTHER");
    expect(text).toContain("https://example.test/other.git");
    expect(text).toContain("999");
  });

  it("preserves unavailable cost and literal project substring matching", async () => {
    const { root } = fixture();
    const ledger = openLedger();
    await ledger.insert(record(root, { projectKey: "repo_%", costUsd: null, costSource: "none" }));
    expect(await buildTokenReport(ledger, root, "repo_%", "")).toContain("Estimated cost: unavailable");
    expect(await buildTokenReport(ledger, root, "repo_%", "_%")).toContain("repo_%");
    expect(await buildTokenReport(ledger, root, "repo_%", "missing")).toBe("No attributed turns yet.");
  });

  it("returns a one-line empty state", async () => {
    const { root } = fixture();
    expect(await buildTokenReport(openLedger(), root, "no-repo", "")).toBe("No attributed turns yet.");
  });
});
