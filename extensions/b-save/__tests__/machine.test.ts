import { createActor } from "xstate";
import { describe, expect, it } from "vitest";
import { createBSaveMachine } from "../machine.js";

function start(runId = "run-1") {
  const actor = createActor(createBSaveMachine(), { input: { runId } });
  actor.start();
  return actor;
}

describe("b-save machine", () => {
  it("snapshots, evaluates, applies, effects, then completes", () => {
    const actor = start();
    expect(actor.getSnapshot().value).toBe("snapshotting");
    actor.send({ type: "SNAPSHOT_DONE" });
    expect(actor.getSnapshot().value).toBe("evaluating");
    actor.send({ type: "EVAL_DONE" });
    expect(actor.getSnapshot().value).toBe("applying");
    actor.send({ type: "APPLY_DONE" });
    expect(actor.getSnapshot().value).toBe("effecting");
    actor.send({ type: "EFFECTS_DONE" });
    expect(actor.getSnapshot().value).toBe("completed");
    actor.stop();
  });

  it("pauses for subject choice and resume, and distinguishes terminal failures", () => {
    const actor = start();
    actor.send({ type: "AMBIGUOUS_SUBJECT" });
    expect(actor.getSnapshot().value).toBe("awaiting_subject_choice");
    actor.send({ type: "SUBJECT_CHOSEN", subject: "2026-09-10.demo" });
    expect(actor.getSnapshot().context.subject).toBe("2026-09-10.demo");
    expect(actor.getSnapshot().value).toBe("snapshotting");
    actor.stop();

    const judging = start("run-2");
    judging.send({ type: "SNAPSHOT_DONE" });
    judging.send({ type: "NEEDS_JUDGMENT" });
    expect(judging.getSnapshot().value).toBe("judging");
    judging.send({ type: "MODEL_FAILED" });
    expect(judging.getSnapshot().value).toBe("judging");
    judging.send({ type: "MODEL_FAILED" });
    expect(judging.getSnapshot().value).toBe("failed_model");
    judging.stop();

    const apply = start("run-3");
    apply.send({ type: "SNAPSHOT_DONE" });
    apply.send({ type: "EVAL_DONE" });
    apply.send({ type: "APPLY_FAILED" });
    expect(apply.getSnapshot().value).toBe("failed_apply");
    apply.stop();

    const abort = start("run-4");
    abort.send({ type: "ABORT" });
    expect(abort.getSnapshot().value).toBe("aborted");
    abort.stop();
  });

  it("fails the model from evaluating without getting stuck", () => {
    const actor = start("run-5");
    actor.send({ type: "SNAPSHOT_DONE" });
    expect(actor.getSnapshot().value).toBe("evaluating");
    actor.send({ type: "MODEL_FAILED" });
    expect(actor.getSnapshot().value).toBe("failed_model");
    actor.stop();
  });
});
