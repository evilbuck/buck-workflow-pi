import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  applySubjectLifecycleIntent,
  auditSubjectLifecyclePolicy,
  inspectSubjectLifecycle,
} from "./subject-lifecycle.js";

const roots: string[] = [];

function subject(): string {
  const root = mkdtempSync(join(tmpdir(), "subject-lifecycle-"));
  roots.push(root);
  const dir = join(root, ".context", "2026-09-19.demo");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function write(dir: string, name: string, text: string): void {
  writeFileSync(join(dir, name), text);
}

function completedPlan(dir: string): void {
  write(dir, "plan-demo.md", "---\nstatus: active\n---\n# Plan\n");
  write(dir, "phase-1-demo.md", "---\nstatus: completed\nplan: plan-demo.md\n---\n# Phase\n");
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("subject lifecycle intents", () => {
  it("applies the legal lifecycle, preserves content, and keeps retries idempotent", () => {
    const dir = subject();
    write(dir, "index.md", "---\ntitle: Demo\n---\n\n# Existing body\n");

    expect(applySubjectLifecycleIntent({ kind: "initialize", subjectDir: dir })).toMatchObject({
      ok: true, changed: true, previousState: "missing", resultingState: "draft",
    });
    expect(applySubjectLifecycleIntent({ kind: "initialize", subjectDir: dir })).toMatchObject({
      ok: true, changed: false, resultingState: "draft",
    });
    expect(applySubjectLifecycleIntent({ kind: "activate", subjectDir: dir })).toMatchObject({
      ok: true, changed: true, resultingState: "active",
    });
    completedPlan(dir);
    expect(applySubjectLifecycleIntent({ kind: "close-verified", subjectDir: dir })).toMatchObject({
      ok: true, changed: true, resultingState: "completed",
    });
    expect(applySubjectLifecycleIntent({ kind: "close-verified", subjectDir: dir })).toMatchObject({
      ok: true, changed: false, resultingState: "completed",
    });
    expect(applySubjectLifecycleIntent({ kind: "reopen", subjectDir: dir, reason: "Add follow-up" })).toMatchObject({
      ok: true, changed: true, resultingState: "active",
    });

    let inspection = inspectSubjectLifecycle(dir);
    expect(inspection).toMatchObject({ state: "active", effectiveState: "active", canonical: true, revision: 4 });
    expect(applySubjectLifecycleIntent({ kind: "close-verified", subjectDir: dir })).toMatchObject({
      ok: true, changed: true, resultingState: "completed",
    });
    inspection = inspectSubjectLifecycle(dir);
    expect(inspection).toMatchObject({ state: "completed", effectiveState: "completed", revision: 5 });
    const text = readFileSync(join(dir, "index.md"), "utf8");
    expect(text).toContain("title: Demo");
    expect(text).toContain("# Existing body");
    expect(text).toContain("lifecycle_reopen_reason: Add follow-up");
  });

  it("refuses illegal edges and open work without mutating the index", () => {
    const dir = subject();
    applySubjectLifecycleIntent({ kind: "initialize", subjectDir: dir });
    applySubjectLifecycleIntent({ kind: "activate", subjectDir: dir });
    write(dir, "plan-demo.md", "---\nstatus: active\n---\n# Plan\n");
    const before = readFileSync(join(dir, "index.md"), "utf8");

    expect(applySubjectLifecycleIntent({ kind: "close-verified", subjectDir: dir })).toMatchObject({
      ok: false, code: "not-verified", changed: false,
    });
    expect(applySubjectLifecycleIntent({ kind: "initialize", subjectDir: dir })).toMatchObject({
      ok: false, code: "invalid-transition", changed: false,
    });
    expect(readFileSync(join(dir, "index.md"), "utf8")).toBe(before);
  });

  it("detects legacy verified-closed subjects and canonicalizes only through close", () => {
    const dir = subject();
    write(dir, "index.md", "---\nstatus: active\ntitle: Legacy\n---\n\n# Body\n");
    completedPlan(dir);

    expect(inspectSubjectLifecycle(dir)).toMatchObject({
      state: "active", effectiveState: "completed", canonical: false, verifiedClosed: true,
    });
    expect(applySubjectLifecycleIntent({ kind: "initialize", subjectDir: dir })).toMatchObject({
      ok: false, code: "invalid-transition",
    });
    expect(applySubjectLifecycleIntent({ kind: "activate", subjectDir: dir })).toMatchObject({
      ok: false, code: "invalid-transition",
    });
    expect(applySubjectLifecycleIntent({ kind: "close-verified", subjectDir: dir })).toMatchObject({
      ok: true, changed: true, resultingState: "completed",
    });
  });

  it("canonicalizes legacy completed only through close before reopen", () => {
    const dir = subject();
    write(dir, "index.md", "---\nstatus: completed\ntitle: Legacy\n---\n");

    expect(applySubjectLifecycleIntent({ kind: "reopen", subjectDir: dir, reason: "More work" })).toMatchObject({
      ok: false, code: "invalid-transition", changed: false,
    });
    expect(applySubjectLifecycleIntent({ kind: "close-verified", subjectDir: dir })).toMatchObject({
      ok: true, changed: true, resultingState: "completed",
    });
    expect(applySubjectLifecycleIntent({ kind: "reopen", subjectDir: dir, reason: "More work" })).toMatchObject({
      ok: true, changed: true, resultingState: "active",
    });
  });


  it.each(["draft", "active", "completed"] as const)(
    "initialize refuses a legacy %s lifecycle without mutation",
    (state) => {
      const dir = subject();
      write(dir, "index.md", `---\nstatus: ${state}\ntitle: Legacy\n---\n\n# Body\n`);
      const before = readFileSync(join(dir, "index.md"), "utf8");

      expect(applySubjectLifecycleIntent({ kind: "initialize", subjectDir: dir })).toMatchObject({
        ok: false, code: "invalid-transition", changed: false,
      });
      expect(readFileSync(join(dir, "index.md"), "utf8")).toBe(before);
    },
  );

  it.each(["draft", "active"] as const)(
    "activate canonicalizes an open legacy %s lifecycle",
    (state) => {
      const dir = subject();
      write(dir, "index.md", `---\nstatus: ${state}\ntitle: Legacy\n---\n\n# Body\n`);

      const result = applySubjectLifecycleIntent({ kind: "activate", subjectDir: dir });

      expect(result).toMatchObject({
        ok: true, code: "applied", changed: true, previousState: state, resultingState: "active",
        canonical: true, revision: 1,
      });
      expect(readFileSync(join(dir, "index.md"), "utf8")).toContain("# Body");
    },
  );

  it("refuses reopen outside canonical completed state and requires a reason", () => {
    const missing = subject();
    expect(applySubjectLifecycleIntent({ kind: "reopen", subjectDir: missing, reason: "Work" })).toMatchObject({
      ok: false, code: "invalid-transition",
    });

    const active = subject();
    applySubjectLifecycleIntent({ kind: "initialize", subjectDir: active });
    applySubjectLifecycleIntent({ kind: "activate", subjectDir: active });
    expect(applySubjectLifecycleIntent({ kind: "reopen", subjectDir: active, reason: "Work" })).toMatchObject({
      ok: false, code: "invalid-transition",
    });

    const completed = subject();
    applySubjectLifecycleIntent({ kind: "initialize", subjectDir: completed });
    applySubjectLifecycleIntent({ kind: "activate", subjectDir: completed });
    completedPlan(completed);
    applySubjectLifecycleIntent({ kind: "close-verified", subjectDir: completed });
    expect(applySubjectLifecycleIntent({ kind: "reopen", subjectDir: completed, reason: "   " })).toMatchObject({
      ok: false, code: "invalid-transition",
    });
  });
  it("fails closed for ambiguous phase ownership", () => {
    const dir = subject();
    write(dir, "index.md", "---\nstatus: active\n---\n");
    write(dir, "plan-a.md", "# A\n");
    write(dir, "plan-b.md", "# B\n");
    write(dir, "phase-1-a.md", "---\nstatus: completed\n---\n");

    expect(applySubjectLifecycleIntent({ kind: "close-verified", subjectDir: dir })).toMatchObject({
      ok: false, code: "legacy-ambiguous", changed: false,
    });
  });

  it("treats a zero-plan subject as not-verified instead of ownership-ambiguous", () => {
    const dir = subject();
    write(dir, "index.md", "---\nstatus: active\n---\n");
    write(dir, "phase-1-orphan.md", "---\nstatus: completed\n---\n");

    const result = applySubjectLifecycleIntent({ kind: "close-verified", subjectDir: dir });
    expect(result).toMatchObject({ ok: false, code: "not-verified", changed: false });
    expect(result.blockers).toContain("no plan provides closeout evidence");
    expect(result.blockers.some((blocker) => blocker.includes("multi-plan"))).toBe(false);
  });


  it("fails closed when explicit phase ownership is malformed", () => {
    const dir = subject();
    write(dir, "index.md", "---\nstatus: active\n---\n");
    write(dir, "plan-demo.md", "# Plan\n");
    write(dir, "phase-1-demo.md", "---\nstatus: completed\nplan: [plan-demo.md]\n---\n");
    const before = readFileSync(join(dir, "index.md"), "utf8");

    expect(applySubjectLifecycleIntent({ kind: "close-verified", subjectDir: dir })).toMatchObject({
      ok: false, code: "legacy-ambiguous", changed: false,
    });
    expect(readFileSync(join(dir, "index.md"), "utf8")).toBe(before);
  });

  it("fails closed when canonical state contradicts its transition provenance", () => {
    const dir = subject();
    write(
      dir,
      "index.md",
      "---\nstatus: active\nlifecycle_schema: 1\nlifecycle_revision: 2\nlifecycle_last_transition: close-verified\n---\n",
    );
    const before = readFileSync(join(dir, "index.md"), "utf8");

    expect(inspectSubjectLifecycle(dir)).toMatchObject({ provenance: "malformed", canonical: false });
    expect(applySubjectLifecycleIntent({ kind: "activate", subjectDir: dir })).toMatchObject({
      ok: false, code: "legacy-ambiguous", changed: false,
    });
    expect(readFileSync(join(dir, "index.md"), "utf8")).toBe(before);
  });

  it("emits one JSON result and exit 2 for semantic CLI refusal", () => {
    const dir = subject();
    const script = join(import.meta.dirname, "subject-lifecycle.ts");
    const run = spawnSync("bun", [script, "activate", "--subject", dir, "--json"], { encoding: "utf8" });

    expect(run.status).toBe(2);
    expect(run.stderr).toBe("");
    expect(JSON.parse(run.stdout)).toMatchObject({
      ok: false,
      code: "invalid-transition",
      previousState: "missing",
      changed: false,
    });
  });
});

describe("lifecycle policy audit", () => {
  it("reports direct TypeScript and imperative Markdown writers with file and line", () => {
    const root = mkdtempSync(join(tmpdir(), "subject-lifecycle-audit-"));
    roots.push(root);
    mkdirSync(join(root, "extensions"), { recursive: true });
    mkdirSync(join(root, "skills", "x"), { recursive: true });
    writeFileSync(
      join(root, "extensions", "bad.ts"),
      'writeFileSync(join(dir, "index.md"), "---\\nstatus: active\\n---\\n");\\n',
    );
    writeFileSync(
      join(root, "extensions", "object-field.ts"),
      'writeFileSync(join(dir, "index.md"), setFrontmatterFields(old, { status: "active" }));\n',
    );
    writeFileSync(
      join(root, "extensions", "lifecycle-field.ts"),
      'writeFileSync(join(dir, "index.md"), setFrontmatterFields(old, { lifecycle_revision: 2 }));\n',
    );
    writeFileSync(
      join(root, "extensions", "bound-writer.ts"),
      [
        'const indexPath = join(dir, "index.md");',
        'const contents = "---\\nstatus: active\\n---\\n";',
        "writeFileSync(indexPath, contents);",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(root, "extensions", "bound-object-field.ts"),
      [
        'const indexPath = join(dir, "index.md");',
        'const lifecycle = { status: "completed" };',
        "const contents = setFrontmatterFields(old, lifecycle);",
        "writeFileSync(indexPath, contents);",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(root, "extensions", "bound-template-writer.ts"),
      [
        "const indexPath = `${dir}/index.md`;",
        "const state = \"active\";",
        "const contents = `---\\nstatus: ${state}\\n---\\n`;",
        "writeFileSync(indexPath, contents);",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(root, "extensions", "unrelated-status.ts"),
      [
        'const artifactPath = join(dir, "plan.md");',
        'const fields = { status: "active" };',
        "writeFileSync(artifactPath, setFrontmatterFields(old, fields));",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(root, "extensions", "lifecycle-output.ts"),
      [
        'const indexPath = join(dir, "index.md");',
        'const output = { path: indexPath, status: "active" };',
        "console.log(JSON.stringify(output));",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(root, "skills", "x", "SKILL.md"),
      "Create `index.md` with `status: completed`.\\n",
    );
    writeFileSync(
      join(root, "skills", "x", "MULTILINE.md"),
      "**Subject frontmatter** (`index.md`):\n```yaml\n---\nstatus: active\n---\n```\n",
    );

    expect(auditSubjectLifecyclePolicy(root)).toEqual([
      expect.objectContaining({ path: "extensions/bad.ts", line: 1 }),
      expect.objectContaining({ path: "extensions/bound-object-field.ts", line: 4 }),
      expect.objectContaining({ path: "extensions/bound-template-writer.ts", line: 4 }),
      expect.objectContaining({ path: "extensions/bound-writer.ts", line: 3 }),
      expect.objectContaining({ path: "extensions/lifecycle-field.ts", line: 1 }),
      expect.objectContaining({ path: "extensions/object-field.ts", line: 1 }),
      expect.objectContaining({ path: "skills/x/MULTILINE.md", line: 4 }),
      expect.objectContaining({ path: "skills/x/SKILL.md", line: 1 }),
    ]);
  });
});
