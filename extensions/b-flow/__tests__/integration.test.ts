import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { rmSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createActor } from "xstate";
import { createBuckMachine } from "../machine.js";
import { buildQueue } from "../queue-builder.js";
import { verifyResult } from "../verify-result.js";
import { readProjection } from "../persistence.js";

const TEST_ROOT = join("/tmp", "bflow-test-" + Date.now());

describe("b-flow integration", () => {
  beforeEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  });

  test("happy path: start transitions from idle", async () => {
    const machine = createBuckMachine(TEST_ROOT);
    const actor = createActor(machine);
    actor.start();

    actor.send({ type: "START", goal: "test goal" });
    await new Promise((r) => setTimeout(r, 100));

    const snapshot = actor.getSnapshot();
    assert.ok(
      ["recovering", "planning", "blocked"].includes(String(snapshot.value)),
      `Expected transitioning state, got ${snapshot.value}`,
    );
    assert.strictEqual(snapshot.context.projection.goal, "test goal");

    actor.stop();
  });

  test("persistence writes projection after transitions", async () => {
    const machine = createBuckMachine(TEST_ROOT);
    const actor = createActor(machine);
    actor.start();

    actor.send({ type: "START", goal: "persist test" });
    await new Promise((r) => setTimeout(r, 200));

    const projection = readProjection(TEST_ROOT);
    assert.notStrictEqual(projection, null);
    assert.strictEqual(projection?.goal, "persist test");
    assert.notStrictEqual(projection?.currentState, "idle");

    actor.stop();
  });

  test("queue builder finds phases in subject folder", () => {
    const subjectDir = join(TEST_ROOT, ".context", "2026-05-08.test-subject");
    mkdirSync(subjectDir, { recursive: true });

    writeFileSync(
      join(subjectDir, "phase-1-types.md"),
      "---\nstatus: pending\ndifficulty: easy\n---\n# Phase 1\n",
    );
    writeFileSync(
      join(subjectDir, "phase-2-machine.md"),
      "---\nstatus: pending\ndifficulty: medium\n---\n# Phase 2\n",
    );
    writeFileSync(
      join(subjectDir, "phase-3-worker.md"),
      "---\nstatus: completed\n---\n# Phase 3\n",
    );

    const queue = buildQueue(TEST_ROOT, "2026-05-08.test-subject");
    assert.strictEqual(queue.length, 2);
    assert.strictEqual(queue[0].id, "phase-phase-1-types");
    assert.strictEqual(queue[0].difficulty, "easy");
    assert.strictEqual(queue[1].difficulty, "medium");
  });

  test("queue builder finds tasks.md unchecked items", () => {
    const subjectDir = join(TEST_ROOT, ".context", "2026-05-08.test-subject");
    mkdirSync(subjectDir, { recursive: true });

    writeFileSync(
      join(subjectDir, "tasks.md"),
      "# Tasks\n\n- [x] Done task\n- [ ] Todo 1\n- [ ] Todo 2\n",
    );

    const queue = buildQueue(TEST_ROOT, "2026-05-08.test-subject");
    const tasks = queue.filter((q) => q.type === "task");
    assert.strictEqual(tasks.length, 2);
  });

  test("verifyResult parses completed worker result", () => {
    const resultFile = join(TEST_ROOT, "result.md");
    writeFileSync(
      resultFile,
      "---\nchunk_id: test-1\nchunk_type: phase\nstatus: completed\nstarted_at: 2026-05-09T00:00:00Z\ncompleted_at: 2026-05-09T00:01:00Z\nworker_attempt: 1\nmodel_used: test\nchanged_files: [file.ts]\nacceptance_criteria_met: [all]\nacceptance_criteria_missed: []\nwarnings: []\n---\n\n# Worker Result\n\n## Summary\nDone.\n",
    );

    const result = verifyResult(resultFile);
    assert.strictEqual(result.type, "CHUNK_VERIFIED");
    assert.strictEqual(result.status, "completed");
  });

  test("verifyResult detects warnings", () => {
    const resultFile = join(TEST_ROOT, "result.md");
    writeFileSync(
      resultFile,
      "---\nchunk_id: test-1\nchunk_type: phase\nstatus: completed\nwarnings: [minor issue]\nacceptance_criteria_missed: [edge case]\n---\n",
    );

    const result = verifyResult(resultFile);
    assert.strictEqual(result.type, "CHUNK_WARNINGS");
    assert.strictEqual(result.status, "completed_with_warnings");
  });

  test("verifyResult detects blocked", () => {
    const resultFile = join(TEST_ROOT, "result.md");
    writeFileSync(
      resultFile,
      "---\nchunk_id: test-1\nchunk_type: phase\nstatus: blocked\nblock_reason: needs user input\n---\n",
    );

    const result = verifyResult(resultFile);
    assert.strictEqual(result.type, "CHUNK_BLOCKED");
    assert.strictEqual(result.status, "blocked");
  });

  test("machine defines all required states", () => {
    const machine = createBuckMachine(TEST_ROOT);
    assert.ok(machine);
    assert.strictEqual(machine.config.id, "buck-flow");
    const states = Object.keys(machine.config.states ?? {});
    assert.ok(states.includes("idle"));
    assert.ok(states.includes("done"));
    assert.ok(states.includes("aborted"));
    assert.ok(states.includes("executingChunks"));
  });
});
