import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import hook from "../../../hooks/post/turn-memory.js";
import { bindConsumerAttempt, withConfiguredStore } from "../../../skills/_shared/scripts/workflow-state.js";

vi.mock("../../omp-models.js", () => ({ runOmpModelSession: async () => "Keep branch-private knowledge in the configured adapter." }));
vi.mock("../../typed-output/evaluator.js", () => ({ createTypeSafeEvaluator: () => async () => ({ ok: true, result: { answers: { durable: { type: "noul", noul: 0.95 } } } }) }));

const previousConfig = process.env.BUCK_WORKFLOW_CONFIG;
const roots: string[] = [];
afterEach(() => {
  if (previousConfig === undefined) delete process.env.BUCK_WORKFLOW_CONFIG;
  else process.env.BUCK_WORKFLOW_CONFIG = previousConfig;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it("completes distinct default-hook window receipts and replays a saved window without rewriting it", async () => {
  const root = mkdtempSync(join(tmpdir(), "hook-store-"));
  roots.push(root);
  const config = join(root, "config.yaml");
  writeFileSync(config, `version: 1\nstorage:\n  adapter: sqlite\n  database: ${join(root, "state.sqlite")}\n`);
  process.env.BUCK_WORKFLOW_CONFIG = config;
  const entries: Array<{ type: string; customType: string; data: { windowId?: string } }> = [];
  const handlers = new Map<string, (event: unknown, context: unknown) => Promise<void>>();
  hook({
    on: (name: string, handler: (event: unknown, context: unknown) => Promise<void>) => handlers.set(name, handler),
    appendEntry: (customType: string, data: { windowId?: string }) => entries.push({ type: "custom", customType, data }),
  } as never);
  const context = { cwd: root, hasUI: false, sessionManager: { getEntries: () => entries, getSessionFile: () => join(root, "session.jsonl") } };
  const event = (turn: number) => ({ messages: [{ role: "user", content: `decision ${turn}`, timestamp: turn }, { role: "assistant", content: `recorded ${turn}`, timestamp: turn }] });
  for (let turn = 1; turn <= 3; turn++) await handlers.get("agent_end")!(event(turn), context);
  const firstWindow = entries.find((entry) => entry.customType === "turn-memory-consumed")!.data.windowId!;
  const firstRevision = await withConfiguredStore(root, async (store, trusted) => {
    const binding = await bindConsumerAttempt(trusted, root, firstWindow);
    const receipt = await store.readReceipt(trusted.projectId, binding.runId);
    expect(receipt).toMatchObject({ status: "complete", attemptId: firstWindow });
    const memory = await store.read({ projectId: trusted.projectId, branchId: trusted.branchId, subjectId: "turn-memory", kind: "memory", logicalName: `turn-memory/${firstWindow}.md` });
    expect(new TextDecoder().decode(memory!.bytes)).toBe("Keep branch-private knowledge in the configured adapter.");
    expect(receipt!.artifactRevisions).toContain(memory!.revision);
    return memory!.revision;
  });
  entries.splice(entries.findIndex((entry) => entry.customType === "turn-memory-consumed"), 1);
  await handlers.get("agent_end")!(event(3), context);
  for (let turn = 4; turn <= 6; turn++) await handlers.get("agent_end")!(event(turn), context);
  const windows = entries.filter((entry) => entry.customType === "turn-memory-consumed").map((entry) => entry.data.windowId!);
  expect(new Set(windows).size).toBe(2);
  await withConfiguredStore(root, async (store, trusted) => {
    const bindings = await Promise.all(windows.map((window) => bindConsumerAttempt(trusted, root, window)));
    expect(bindings[0].runId).not.toBe(bindings[1].runId);
    for (const [index, binding] of bindings.entries()) {
      const receipt = await store.readReceipt(trusted.projectId, binding.runId);
      expect(receipt).toMatchObject({ status: "complete", attemptId: windows[index], worktreeId: trusted.worktreeId });
      const dedupe = await store.read({ projectId: trusted.projectId, branchId: trusted.branchId, worktreeId: trusted.worktreeId, runId: binding.runId, subjectId: "turn-memory", kind: "activity", logicalName: `dedupe/${windows[index]}.json` });
      expect(new TextDecoder().decode(dedupe!.bytes)).toBe(windows[index]);
      expect(receipt!.artifactRevisions).toContain(dedupe!.revision);
    }
    const memory = await store.read({ projectId: trusted.projectId, branchId: trusted.branchId, subjectId: "turn-memory", kind: "memory", logicalName: `turn-memory/${firstWindow}.md` });
    expect(memory!.revision).toBe(firstRevision);
  });
});
