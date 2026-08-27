import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = resolve(import.meta.dirname, "save-preflight.ts");

type Payload = Record<string, unknown> & {
  subject_candidates?: Array<{ name: string; status: string | null }>;
  suggested_subject?: string;
  subject?: { name: string; path: string; status: string | null; created: boolean };
};
type RunResult = { code: number; payload: Payload };

function fixture(git = true): { root: string; home: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "save-preflight-"));
  const home = join(root, "home");
  mkdirSync(home);
  if (git) execFileSync("git", ["init", "-q", "-b", "feature/x"], { cwd: root });
  return { root, home, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function run(root: string, home: string, args: string[] = []): RunResult {
  try {
    const stdout = execFileSync("bun", [SCRIPT, ...args], {
      cwd: root,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, HOME: home },
    });
    return { code: 0, payload: JSON.parse(stdout) };
  } catch (error) {
    const failure = error as { status?: number; stdout?: Buffer | string };
    return { code: failure.status ?? 1, payload: JSON.parse(String(failure.stdout)) };
  }
}

function context(root: string): string {
  const path = join(root, ".context");
  mkdirSync(path, { recursive: true });
  return path;
}

function subject(root: string, name: string, status: string, body = ""): string {
  const path = join(context(root), name);
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, "index.md"), `---\nstatus: ${status}\n---\n${body}`);
  return path;
}

describe("save-preflight", () => {
  it("returns structured failures for a non-repo and a missing .context", () => {
    const a = fixture(false);
    const b = fixture();
    try {
      expect(run(a.root, a.home)).toMatchObject({ code: 1, payload: { error: expect.any(String) } });
      expect(run(b.root, b.home)).toEqual({ code: 3, payload: { error: "no .context directory" } });
    } finally { a.cleanup(); b.cleanup(); }
  });

  it("reports ambiguity and lets --subject disambiguate", () => {
    const f = fixture();
    try {
      subject(f.root, "2026-08-20.alpha", "active");
      subject(f.root, "2026-08-21.beta", "active");
      const ambiguous = run(f.root, f.home);
      expect(ambiguous.code).toBe(2);
      expect(ambiguous.payload).toMatchObject({ error: "ambiguous subject" });
      expect(ambiguous.payload.suggested_subject).toMatch(/^\d{4}-\d{2}-\d{2}\.x$/);
      expect(ambiguous.payload.subject_candidates?.map((candidate) => candidate.name)).toEqual([
        "2026-08-21.beta", "2026-08-20.alpha",
      ]);
      const selected = run(f.root, f.home, ["--subject", "2026-08-21.beta", "--json"]);
      expect(selected.code).toBe(0);
      expect(selected.payload.subject).toMatchObject({ name: "2026-08-21.beta", status: "active", created: false });
    } finally { f.cleanup(); }
  });

  it("chooses the active subject while still listing completed subjects", () => {
    const f = fixture();
    try {
      subject(f.root, "2026-08-20.active", "active");
      subject(f.root, "2026-08-26.completed", "completed");
      const result = run(f.root, f.home);
      expect(result.code).toBe(0);
      expect(result.payload.subject.name).toBe("2026-08-20.active");
      expect(result.payload.subject_candidates).toEqual([
        { name: "2026-08-26.completed", status: "completed" },
        { name: "2026-08-20.active", status: "active" },
      ]);
    } finally { f.cleanup(); }
  });

  it("reports stale session hints without using them", () => {
    const f = fixture();
    try {
      subject(f.root, "2026-08-20.real", "active");
      const workflow = join(f.root, ".context/workflow");
      mkdirSync(workflow);
      writeFileSync(join(workflow, "current-session.json"), JSON.stringify({ started_at: "2026-08-26T10:00:00Z", subject: "stale", memory_file: "old.md" }));
      const hint = run(f.root, f.home).payload.session_hint;
      expect(hint).toMatchObject({ present: true, used: false, started_at: "2026-08-26T10:00:00Z", subject: "stale", memory_file: "old.md" });
      expect(hint.stale_reasons).toContain("no writer since the 2026-06-05 extension slim-down");
    } finally { f.cleanup(); }
  });

  it.each([
    ["- 2026-08-26 — [Title](x.md) — `completed`\n\n  - detail\n", "two-line"],
    ["- 2026-05-08 | `x.md` | domains: []\n", "single-line"],
    ["", "empty"],
  ])("classifies memory index shape", (contents, shape) => {
    const f = fixture();
    try {
      subject(f.root, "2026-08-20.x", "active");
      mkdirSync(join(f.root, ".context/memory"));
      writeFileSync(join(f.root, ".context/memory/index.md"), contents);
      expect(run(f.root, f.home).payload.memory_index.first_entry_shape).toBe(shape);
    } finally { f.cleanup(); }
  });

  it("reads hindsight backend and defaults missing config to null", () => {
    const f = fixture();
    try {
      subject(f.root, "2026-08-20.x", "active");
      let result = run(f.root, f.home).payload.memory_backend;
      expect(result).toMatchObject({ backend: null, expect_retain: false });
      const config = join(f.home, ".omp/agent/config.yml");
      mkdirSync(dirname(config), { recursive: true });
      writeFileSync(config, "memory:\n  backend: hindsight\n");
      result = run(f.root, f.home).payload.memory_backend;
      expect(result).toMatchObject({ backend: "hindsight", expect_retain: true });
    } finally { f.cleanup(); }
  });

  it("gathers artifacts and leaves fixture files unchanged", () => {
    const f = fixture();
    try {
      const dir = subject(f.root, "2026-08-20.work", "active");
      const plan = join(dir, "plan-work.md");
      const text = "---\nstatus: active\nmemory: [../memory/a.md]\n---\n# Plan\n\n## User Goal\n\n";
      writeFileSync(plan, text);
      const before = statSync(plan).mtimeMs;
      const payload = run(f.root, f.home).payload;
      expect(payload.user_goal.missing).toContain("plan-work.md");
      expect(payload.plans[0]).toMatchObject({ path: "plan-work.md", memory_ref_style: "yaml", memory_refs: ["../memory/a.md"] });
      expect(readFileSync(plan, "utf8")).toBe(text);
      expect(statSync(plan).mtimeMs).toBe(before);
    } finally { f.cleanup(); }
  });

  it("synthesizes a subject from the branch when no folders exist", () => {
    const f = fixture();
    try {
      context(f.root);
      const payload = run(f.root, f.home).payload;
      expect(payload.subject.created).toBe(true);
      expect(payload.subject.name).toMatch(/^\d{4}-\d{2}-\d{2}\.x$/);
      expect(payload.subject.path).toBe(`.context/${payload.subject.name}`);
    } finally { f.cleanup(); }
  });

  it("creates a missing --subject folder name instead of failing", () => {
    const f = fixture();
    try {
      subject(f.root, "2026-08-20.alpha", "active");
      const dated = run(f.root, f.home, ["--subject", "2026-08-26.b-save-improved"]);
      expect(dated.code).toBe(0);
      expect(dated.payload.subject).toMatchObject({
        name: "2026-08-26.b-save-improved",
        path: ".context/2026-08-26.b-save-improved",
        status: null,
        created: true,
      });
      const slugged = run(f.root, f.home, ["--subject", "b-save-improved"]);
      expect(slugged.code).toBe(0);
      expect(slugged.payload.subject).toMatchObject({
        name: expect.stringMatching(/^\d{4}-\d{2}-\d{2}\.b-save-improved$/),
        created: true,
      });
    } finally { f.cleanup(); }
  });
});
