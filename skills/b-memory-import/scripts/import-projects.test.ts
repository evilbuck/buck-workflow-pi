#!/usr/bin/env bun
// skills/b-memory-import/scripts/import-projects.test.ts
//
// Smoke tests for the multi-project wrapper. No network. No real Hindsight.
// Run with: bun test skills/b-memory-import/scripts/import-projects.test.ts
//
// Validates:
//   1. CLI parsing (defaults, include/exclude/all, pass-through)
//   2. Discovery: single-project root vs multi-project root
//   3. matchProjects: include / exclude / all
//   4. End-to-end: a temp project with one memory file -> dry-run inner
//      script reports it (we don't hit the network; --dry-run short-
//      circuits in the inner script before any HTTP call)

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "bun";
import { parseArgs } from "./import-projects.ts";

const HERE = import.meta.dir;
const SKILL_DIR = resolve(HERE, "..");

const WRAPPER = join(HERE, "import-projects.ts");

async function runWrapper(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const xdgTmp = mkdtempSync(join(tmpdir(), "imp-xdg-"));
  try {
    const proc = spawn({
      cmd: ["bun", WRAPPER, ...args],
      cwd: cwd ?? process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, HINDSIGHT_API_TOKEN: "test-token", XDG_CONFIG_HOME: xdgTmp },
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { stdout, stderr, exitCode };
  } finally {
    rmSync(xdgTmp, { recursive: true, force: true });
  }
}

interface Summary {
  inner_script: string;
  inner_script_exists: boolean;
  roots: string[];
  mode: "include" | "exclude" | "all";
  projects_requested: number;
  projects_discovered: number;
  projects_matched: number;
  projects_skipped_no_memory: number;
  results: Array<{
    root: string;
    label: string;
    status: "ok" | "dry-run" | "error";
    scanned?: number;
    planned?: number;
    imported?: number;
    failed?: number;
    skipped_unchanged?: number;
    error?: string;
  }>;
  totals: {
    scanned: number;
    planned: number;
    imported: number;
    failed: number;
    skipped_unchanged: number;
    duration_ms: number;
  };
}

function makeMemoryFile(dir: string, name: string, date: string, title: string): void {
  writeFileSync(
    join(dir, name),
    `---
date: ${date}
domains: [test]
topics: [smoke]
status: completed
---

# ${title}

Smoke test memory file.
`,
    "utf-8",
  );
}

describe("parseArgs", () => {
  test("repeated --source-dirs flags append, they do not replace", () => {
    const a = parseArgs([
      "--source-dirs", ".context/memory",
      "--source-dirs", ".context/backlog/items",
    ]);
    expect(a.sourceDirs).toEqual([".context/memory", ".context/backlog/items"]);
  });

  test("comma list and a second --source-dirs both land", () => {
    const a = parseArgs([
      "--source-dirs", ".context/memory,.context/backlog/items",
      "--source-dirs", ".context/memory",
    ]);
    expect(a.sourceDirs).toEqual([
      ".context/memory",
      ".context/backlog/items",
      ".context/memory",
    ]);
  });

  test("rejects non-finite, non-integer, or <1 --concurrency", () => {
    for (const value of ["NaN", "Infinity", "-Infinity", "0", "-1", "1.5", "foo", ""]) {
      expect(() => parseArgs(["--concurrency", value])).toThrow(/--concurrency must be a finite integer >= 1/);
    }
  });

  test("accepts integer --concurrency >= 1", () => {
    expect(parseArgs(["--concurrency", "1"]).concurrency).toBe(1);
    expect(parseArgs(["--concurrency", "4"]).concurrency).toBe(4);
  });

  test("greedy flags consume every following non-flag value", () => {
    const a = parseArgs(["--root", "/tmp/a", "/tmp/b", "--include", "alpha", "beta"]);
    expect(a.roots).toEqual(["/tmp/a", "/tmp/b"]);
    expect(a.mode).toBe("include");
    expect(a.projects).toEqual(["alpha", "beta"]);
  });

  test("a greedy flag with no following value is a usage error", () => {
    expect(() => parseArgs(["--root"])).toThrow("missing value for --root");
    expect(() => parseArgs(["--include", "--all"])).toThrow("missing value for --include");
  });

  test("single-value flags take exactly the next token", () => {
    const a = parseArgs(["--api-url", "http://h", "--bank-id", "omp"]);
    expect(a.apiUrl).toBe("http://h");
    expect(a.bankId).toBe("omp");
    expect(() => parseArgs(["--api-url"])).toThrow("missing value for --api-url");
  });

  test("--limit accepts a non-negative number and rejects the rest", () => {
    expect(parseArgs(["--limit", "3"]).limit).toBe(3);
    expect(() => parseArgs(["--limit", "-1"])).toThrow("--limit must be a non-negative number");
    expect(() => parseArgs(["--limit", "foo"])).toThrow("--limit must be a non-negative number");
  });

  test("unknown flags pass through to the child script", () => {
    const a = parseArgs(["--frobnicate", "--api-url", "u"]);
    expect(a.childArgs).toEqual(["--frobnicate"]);
  });
});

describe("import-projects.ts", () => {
  test("--help exits 0 and prints usage", async () => {
    const { stdout, exitCode } = await runWrapper(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("--include");
  });

  test("inner_script_exists reports true when sibling b-memory-import is present", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "imp-"));
    try {
      const sub = join(tmp, "demo");
      mkdirSync(join(sub, ".context", "memory"), { recursive: true });
      makeMemoryFile(join(sub, ".context", "memory"), "a.md", "2026-08-16", "Alpha");
      makeMemoryFile(join(sub, ".context", "memory"), "b.md", "2026-08-16", "Beta");
      const { stdout, exitCode } = await runWrapper([
        "--root", sub,
        "--all",
        "--dry-run",
      ]);
      expect(exitCode).toBe(0);
      const j = JSON.parse(stdout) as Summary;
      expect(j.inner_script_exists).toBe(true);
      expect(j.mode).toBe("all");
      expect(j.projects_discovered).toBe(1);
      expect(j.projects_matched).toBe(1);
      expect(j.results).toHaveLength(1);
      expect(j.results[0].label).toBe("demo");
      expect(j.results[0].status).toBe("dry-run");
      expect(j.results[0].scanned).toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("--include filters by basename", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "imp-"));
    try {
      for (const name of ["alpha", "beta", "gamma"]) {
        const sub = join(tmp, name);
        mkdirSync(join(sub, ".context", "memory"), { recursive: true });
        makeMemoryFile(join(sub, ".context", "memory"), "m.md", "2026-08-16", "T");
      }
      const { stdout } = await runWrapper([
        "--root", tmp,
        "--include", "alpha",
        "--include", "gamma",
        "--dry-run",
      ]);
      const j = JSON.parse(stdout) as Summary;
      expect(j.projects_discovered).toBe(3);
      expect(j.projects_matched).toBe(2);
      const labels = j.results.map((r) => r.label).sort();
      expect(labels).toEqual(["alpha", "gamma"]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("--exclude drops named projects", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "imp-"));
    try {
      for (const name of ["a", "b", "c"]) {
        const sub = join(tmp, name);
        mkdirSync(join(sub, ".context", "memory"), { recursive: true });
        makeMemoryFile(join(sub, ".context", "memory"), "m.md", "2026-08-16", "T");
      }
      const { stdout } = await runWrapper([
        "--root", tmp,
        "--exclude", "b",
        "--dry-run",
      ]);
      const j = JSON.parse(stdout) as Summary;
      expect(j.projects_matched).toBe(2);
      const labels = j.results.map((r) => r.label).sort();
      expect(labels).toEqual(["a", "c"]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("single-project root: <root>/.context/memory is the project", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "imp-"));
    try {
      mkdirSync(join(tmp, ".context", "memory"), { recursive: true });
      makeMemoryFile(join(tmp, ".context", "memory"), "x.md", "2026-08-16", "X");
      const { stdout } = await runWrapper([
        "--root", tmp,
        "--all",
        "--dry-run",
      ]);
      const j = JSON.parse(stdout) as Summary;
      expect(j.projects_discovered).toBe(1);
      expect(j.results[0].label).toBe(join(tmp).split("/").pop());
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("totals aggregate correctly", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "imp-"));
    try {
      for (const [name, n] of [["p1", 2], ["p2", 3]] as const) {
        const sub = join(tmp, name);
        mkdirSync(join(sub, ".context", "memory"), { recursive: true });
        for (let i = 0; i < n; i++) {
          makeMemoryFile(join(sub, ".context", "memory"), `f${i}.md`, "2026-08-16", `F${i}`);
        }
      }
      const { stdout } = await runWrapper([
        "--root", tmp,
        "--all",
        "--dry-run",
      ]);
      const j = JSON.parse(stdout) as Summary;
      expect(j.projects_discovered).toBe(2);
      expect(j.projects_matched).toBe(2);
      expect(j.totals.scanned).toBe(0);
      expect(j.totals.planned).toBe(0);
      expect(j.totals.imported).toBe(0); // dry-run
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("no matching projects -> still valid JSON, exit 0", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "imp-"));
    try {
      // No memory dir anywhere
      mkdirSync(join(tmp, "empty"));
      const { stdout, exitCode } = await runWrapper([
        "--root", tmp,
        "--all",
        "--dry-run",
      ]);
      expect(exitCode).toBe(0);
      const j = JSON.parse(stdout) as Summary;
      expect(j.projects_matched).toBe(0);
      expect(j.results).toHaveLength(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("bad flag -> exit 1", async () => {
    const { exitCode, stderr } = await runWrapper(["--limit", "not-a-number"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("--limit");
  });

  test("--source-dirs forwards memory + backlog, both kinds appear in results", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "imp-"));
    try {
      const projRoot = join(tmp, "demo");
      mkdirSync(join(projRoot, ".context", "memory"), { recursive: true });
      mkdirSync(join(projRoot, ".context", "backlog", "items"), { recursive: true });
      makeMemoryFile(join(projRoot, ".context", "memory"), "m.md", "2026-08-16", "M");
      writeFileSync(
        join(projRoot, ".context", "backlog", "items", "b.md"),
        "---\ntitle: B\nstatus: active\npriority: low\n---\n# B\n",
      );
      const { stdout, exitCode } = await runWrapper([
        "--root", tmp,
        "--include", "demo",
        "--source-dirs", ".context/memory,.context/backlog/items",
        "--dry-run",
      ]);
      expect(exitCode).toBe(0);
      const j = JSON.parse(stdout) as Summary;
      expect(j.projects_matched).toBe(1);
      const result = j.results[0] as any;
      expect(result.status).toBe("dry-run");
      expect(result.raw.source_dirs).toEqual([".context/memory", ".context/backlog/items"]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("two separate --source-dirs flags scan both directories", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "imp-"));
    try {
      const projRoot = join(tmp, "demo");
      mkdirSync(join(projRoot, ".context", "memory"), { recursive: true });
      mkdirSync(join(projRoot, ".context", "backlog", "items"), { recursive: true });
      makeMemoryFile(join(projRoot, ".context", "memory"), "m.md", "2026-08-16", "M");
      writeFileSync(
        join(projRoot, ".context", "backlog", "items", "b.md"),
        "---\ntitle: B\nstatus: active\npriority: low\n---\n# B\n",
      );
      const { stdout, exitCode } = await runWrapper([
        "--root", tmp,
        "--include", "demo",
        "--source-dirs", ".context/memory",
        "--source-dirs", ".context/backlog/items",
        "--dry-run",
      ]);
      expect(exitCode).toBe(0);
      const j = JSON.parse(stdout) as Summary;
      const result = j.results[0] as any;
      expect(result.status).toBe("dry-run");
      expect(result.raw.source_dirs).toEqual([".context/memory", ".context/backlog/items"]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("invalid --concurrency exits 1", async () => {
    const { exitCode, stderr } = await runWrapper(["--concurrency", "Infinity"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("--concurrency");
  });
});
