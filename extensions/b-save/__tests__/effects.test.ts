import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { withConfiguredStore } from "../../../skills/_shared/scripts/workflow-state.js";
import { deliverNativeMemory, reindexMemory, retainPatchToStore, runEffects } from "../effects.js";

describe("deliverNativeMemory", () => {
  it("records unsupported for hindsight and never calls save", async () => {
    let saved = 0;
    const outcome = await deliverNativeMemory({
      memory: {
        status: () => ({ enabled: true, backend: "hindsight" }),
        save: () => {
          saved += 1;
          return { stored: 3 };
        },
      },
    });
    expect(outcome).toEqual({
      name: "native_memory",
      outcome: "unsupported",
      detail: "hindsight pre-execution retain is unsupported on OMP 18.1.17",
    });
    expect(saved).toBe(0);
  });

  it("saves local backends when stored > 0 and retries stored:0 once", async () => {
    const ok = await deliverNativeMemory({
      memory: {
        status: () => ({ enabled: true, backend: "local" }),
        save: () => ({ stored: 2 }),
      },
    });
    expect(ok.outcome).toBe("succeeded");
    let calls = 0;
    const zero = await deliverNativeMemory({
      memory: {
        status: () => ({ enabled: true, backend: "mnemopi" }),
        save: () => {
          calls += 1;
          return { stored: 0 };
        },
      },
    });
    expect(calls).toBe(2);
    expect(zero.outcome).toBe("failed_nonblocking");
  });

  it("skips --no-retain and missing runtimes without failing the durable save", async () => {
    expect((await deliverNativeMemory({ noRetain: true })).outcome).toBe("skipped");
    expect((await deliverNativeMemory({})).outcome).toBe("skipped");
    const effects = await runEffects({ noRetain: true });
    expect(effects.map((e) => e.outcome)).toEqual(["skipped", "skipped"]);
    expect((await reindexMemory()).outcome).toBe("skipped");
  });
});

describe("extensions/index.ts registration", () => {
  it("registers the engine as /b-save and not /b-save-improved", () => {
    const source = readFileSync(new URL("../../index.ts", import.meta.url), "utf8");
    expect(source).toMatch(/b-save\/index/);
    expect(source).not.toMatch(/b-save-improved/);
  });
});

describe("retainPatchToStore", () => {
  const original = { cwd: process.cwd(), config: process.env.BUCK_WORKFLOW_CONFIG, xdg: process.env.XDG_CONFIG_HOME, testDb: process.env.BUCK_WORKFLOW_TEST_DATABASE_URL };
  let root = "";
  afterEach(() => {
    process.chdir(original.cwd);
    for (const [name, value] of [["BUCK_WORKFLOW_CONFIG", original.config], ["XDG_CONFIG_HOME", original.xdg], ["BUCK_WORKFLOW_TEST_DATABASE_URL", original.testDb]] as const) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    if (root) rmSync(root, { recursive: true, force: true });
    root = "";
  });

  function fixtureConfig(adapter: string, option = "") {
    root = mkdtempSync(join(tmpdir(), "b-save-retain-"));
    execFileSync("git", ["init", "-b", "main"], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["-c", "user.email=t@example.test", "-c", "user.name=Test", "commit", "--allow-empty", "-qm", "init"], { cwd: root, stdio: "ignore" });
    process.env.XDG_CONFIG_HOME = join(root, "xdg");
    process.env.BUCK_WORKFLOW_CONFIG = join(root, "config.yaml");
    writeFileSync(process.env.BUCK_WORKFLOW_CONFIG, `version: 1\nstorage:\n  adapter: ${adapter}\n${option}`);
    process.chdir(root);
  }

  it("retains durable patch writes into the configured store and reports skipped deletes", async () => {
    fixtureConfig("sqlite", `  database: ${join(root, "state.sqlite")}\n`);
    const outcome = await retainPatchToStore({
      cwd: root,
      patchOps: [
        { path: ".context/memory/new-fact.md", content: "---\ndate: 2026-11-18\n---\n# Retained fact\n" },
        { path: ".context/backlog/todo.md", content: "# Backlog\n" },
        { path: ".context/memory/gone.md", content: null },
      ],
    });
    expect(outcome).toMatchObject({ name: "store_retain", outcome: "succeeded", detail: expect.stringContaining("retained 2 write(s)") });
    await withConfiguredStore(root, async (store, context) => {
      const memory = await store.read({ projectId: context.projectId, branchId: context.branchId, subjectId: "memory", kind: "memory", logicalName: "new-fact.md" });
      expect(memory && new TextDecoder().decode(memory.bytes)).toContain("Retained fact");
      const backlog = await store.read({ projectId: context.projectId, branchId: context.branchId, subjectId: "backlog", kind: "backlog", logicalName: "todo.md" });
      expect(backlog && new TextDecoder().decode(backlog.bytes)).toContain("Backlog");
    });
  });

  it("reports failure when the configured destination is unusable", async () => {
    fixtureConfig("postgres", "  connection_env: BUCK_WORKFLOW_TEST_DATABASE_URL\n");
    delete process.env.BUCK_WORKFLOW_TEST_DATABASE_URL;
    const outcome = await retainPatchToStore({
      cwd: root,
      patchOps: [{ path: ".context/memory/new-fact.md", content: "# Fact\n" }],
    });
    expect(outcome).toMatchObject({ name: "store_retain", outcome: "failed_nonblocking" });
  });
});
