import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { query, end, runJev } = vi.hoisted(() => ({
  query: vi.fn(),
  end: vi.fn(),
  runJev: vi.fn(),
}));

vi.mock("../../sql-memory/db.js", () => ({ createLazyPool: () => () => ({ query, end }) }));
vi.mock("../../jev-tool/index.js", () => ({ runJev }));
vi.mock("../../typed-output/evaluator.js", () => ({ createTypeSafeEvaluator: vi.fn() }));

import { recallProjectMemories } from "../project-memory.js";

let cwd: string;
let stage: string;

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "project-memory-"));
  execFileSync("git", ["init", "-q"], { cwd });
  git("config", "user.email", "agent@example.test");
  git("config", "user.name", "Test Agent");
  writeFileSync(join(cwd, "tracked"), "tracked\n");
  git("add", "tracked");
  git("commit", "-qm", "initial");
  git("remote", "add", "origin", "https://user:secret@example.test/acme/project.git");
  stage = ".context/phase.md";
  writeFileSync(join(cwd, "tracked"), "phase search terms\n");
  query.mockReset();
  query.mockResolvedValue({ rows: [] });
  end.mockReset();
  end.mockResolvedValue(undefined);
  runJev.mockReset();
  delete process.env.SQL_MEMORY_URL;
});

afterEach(() => {
  delete process.env.SQL_MEMORY_URL;
  rmSync(cwd, { recursive: true, force: true });
});

describe("project memory recall", () => {
  it("distinguishes unavailable configuration from a successful empty active-project shortlist", async () => {
    await expect(recallProjectMemories(cwd, stage)).resolves.toEqual({ kind: "unavailable" });

    process.env.SQL_MEMORY_URL = "postgres://unused";
    const result = await recallProjectMemories(cwd, stage);

    expect(result.kind).toBe("success-empty");
    if (result.kind === "success-empty") {
      expect(result.identity.project).toBe("https://example.test/acme/project.git");
      expect(result.identity.branch).toMatch(/master|main/);
      expect(result.identity.sha).toMatch(/[0-9a-f]{40}/);
    }
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[1]).toEqual([
      "https://example.test/acme/project.git",
      "Buck-loop project memory",
    ]);
    expect(query.mock.calls[0]?.[0]).toContain("m.invalid_at IS NULL");
    expect(query.mock.calls[0]?.[0]).toContain("LIMIT 8");
    expect(query.mock.calls[0]?.[0]).toContain("plainto_tsquery");
    expect(query.mock.calls[0]?.[0]).not.toContain("plaintext_to_tsquery");
    expect(end).toHaveBeenCalledOnce();
  });

  it("judges each shortlist candidate via noul and preserves SQL order on Jev errors", async () => {
    process.env.SQL_MEMORY_URL = "postgres://unused";
    query.mockResolvedValue({ rows: [
      { id: "memory-a", body: "first", category: "decision", project: "origin", branch_name: "one", commit_sha: "a".repeat(40) },
      { id: "memory-b", body: "second", category: "pitfall", project: "origin", branch_name: "two", commit_sha: "b".repeat(40) },
    ] });
    runJev.mockResolvedValue({ details: { answers: {
      relevant_memory_a: { type: "noul", noul: 0.85 },
      relevant_memory_b: { type: "noul", noul: 0.4 },
    } } });

    const result = await recallProjectMemories(cwd, stage);

    expect(result.kind).toBe("success-rows");
    if (result.kind === "success-rows") {
      expect(result.rows.map((row) => row.id)).toEqual(["memory-a"]);
    }
    expect(runJev.mock.calls[0]?.[1]).toMatchObject({
      questions: {
        relevant_memory_a: { type: "noul" },
        relevant_memory_b: { type: "noul" },
      },
    });
    expect(end).toHaveBeenCalledOnce();
  });

  it("returns multiple relevant memories ordered by noul, ties broken by id", async () => {
    process.env.SQL_MEMORY_URL = "postgres://unused";
    query.mockResolvedValue({ rows: [
      { id: "memory-a", body: "first", category: "decision", project: "origin", branch_name: "one", commit_sha: "a".repeat(40) },
      { id: "memory-b", body: "second", category: "pitfall", project: "origin", branch_name: "two", commit_sha: "b".repeat(40) },
      { id: "memory-c", body: "third", category: "convention", project: "origin", branch_name: "three", commit_sha: "c".repeat(40) },
    ] });
    runJev.mockResolvedValue({ details: { answers: {
      relevant_memory_a: { type: "noul", noul: 0.75 },
      relevant_memory_b: { type: "noul", noul: 0.95 },
      relevant_memory_c: { type: "noul", noul: 0.3 },
    } } });

    const result = await recallProjectMemories(cwd, stage);

    expect(result.kind).toBe("success-rows");
    if (result.kind === "success-rows") {
      expect(result.rows.map((row) => row.id)).toEqual(["memory-b", "memory-a"]);
    }
  });

  it("rejects an invented candidate ID by returning the deterministic shortlist", async () => {
    process.env.SQL_MEMORY_URL = "postgres://unused";
    query.mockResolvedValue({ rows: [
      { id: "memory-a", body: "first", category: "decision", project: "origin", branch_name: "one", commit_sha: "a".repeat(40) },
      { id: "memory-b", body: "second", category: "pitfall", project: "origin", branch_name: "two", commit_sha: "b".repeat(40) },
    ] });
    runJev.mockResolvedValue({ details: { answers: {
      relevant_memory_a: { type: "noul", noul: 0.9 },
      relevant_memory_b: { type: "noul", noul: 0.8 },
      relevant_invented_id: { type: "noul", noul: 0.95 },
    } } });

    const result = await recallProjectMemories(cwd, stage);

    expect(result.kind).toBe("success-rows");
    if (result.kind === "success-rows") {
      expect(result.rows.map((row) => row.id).sort()).toEqual(["memory-a", "memory-b"]);
    }
  });

  it("keeps the deterministic shortlist when Jev fails and skips Jev for a single candidate", async () => {
    process.env.SQL_MEMORY_URL = "postgres://unused";
    const rows = [
      { id: "only-memory", body: "candidate", category: "decision", project: "origin", branch_name: "branch", commit_sha: "c".repeat(40) },
    ];
    query.mockResolvedValue({ rows });

    const one = await recallProjectMemories(cwd, stage);
    expect(one.kind).toBe("success-rows");
    if (one.kind === "success-rows") expect(one.rows.map((row) => row.id)).toEqual(["only-memory"]);
    expect(runJev).not.toHaveBeenCalled();

    query.mockResolvedValue({ rows: [...rows, { ...rows[0], id: "second-memory" }] });
    runJev.mockRejectedValue(new Error("Jev unavailable"));
    const multiple = await recallProjectMemories(cwd, stage);

    expect(multiple.kind).toBe("success-rows");
    if (multiple.kind === "success-rows") {
      expect(multiple.rows.map((row) => row.id).sort()).toEqual(["only-memory", "second-memory"]);
    }
  });

  it("reports SQL errors as failures rather than empty matches", async () => {
    process.env.SQL_MEMORY_URL = "postgres://unused";
    query.mockRejectedValue(new Error("database unavailable"));

    const result = await recallProjectMemories(cwd, stage);
    expect(result.kind).toBe("failure");
    if (result.kind === "failure") {
      expect(result.reason).toContain("query failed (not an empty result)");
      expect(result.reason).toContain("database unavailable");
    }
  });

  it("reports identity-missing when neither origin nor common dir can be read", async () => {
    rmSync(join(cwd, ".git"), { recursive: true, force: true });
    process.env.SQL_MEMORY_URL = "postgres://unused";

    const result = await recallProjectMemories(cwd, stage);
    expect(result.kind).toBe("identity-missing");
    if (result.kind === "identity-missing") {
      expect(result.reason).toMatch(/project identity could not be established/);
    }
  });

  it("uses an absolute common git directory when origin cannot be read", async () => {
    git("remote", "remove", "origin");
    process.env.SQL_MEMORY_URL = "postgres://unused";

    await recallProjectMemories(cwd, stage);

    expect(query.mock.calls[0]?.[1]?.[0]).toBe(git("rev-parse", "--path-format=absolute", "--git-common-dir"));
  });
});
