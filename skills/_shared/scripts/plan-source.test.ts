import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { withConfiguredStore } from "./workflow-state.js";
import { classifyContextPath, commitConsumerBatch } from "../storage/consumers.js";

const previousConfig = process.env.BUCK_WORKFLOW_CONFIG;
const previousRoot = process.env.BUCK_WORKFLOW_ROOT;
const roots: string[] = [];
afterEach(() => {
  if (previousConfig === undefined) delete process.env.BUCK_WORKFLOW_CONFIG;
  else process.env.BUCK_WORKFLOW_CONFIG = previousConfig;
  if (previousRoot === undefined) delete process.env.BUCK_WORKFLOW_ROOT;
  else process.env.BUCK_WORKFLOW_ROOT = previousRoot;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it("reads visible linked review, iteration and nested knowledge without exposing private execution or another branch", async () => {
  const root = mkdtempSync(join(tmpdir(), "plan-source-"));
  roots.push(root);
  const config = join(root, "config.yaml");
  writeFileSync(config, `version: 1\nstorage:\n  adapter: sqlite\n  database: ${join(root, "state.sqlite")}\n`);
  process.env.BUCK_WORKFLOW_CONFIG = config;
  process.env.BUCK_WORKFLOW_ROOT = root;
  const subject = "2026-10-15.reader";
  const names = ["plan-topic.md", "review-topic.md", "iterate-topic.md", "brainstorm-topic.md", "notes/index.md"];
  await withConfiguredStore(root, async (store, context) => {
    const bound = { ...context, worktreeId: context.worktreeId!, runId: context.runId! };
    await commitConsumerBatch(store, bound, names.map((name) => ({ ...classifyContextPath(`.context/${subject}/${name}`), bytes: new TextEncoder().encode(`# ${name}\n[Review](review-topic.md)\n`) })), { attemptId: "knowledge", status: "attempted" });
    await commitConsumerBatch(store, { ...bound, runId: "private-audit" }, [{ kind: "audit", subjectId: subject, logicalName: "private.md", bytes: new TextEncoder().encode("private execution") }], { attemptId: "audit", status: "attempted" });
    await commitConsumerBatch(store, { ...bound, branchId: "other-branch", runId: "other-run" }, [{ kind: "review", subjectId: subject, logicalName: "review-private.md", bytes: new TextEncoder().encode("other branch") }], { attemptId: "other", status: "attempted" });
    await commitConsumerBatch(store, { ...bound, runId: "binary-run" }, [{ kind: "attachment", subjectId: subject, logicalName: "image.md", bytes: Uint8Array.from([0xff, 0x00]) }], { attemptId: "binary", status: "attempted" });
  });
  // Bun runs this reader seam without requiring the optional Astro UI install.
  const result = JSON.parse(execFileSync("bun", ["-e", `
    import { SqlPlanSource } from "./docs/plans/src/lib/plans/sql.ts";
    import { withConfiguredStore } from "./skills/_shared/scripts/workflow-state.ts";
    import { classifyContextPath, commitConsumerBatch } from "./skills/_shared/storage/consumers.ts";
    const reader = new SqlPlanSource();
    const subject = ${JSON.stringify(subject)};
    await reader.listSubjects();
    await withConfiguredStore(${JSON.stringify(root)}, async (store, context) => {
      await commitConsumerBatch(store, { ...context, worktreeId: context.worktreeId!, runId: "update-plan" }, [{
        ...classifyContextPath(".context/" + subject + "/plan-topic.md"),
        bytes: new TextEncoder().encode("# Updated after enumeration\\n"),
      }], { attemptId: "updated-plan", status: "attempted" });
    });
    console.log(JSON.stringify({
      files: (await reader.listDocuments(subject)).map(item => item.file),
      review: await reader.getDocument(subject, "review-topic"),
      nested: await reader.getDocument(subject, "notes/index"),
      private: await reader.getDocument(subject, "private"),
      other: await reader.getDocument(subject, "review-private"),
      snapshot: await reader.getDocument(subject, "plan-topic"),
      fresh: await new SqlPlanSource().getDocument(subject, "plan-topic"),
    }));
  `], { encoding: "utf8", env: process.env }));
  expect(result.files).toEqual([...names].sort());
  expect(result.review).toMatchObject({ title: "review-topic.md", raw: "# review-topic.md\n[Review](review-topic.md)\n" });
  expect(result.nested).toMatchObject({ file: "notes/index.md" });
  expect(result.private).toBeNull();
  expect(result.other).toBeNull();
  expect(result.snapshot.raw).toBe("# plan-topic.md\n[Review](review-topic.md)\n");
  expect(result.fresh.raw).toBe("# Updated after enumeration\n");
});
