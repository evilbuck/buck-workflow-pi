import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runApply } from "./save-apply.js";

const SCRIPT = resolve(import.meta.dirname, "save-apply.ts");
const LEGACY = "- 2026-05-08 | `b-grill-auto-2026-05-08.md` | domains: [tooling, orchestration] | topics: [grill-auto, rpc, pi-extension] | status: completed\n";

function write(root: string, path: string, text: string): void {
  const full = join(root, path);
  mkdirSync(resolve(full, ".."), { recursive: true });
  writeFileSync(full, text);
}

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    today: "2026-08-26",
    subject: { name: "2026-08-26.save", path: ".context/2026-08-26.save", create: false },
    memory: {
      path: ".context/memory/b-save-improved-2026-08-26.md",
      frontmatter: {
        date: "2026-08-26", domains: ["extensions", "tooling"], topics: ["b-save-improved", "determinism"],
        subject: "2026-08-26.save", artifacts: [], related: [], priority: "high", status: "completed",
      },
      title: "Deterministic b-save",
      body: "## What shipped\n\nDeterministic checkpoint.",
    },
    index_entry: { summary: "Deterministic b-save", status: "completed" },
    ...overrides,
  };
}

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "save-apply-"));
  write(root, ".context/memory/index.md", LEGACY);
  write(root, ".context/2026-08-26.save/index.md", "---\nstatus: active\n---\n\n# Save\n");
  return root;
}

function run(root: string, payload: unknown, args: string[] = []) {
  return JSON.parse(execFileSync("bun", [SCRIPT, ...args], {
    cwd: root, input: JSON.stringify(payload), encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"],
  }));
}

function backlog(root: string, related = "related:\n  - extensions/x.ts"): void {
  write(root, ".context/backlog/todo.md", "# Backlog\n\n- [ ] [X](items/x.md) — high priority\n\n## Later\n");
  write(root, ".context/backlog/items/x.md", `---\ntitle: X\nstatus: active\npriority: high\ncreated: 2026-08-01\nupdated: 2026-08-01\ncompleted: null\n${related}\n---\n\n# X\n`);
  write(root, ".context/backlog/archive/completed.md", "# Completed\n");
}

describe("save-apply", () => {
  it("prepends the exact normalized two-line index entry once and preserves the legacy line", () => {
    const root = fixture();
    try {
      const payload = basePayload();
      run(root, payload);
      const once = readFileSync(join(root, ".context/memory/index.md"), "utf8");
      const expected = "- 2026-08-26 — [Deterministic b-save](b-save-improved-2026-08-26.md) — `completed`\n\n  - 2026-08-26 | `b-save-improved-2026-08-26.md` | domains: [extensions, tooling] | topics: [b-save-improved, determinism] | status: completed\n";
      expect(once.startsWith(expected)).toBe(true);
      expect(once.split("\n").filter(Boolean).at(-1) + "\n").toBe(LEGACY);
      run(root, payload);
      expect(readFileSync(join(root, ".context/memory/index.md"), "utf8")).toBe(once);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("does not duplicate an index entry that is no longer first", () => {
    const root = fixture();
    try {
      const payload = basePayload();
      run(root, payload);
      const index = join(root, ".context/memory/index.md");
      writeFileSync(index, "- 2026-08-27 — [Later](later-2026-08-27.md) — `completed`\n\n" + readFileSync(index, "utf8"));
      run(root, payload);
      const text = readFileSync(index, "utf8");
      expect([...text.matchAll(/\[Deterministic b-save\]/g)]).toHaveLength(1);
      expect(text.startsWith("- 2026-08-27 — [Later](later-2026-08-27.md)")).toBe(true);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("enriches subject index frontmatter without clobbering an existing body", () => {
    const root = fixture();
    try {
      run(root, basePayload({ subject_index_status: "completed" }));
      const text = readFileSync(join(root, ".context/2026-08-26.save/index.md"), "utf8");
      expect(text).toContain("# Save");
      expect(text).toContain("topics: [b-save-improved, determinism]");
      expect(text).toContain("memory: [b-save-improved-2026-08-26.md]");
      expect(text).toContain("status: completed");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("fills an empty subject index body from memory sections", () => {
    const root = fixture();
    try {
      write(root, ".context/2026-08-26.save/index.md", "---\nstatus: active\n---\n");
      run(root, basePayload({
        subject_index_status: "completed",
        memory: {
          path: ".context/memory/b-save-improved-2026-08-26.md",
          frontmatter: {
            date: "2026-08-26", domains: ["extensions", "tooling"], topics: ["b-save-improved", "determinism"],
            subject: "2026-08-26.save", artifacts: [], related: [], priority: "high", status: "completed",
          },
          title: "Deterministic b-save",
          body: "## User Goal\n\nCheckpoint the session.\n\n## What shipped\n\nDeterministic checkpoint.\n\n## Verification\n\nbun test\n",
        },
      }));
      const text = readFileSync(join(root, ".context/2026-08-26.save/index.md"), "utf8");
      expect(text).toContain("# Deterministic b-save");
      expect(text).toContain("## User Goal");
      expect(text).toContain("Checkpoint the session.");
      expect(text).toContain("## What shipped");
      expect(text).toContain("## Verification");
      expect(text).toContain("Memory: `.context/memory/b-save-improved-2026-08-26.md`");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });


  it("appends a bold-line cross-reference idempotently", () => {
    const root = fixture();
    try {
      const path = ".context/2026-08-26.save/plan-x.md";
      write(root, path, "# Title\n\n**memory:** [../memory/a.md](../memory/a.md)\n");
      const payload = basePayload({ crossrefs: [{ path, key: "memory", value: "../memory/b.md" }] });
      run(root, payload);
      const once = readFileSync(join(root, path), "utf8");
      expect(once).toContain("**memory:** [../memory/a.md](../memory/a.md), [../memory/b.md](../memory/b.md)");
      run(root, payload);
      expect(readFileSync(join(root, path), "utf8")).toBe(once);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("archives an explicit backlog item and preserves block related style", () => {
    const root = fixture();
    try {
      backlog(root);
      run(root, basePayload({ backlog: { complete_explicit: [{ slug: "x", outcome: "Shipped." }], complete_inferred: [], new_items: [] } }));
      expect(readFileSync(join(root, ".context/backlog/todo.md"), "utf8")).not.toContain("items/x.md");
      expect(existsSync(join(root, ".context/backlog/items/x.md"))).toBe(false);
      const archived = readFileSync(join(root, ".context/backlog/archive/2026-08/x.md"), "utf8");
      expect(archived).toContain("status: completed");
      expect(archived).toContain("completed: 2026-08-26");
      expect(archived).toContain("related:\n  - extensions/x.ts");
      expect(readFileSync(join(root, ".context/backlog/archive/completed.md"), "utf8")).toMatch(/- \[x\] X \(2026-08-26\) — `2026-08-26\.save\/index\.md`\. Shipped\.\s*$/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("stages inferred completions unless --archive-inferred is passed", () => {
    const root = fixture();
    try {
      backlog(root);
      const payload = basePayload({ backlog: { complete_explicit: [], complete_inferred: [{ slug: "x", outcome: "Observed.", evidence: "x.ts:1" }], new_items: [] } });
      const staged = run(root, payload);
      expect(staged.staged_inferred).toEqual([expect.objectContaining({ slug: "x" })]);
      expect(readFileSync(join(root, ".context/backlog/todo.md"), "utf8")).toContain("items/x.md");
      expect(existsSync(join(root, ".context/backlog/items/x.md"))).toBe(true);
      run(root, payload, ["--archive-inferred"]);
      expect(readFileSync(join(root, ".context/backlog/todo.md"), "utf8")).not.toContain("items/x.md");
      expect(existsSync(join(root, ".context/backlog/archive/2026-08/x.md"))).toBe(true);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("preserves inline related style during backlog archival", () => {
    const root = fixture();
    try {
      backlog(root, "related: [extensions/x.ts, package.json]");
      run(root, basePayload({ backlog: { complete_explicit: [{ slug: "x", outcome: "Shipped." }], complete_inferred: [], new_items: [] } }));
      expect(readFileSync(join(root, ".context/backlog/archive/2026-08/x.md"), "utf8")).toContain("related: [extensions/x.ts, package.json]");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("dry-run reports intended actions without changing any files", () => {
    const root = fixture();
    try {
      backlog(root);
      const before = readFileSync(join(root, ".context/backlog/todo.md"), "utf8");
      const report = run(root, basePayload({
        backlog: { complete_explicit: [{ slug: "x", outcome: "Shipped." }], complete_inferred: [], new_items: [{ slug: "y", title: "Y", priority: "medium", related: [], body: "Later." }] },
        loose_artifacts: [".context/loose.md"],
      }), ["--dry-run"]);
      expect(report.applied.length).toBeGreaterThan(3);
      expect(readFileSync(join(root, ".context/backlog/todo.md"), "utf8")).toBe(before);
      expect(existsSync(join(root, ".context/memory/b-save-improved-2026-08-26.md"))).toBe(false);
      expect(existsSync(join(root, ".context/backlog/items/y.md"))).toBe(false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("lands auditor evidence under ## Verification and stays idempotent on re-run", () => {
    const root = fixture();
    try {
      const payload = basePayload({
        verification_evidence: [{ path: "spec-x.md", evidence: "extensions/a.ts:42 proves completion" }],
      });
      run(root, payload);
      const file = join(root, ".context/memory/b-save-improved-2026-08-26.md");
      const once = readFileSync(file, "utf8");
      expect(once).toContain("## Verification");
      expect(once).toContain("- `spec-x.md` — extensions/a.ts:42 proves completion");
      run(root, payload);
      const twice = readFileSync(file, "utf8");
      expect((twice.match(/extensions\/a\.ts:42/g) ?? []).length).toBe(1);
      expect((twice.match(/^## Verification$/gm) ?? []).length).toBe(1);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("inserts evidence inside an existing ## Verification section, creating it when the scribe omitted it", () => {
    const root = fixture();
    try {
      run(root, basePayload({
        memory: {
          path: ".context/memory/b-save-improved-2026-08-26.md",
          frontmatter: {
            date: "2026-08-26", domains: ["extensions"], topics: ["b-save-improved"],
            subject: "2026-08-26.save", artifacts: [], related: [], priority: "high", status: "completed",
          },
          title: "T",
          body: "## What shipped\n\nX.\n\n## Verification\n\nScribe line.\n\n## Related\n\n- none",
        },
        verification_evidence: [{ path: "spec-y.md", evidence: "skills/b.ts:7" }],
      }));
      const withSection = readFileSync(join(root, ".context/memory/b-save-improved-2026-08-26.md"), "utf8");
      expect(withSection).toMatch(/^## Verification\n\nScribe line\.\n\n- `spec-y\.md` — skills\/b\.ts:7$/m);
      expect(withSection).toContain("## Related\n\n- none");

      const root2 = fixture();
      try {
        run(root2, basePayload({
          memory: {
            path: ".context/memory/b-save-improved-2026-08-26.md",
            frontmatter: {
              date: "2026-08-26", domains: ["extensions"], topics: ["b-save-improved"],
              subject: "2026-08-26.save", artifacts: [], related: [], priority: "high", status: "completed",
            },
            title: "T",
            body: "## What shipped\n\nNo verification section.",
          },
          verification_evidence: [{ path: "spec-y.md", evidence: "skills/b.ts:7" }],
        }));
        const created = readFileSync(join(root2, ".context/memory/b-save-improved-2026-08-26.md"), "utf8");
        expect(created).toContain("## Verification\n\n- `spec-y.md` — skills/b.ts:7");
      } finally { rmSync(root2, { recursive: true, force: true }); }
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("appends missing sections to an existing subject index body without duplicating headings", () => {
    const root = fixture();
    try {
      write(root, ".context/2026-08-26.save/index.md", "---\nstatus: active\n---\n\n# Save\n\n## What shipped\n\nOld text.\n");
      run(root, basePayload({
        subject_index_status: "completed",
        memory: {
          path: ".context/memory/b-save-improved-2026-08-26.md",
          frontmatter: {
            date: "2026-08-26", domains: ["extensions", "tooling"], topics: ["b-save-improved", "determinism"],
            subject: "2026-08-26.save", artifacts: [], related: [], priority: "high", status: "completed",
          },
          title: "Deterministic b-save",
          body: "## User Goal\n\nG.\n\n## What shipped\n\nNew text.\n\n## Verification\n\nRan tests.\n",
        },
      }));
      const text = readFileSync(join(root, ".context/2026-08-26.save/index.md"), "utf8");
      expect((text.match(/^## What shipped$/gm) ?? []).length).toBe(1);
      expect(text).toContain("Old text.");
      expect(text).not.toContain("New text.");
      expect(text).toContain("## Verification");
      expect(text).toContain("Ran tests.");
      expect((text.match(/^## Related$/gm) ?? []).length).toBe(1);
      expect(text).toContain(`## Related\n\nMemory: \`.context/memory/b-save-improved-2026-08-26.md\``);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("back-fills spec memory links and plans entries from spec_plans, skipping missing specs", () => {
    const root = fixture();
    try {
      write(root, ".context/2026-08-26.save/spec-x.md", "---\nstatus: active\nplans: []\n---\n\n# S\n");
      const payload = basePayload({
        crossrefs: [{ path: ".context/2026-08-26.save/spec-x.md", key: "memory", value: "../memory/b-save-improved-2026-08-26.md" }],
        spec_plans: [{ spec: "spec-x.md", plan: "plan-x.md" }, { spec: "spec-gone.md", plan: "plan-x.md" }],
      });
      const report = run(root, payload);
      expect(report.errors).toEqual([]);
      const spec = readFileSync(join(root, ".context/2026-08-26.save/spec-x.md"), "utf8");
      expect(spec).toContain("memory: [../memory/b-save-improved-2026-08-26.md]");
      expect(spec).toContain("plans: [plan-x.md]");
      expect(report.applied).toContainEqual(expect.objectContaining({ path: "spec-gone.md", action: "skipped" }));
      run(root, payload);
      expect((readFileSync(join(root, ".context/2026-08-26.save/spec-x.md"), "utf8").match(/plan-x\.md/g) ?? []).length).toBe(1);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

describe("runApply in-process", () => {
  it("returns 2 on a schema mismatch", () => {
    expect(runApply({})).toBe(2);
  });

  it("archives, cross-refs, completes phases, and moves loose files", () => {
    const root = fixture();
    const prev = process.cwd();
    try {
      backlog(root);
      write(root, ".context/loose.md", "# loose\n");
      write(root, ".context/2026-08-26.save/plan-x.md", "# Plan\n\n**memory:** [../memory/a.md](../memory/a.md)\n");
      write(root, ".context/2026-08-26.save/phase-1.md", "---\nstatus: in-progress\nacceptance_criteria:\n  - \"[x] done\"\n---\n# P\n");
      write(root, ".context/2026-08-26.save/plan-x-phases.md", "## Phase Summary\n\n| Phase | Status | Difficulty | File |\n|---|---|---|---|\n| 1 | pending | easy | [phase-1.md](phase-1.md) |\n");
      write(root, ".context/2026-08-26.save/spec-x.md", "---\nstatus: active\n---\n# S\n");
      write(root, ".context/2026-08-26.save/iterate-x.md", "---\nstatus: active\naddresses: plan-x.md\n---\n# I\n");
      process.chdir(root);
      const code = runApply(basePayload({
        crossrefs: [{ path: ".context/2026-08-26.save/plan-x.md", key: "memory", value: "../memory/b-save-improved-2026-08-26.md" }],
        backlog: {
          complete_explicit: [{ slug: "x", outcome: "Shipped." }],
          complete_inferred: [{ slug: "nope", outcome: "maybe" }],
          new_items: [{ slug: "y", title: "Y", priority: "medium", related: ["a.ts"], body: "Later." }],
        },
        specs_complete: ["spec-x.md"],
        phases_complete: ["phase-1.md"],
        phase_table_fixes: [{ file: "phase-1.md", status: "completed" }],
        iterates_complete: [{ path: "iterate-x.md", addresses: "plan-x.md" }],
        loose_artifacts: [".context/loose.md"],
        subject_index_status: "completed",
      }));
      expect(code).toBe(0);
      expect(existsSync(join(root, ".context/backlog/archive/2026-08/x.md"))).toBe(true);
      expect(existsSync(join(root, ".context/2026-08-26.save/y.md"))).toBe(false);
      expect(existsSync(join(root, ".context/backlog/items/y.md"))).toBe(true);
      expect(existsSync(join(root, ".context/2026-08-26.save/loose.md"))).toBe(true);
      expect(readFileSync(join(root, ".context/2026-08-26.save/plan-x.md"), "utf8")).toContain("b-save-improved-2026-08-26.md");
    } finally {
      process.chdir(prev);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects backlog slugs that would write outside the items directory", () => {
    const root = fixture();
    const prev = process.cwd();
    const outside = resolve(root, "pwned.md");
    try {
      process.chdir(root);
      for (const slug of ["../pwned", "/tmp/pwned", "..", "HasCaps", "has spaces"]) {
        const code = runApply(basePayload({
          backlog: { complete_explicit: [], complete_inferred: [], new_items: [{ slug, title: "X", priority: "high", related: [], body: "nope" }] },
        }));
        expect(code).toBe(1);
      }
      expect(existsSync(outside)).toBe(false);
      expect(existsSync(join(root, ".context/pwned.md"))).toBe(false);
      expect(existsSync("/tmp/pwned.md")).toBe(false);
    } finally {
      process.chdir(prev);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a memory path that resolves outside .context", () => {
    const root = fixture();
    const prev = process.cwd();
    try {
      process.chdir(root);
      const code = runApply(basePayload({
        memory: {
          path: ".context/../escaped-memory.md",
          frontmatter: {
            date: "2026-08-26", domains: ["x"], topics: ["y"],
            subject: "2026-08-26.save", artifacts: [], related: [], priority: "high", status: "completed",
          },
          title: "T",
          body: "B",
        },
      }));
      expect(code).toBe(1);
      expect(existsSync(join(root, "escaped-memory.md"))).toBe(false);
    } finally {
      process.chdir(prev);
      rmSync(root, { recursive: true, force: true });
    }
  });


  it("refuses to write through a leaf symlink pointing outside .context", () => {
    const root = fixture();
    const prev = process.cwd();
    const outside = join(root, "outside.md");
    writeFileSync(outside, "secret\n");
    symlinkSync(outside, join(root, ".context/memory/b-save-improved-2026-08-26.md"));
    try {
      process.chdir(root);
      expect(runApply(basePayload())).toBe(1);
      expect(readFileSync(outside, "utf8")).toBe("secret\n");
    } finally {
      process.chdir(prev);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses to rename a loose artifact that is a leaf symlink", () => {
    const root = fixture();
    const prev = process.cwd();
    const outside = join(root, "secret.md");
    writeFileSync(outside, "secret\n");
    symlinkSync(outside, join(root, ".context/plan-orphan.md"));
    try {
      process.chdir(root);
      expect(runApply(basePayload({ loose_artifacts: [".context/plan-orphan.md"] }))).toBe(1);
      expect(readFileSync(outside, "utf8")).toBe("secret\n");
      expect(existsSync(join(root, ".context/2026-08-26.save/plan-orphan.md"))).toBe(false);
    } finally {
      process.chdir(prev);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a new file when its parent directory is a symlink outside .context", () => {
    const root = fixture();
    const prev = process.cwd();
    const outsideDir = join(root, "outside-mem");
    mkdirSync(outsideDir);
    rmSync(join(root, ".context/memory"), { recursive: true, force: true });
    symlinkSync(outsideDir, join(root, ".context/memory"));
    try {
      process.chdir(root);
      expect(runApply(basePayload())).toBe(1);
      expect(existsSync(join(outsideDir, "b-save-improved-2026-08-26.md"))).toBe(false);
    } finally {
      process.chdir(prev);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("skips a new backlog item whose slug already exists", () => {
    const root = fixture();
    const prev = process.cwd();
    write(root, ".context/backlog/todo.md", "# Backlog\n\n- [ ] [Y](items/y.md) — medium priority\n");
    write(root, ".context/backlog/items/y.md", "---\ntitle: Y\nstatus: active\n---\n\n# Y\n\nORIGINAL\n");
    try {
      process.chdir(root);
      expect(runApply(basePayload({
        backlog: { complete_explicit: [], complete_inferred: [], new_items: [{ slug: "y", title: "Y", priority: "medium", related: [], body: "Later." }] },
      }))).toBe(0);
      expect(readFileSync(join(root, ".context/backlog/items/y.md"), "utf8")).toContain("ORIGINAL");
      expect(readFileSync(join(root, ".context/backlog/items/y.md"), "utf8")).not.toContain("Later.");
    } finally {
      process.chdir(prev);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps scalar frontmatter lists when merging memory", () => {
    const root = fixture();
    const prev = process.cwd();
    write(root, ".context/memory/b-save-improved-2026-08-26.md", `---
date: 2026-08-26
domains: [extensions]
topics: determinism
subject: 2026-08-26.save
artifacts: []
related: []
priority: high
status: completed
---

# Deterministic b-save

Prior body.
`);
    try {
      process.chdir(root);
      expect(runApply(basePayload())).toBe(0);
      const topics = readFileSync(join(root, ".context/memory/b-save-improved-2026-08-26.md"), "utf8")
        .split("\n")
        .find((line) => line.startsWith("topics:"));
      expect(topics).toContain("determinism");
      expect(topics).toContain("b-save-improved");
    } finally {
      process.chdir(prev);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
