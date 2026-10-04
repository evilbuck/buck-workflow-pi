import { afterEach, describe, expect, it } from "vitest";
import { validateToolArguments } from "@mariozechner/pi-ai";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { sqlMemoryTool } from "./index.js";
import type { MigrationPool } from "./migrations.js";

const cleanupDirs: string[] = [];
function mkdirPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "remember-test-"));
  execFileSync("git", ["init", "-q", "--initial-branch=main"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "you@example.test"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "you"], { cwd: dir });
  execFileSync("git", ["remote", "add", "origin", "git@github.com:acme/project.git"], { cwd: dir });
  execFileSync("git", ["commit", "--allow-empty", "-q", "-m", "init"], { cwd: dir });
  cleanupDirs.push(dir);
  return dir;
}

afterEach(() => { for (const d of cleanupDirs) rmSync(d, { recursive: true, force: true }); cleanupDirs.length = 0; });
function queryErrorPool(error: Error): MigrationPool {
  return {
    async query() { return { rows: [] }; },
    async connect() {
      return {
        async query(text: string) {
          if (text === "BEGIN" || text === "ROLLBACK" || text.startsWith("SET ")) return { rows: [] };
          throw error;
        },
        release() {},
      };
    },
  };
}


function rememberPool(activeSlugs: string[] = ["project", "decision"]): MigrationPool {
  const identity = Object.freeze({ email: "you@example.test", origin: "git@github.com:acme/project.git", branch: "main", commit: "298c503bb9edb4fa87c26cb7f7d1fda99643e66fd1" });
  return {
    async query(text) {
      if (text.includes("FROM categories")) return { rows: activeSlugs.map((slug) => ({ slug })) };
      if (text.startsWith("INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING")) {
        return { rows: [{ email: identity.email }] };
      }
      if (text.startsWith("INSERT INTO projects")) return { rows: [] };
      if (text.startsWith("SELECT id::text AS id FROM projects WHERE origin_url")) return { rows: [{ id: "00000000-0000-4000-8000-000000000001" }] };
      if (text.startsWith("SELECT m.id::text AS id FROM memories m JOIN projects p ON p.id = m.project")) {
        if (text.includes("m.context @>")) return { rows: [] };
        if (text.includes("$2")) return { rows: [{ id: "00000000-0000-4000-8000-000000000010" }] };
        return { rows: [] };
      }
      if (text.startsWith("SELECT coalesce(max(seq), 0)::bigint")) return { rows: [{ bigint: 4 }] };
      if (text.startsWith("INSERT INTO memories (author, project, branch_name, commit_sha, body, context, category, seq) VALUES")) {
        return { rows: [{ id: "00000000-0000-4000-8000-000000000010" }] };
      }
      return { rows: [] };
    },
    async connect() { throw new Error("connect should not run"); },
  };
}

describe("sqlMemoryTool remember op", () => {
  it.each([
    {},
    { op: "sql" },
    { op: "sql", body: "fact", subject: "subject-a" },
    { op: "remember", statement: "SELECT 1" },
    { op: "remember", body: "fact" },
    { op: "remember", body: "", subject: "subject-a" },
    { op: "correct", project: "project-a", previousId: "id" },
  ])("rejects incomplete operation arguments before database access: %j", params => {
    const tool = sqlMemoryTool(rememberPool(), "save");
    expect(() => validateToolArguments(tool, { type: "toolCall", id: "call", name: tool.name, arguments: params })).toThrow();
  });

  it("denies remember in recall role with a recall-protocol fix", async () => {
    const tool = sqlMemoryTool(rememberPool(), "recall", undefined, "/cwd");
    const result = await tool.execute("call", {
      op: "remember", body: "fact", subject: "subject-a",
    }, undefined, undefined, {} as never);
    const details = result.details as { error?: boolean; message?: string; fix?: string };
    expect(details.error).toBe(true);
    expect(details.message).toContain("recall role");
    expect(details.fix).toBe("Use the recall protocol.");
    expect(details.fix).not.toContain("remember");
  });

  it("calls remember and returns the id and a write notice", async () => {
    const cwdSpy = mkdirPath();
    const tool = sqlMemoryTool(rememberPool(), undefined, undefined, cwdSpy);
    const result = await tool.execute("call", {
      op: "remember", body: "fact", subject: "subject-a",
    }, undefined, undefined, {} as never);
    const details = result.details as { id?: string; notice?: string; error?: boolean; message?: string };
    expect(details.error).toBeUndefined();
    expect(details.id).toBe("00000000-0000-4000-8000-000000000010");
    expect(details.notice).toContain("Memory wrote");
  });

  it("attaches a fix on a gate denial instead of the fixed `operation not allowed` string", async () => {
    const pool: MigrationPool = {
      async query() { return { rows: [] }; },
      async connect() { throw new Error("connect should not run"); },
    };
    const tool = sqlMemoryTool(pool, "recall");
    const result = await tool.execute("call", {
      op: "sql", statement: "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'",
    }, undefined, undefined, {} as never);
    const details = result.details as { error?: boolean; fix?: string; message?: string };
    expect(details.error).toBe(true);
    expect(details.message).toMatch(/non-public/i);
    expect(details.fix).toContain("Schema inspection is denied");
    expect(details.fix).toContain("remember");
  });

  it("returns the users column fix when SELECT u.id fails", async () => {
    const error = Object.assign(new Error("column u.id does not exist"), { code: "42703", column: "id" });
    const tool = sqlMemoryTool(queryErrorPool(error));
    const result = await tool.execute("call", {
      op: "sql", statement: "SELECT u.id FROM users",
    }, undefined, undefined, {} as never);
    const details = result.details as { error?: boolean; fix?: string; code?: string; column?: string };
    expect(details.error).toBe(true);
    expect(details.fix).toContain("users has no id");
    expect(details.fix).toContain("email");
    expect(details.fix).toContain("skill_weight");
    expect(details.code).toBe("42703");
    expect(details.column).toBe("id");
  });

  it("returns the uuid-cast fix when a literal is cast to text", async () => {
    const error = Object.assign(new Error("operator does not exist: uuid = text"), { code: "42883", hint: "No operator matches the given name and argument types." });
    const tool = sqlMemoryTool(queryErrorPool(error));
    const result = await tool.execute("call", {
      op: "sql", statement: "SELECT * FROM memories WHERE project = '<uuid>'::text",
    }, undefined, undefined, {} as never);
    const details = result.details as { error?: boolean; fix?: string; code?: string; hint?: string };
    expect(details.error).toBe(true);
    expect(details.fix).toContain("never cast the literal to text");
    expect(details.code).toBe("42883");
    expect(details.hint).toContain("No operator matches");
  });

  it("returns current active category slugs in the fix without requiring a model query", async () => {
    const tool = sqlMemoryTool(rememberPool(["new-active"]), undefined, undefined, mkdirPath());
    const result = await tool.execute("call", {
      op: "remember", body: "fact", subject: "subject-a", category: "not-a-slug",
    }, undefined, undefined, {} as never);
    const details = result.details as { error?: boolean; fix?: string; message?: string };
    expect(details.error).toBe(true);
    expect(details.message).toContain("active category");
    expect(details.fix).toContain("new-active");
    expect(details.fix).not.toContain("project");
    expect(details.fix).not.toContain("SELECT");
  });

  it("fails closed when no categories are active", async () => {
    const tool = sqlMemoryTool(rememberPool([]), undefined, undefined, mkdirPath());
    const result = await tool.execute("call", {
      op: "remember", body: "fact", subject: "subject-a",
    }, undefined, undefined, {} as never);
    const details = result.details as { error?: boolean; fix?: string };
    expect(details.error).toBe(true);
    expect(details.fix).toContain("No active category slugs");
  });
});