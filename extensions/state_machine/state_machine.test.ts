import { describe, expect, it, vi } from "vitest";
import {
  defineMachine,
  IllegalTransitionError,
  InvalidMachineError,
  UnknownStateError,
  type EffectOf,
  type Guard,
} from "./index.js";

// Tests enter through the same definition/instance interface callers use.
// No internal adapters are replaced; expected states and effects are literal fixtures.
it("imports the library without running examples", async () => {
  vi.resetModules();
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    await import("./index.js");
    expect(log).not.toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});

type Facts = { approved: boolean; revision: number };
type Effect = { kind: "publish"; revision: number };

function publication(overrides: {
  guard?: Guard<Facts>;
  effect?: EffectOf<Facts, Effect>;
} = {}) {
  return defineMachine<Facts, Effect>()({
    initial: "draft",
    states: {
      draft: {
        targets: [
          { name: "review" },
          {
            name: "published",
            guard: overrides.guard ?? ((facts) => facts.approved),
            effect: overrides.effect ?? ((facts) => ({ kind: "publish", revision: facts.revision })),
          },
          { name: "cancelled", manual: true, guard: (facts) => facts.approved },
        ],
      },
      review: { targets: [{ name: "published" }] },
      published: { final: true, targets: [] },
      cancelled: { final: true, targets: [] },
    },
  });
}

describe("definition validation", () => {
  it("rejects an unreachable state", () => {
    expect(() => defineMachine()({
      initial: "draft",
      states: {
        draft: { targets: [{ name: "done" }] },
        done: { final: true, targets: [] },
        orphan: { final: true, targets: [] },
      },
    })).toThrow(InvalidMachineError);
  });

  it("rejects a non-final state with no outgoing targets", () => {
    expect(() => defineMachine()({
      initial: "draft",
      states: {
        draft: { targets: [{ name: "stuck" }, { name: "done" }] },
        stuck: { targets: [] },
        done: { final: true, targets: [] },
      },
    })).toThrow(InvalidMachineError);
  });

  it("rejects a graph without any final state", () => {
    expect(() => defineMachine()({
      initial: "draft",
      states: { draft: { targets: [{ name: "draft" }] } },
    })).toThrow(InvalidMachineError);
  });

  it("rejects two rows for the same edge", () => {
    expect(() => defineMachine()({
      initial: "draft",
      states: {
        draft: { targets: [{ name: "done" }, { name: "done", manual: true }] },
        done: { final: true, targets: [] },
      },
    })).toThrow(InvalidMachineError);
  });

  it("rejects an undeclared target supplied by an untyped caller", () => {
    expect(() => defineMachine()({
      initial: "draft",
      states: {
        draft: {
          targets: [
            { name: "done" },
            // @ts-expect-error Runtime validation also protects callers without TypeScript.
            { name: "missing" },
          ],
        },
        done: { final: true, targets: [] },
      },
    })).toThrow(InvalidMachineError);
  });

  it("validates static reachability without evaluating guards or effects", () => {
    const guard = vi.fn(() => false);
    const effect = vi.fn((): Effect => ({ kind: "publish", revision: 8 }));
    const definition = defineMachine<Facts, Effect>()({
      initial: "draft",
      states: {
        draft: { targets: [{ name: "published", guard, effect }] },
        published: { final: true, targets: [] },
      },
    });

    expect(definition.targets("draft")).toEqual(["published"]);
    expect(guard).not.toHaveBeenCalled();
    expect(effect).not.toHaveBeenCalled();
  });
});

describe("definition and instances", () => {
  function mutableConfig() {
    type Name = "ready" | "done";
    type State = { targets: { name: Name }[]; final?: true };
    const config: { initial: Name; states: { ready: State; done: State } } = {
      initial: "ready",
      states: {
        ready: { targets: [{ name: "done" }] },
        done: { final: true, targets: [{ name: "ready" }] },
      },
    };
    return config;
  }

  it("preserves the initial state after the caller changes its configuration", () => {
    const config = mutableConfig();
    const definition = defineMachine()(config);
    config.initial = "done";

    expect(config.initial).toBe("done");
    expect(definition.initial).toBe("ready");
    expect(definition.start().state).toBe("ready");
  });

  it("immediately rejects a caller-only state added after definition", () => {
    const config = mutableConfig();
    const definition = defineMachine()(config);
    Object.assign(config.states, { ghost: { final: true, targets: [] } });

    expect(Object.hasOwn(config.states, "ghost")).toBe(true);
    expect(() => definition.restore("ghost")).toThrow(UnknownStateError);
    expect(() => definition.restore("ghost")).toThrow(expect.objectContaining({ state: "ghost" }));
  });

  it("restores and routes captured states after the caller removes one", () => {
    const config = mutableConfig();
    const definition = defineMachine()(config);
    Reflect.deleteProperty(config.states, "ready");

    expect(Object.hasOwn(config.states, "ready")).toBe(false);
    const restored = definition.restore("ready");
    expect(restored.state).toBe("ready");
    expect(restored.isFinal).toBe(false);
    expect(restored.available()).toEqual(["done"]);
    expect(restored.transition("done")).toEqual({ from: "ready", to: "done", effect: undefined });
    expect(restored.isFinal).toBe(true);
    expect(restored.transition("ready")).toEqual({ from: "done", to: "ready", effect: undefined });
    expect(restored.available()).toEqual(["done"]);
  });

  it("preserves finality for the definition and existing and new instances", () => {
    const config = mutableConfig();
    const definition = defineMachine()(config);
    const existing = definition.restore("done");
    delete config.states.done.final;
    config.states.ready.final = true;

    expect(config.states.done.final).toBeUndefined();
    expect(config.states.ready.final).toBe(true);
    expect(definition.isFinal("done")).toBe(true);
    expect(definition.isFinal("ready")).toBe(false);
    expect(existing.isFinal).toBe(true);
    expect(definition.restore("done").isFinal).toBe(true);
    expect(definition.start().isFinal).toBe(false);
  });

  it("starts independent instances at initial and restores only a state name", () => {
    const definition = publication();
    const first = definition.start();
    const second = definition.start();

    expect(definition.initial).toBe("draft");
    expect(first.state).toBe("draft");
    expect(first.isFinal).toBe(false);
    first.transition("review", { approved: false, revision: 1 });

    expect(first.state).toBe("review");
    expect(second.state).toBe("draft");
    const restored = definition.restore("published");
    expect(restored.state).toBe("published");
    expect(restored.isFinal).toBe(true);
    expect(restored.available({ approved: true, revision: 1 })).toEqual([]);
  });

  it("rejects an unknown persisted name including inherited object properties", () => {
    const definition = publication();
    expect(() => definition.restore("missing")).toThrow(UnknownStateError);
    expect(() => definition.restore("toString")).toThrow(UnknownStateError);
  });

  it("exposes the static graph including guarded and manual edges", () => {
    const definition = publication();
    expect(definition.targets("draft")).toEqual(["review", "published", "cancelled"]);
    expect(definition.edge("draft", "cancelled").manual).toBe(true);
    expect(definition.isFinal("published")).toBe(true);
    expect(definition.isFinal("draft")).toBe(false);

    // Returned target lists cannot rewrite the definition's graph.
    const targets = definition.targets("draft") as string[];
    targets.length = 0;
    expect(definition.targets("draft")).toEqual(["review", "published", "cancelled"]);
  });
});

describe("available targets", () => {
  it("filters by current facts, always excludes manual edges, and does not move", () => {
    const instance = publication().start();
    expect(instance.available({ approved: false, revision: 1 })).toEqual(["review"]);
    expect(instance.available({ approved: true, revision: 2 })).toEqual(["review", "published"]);
    expect(instance.state).toBe("draft");
  });

  it("neither evaluates manual guards nor describes effects during discovery", () => {
    const manualGuard = vi.fn(() => true);
    const effect = vi.fn((): Effect => ({ kind: "publish", revision: 8 }));
    const instance = defineMachine<Facts, Effect>()({
      initial: "draft",
      states: {
        draft: {
          targets: [
            { name: "published", effect },
            { name: "cancelled", manual: true, guard: manualGuard },
          ],
        },
        published: { final: true, targets: [] },
        cancelled: { final: true, targets: [] },
      },
    }).start();

    expect(instance.available({ approved: true, revision: 1 })).toEqual(["published"]);
    expect(manualGuard).not.toHaveBeenCalled();
    expect(effect).not.toHaveBeenCalled();
  });
});

describe("transitions", () => {
  it("rejects a non-target and leaves the state unchanged", () => {
    const instance = publication().start();
    const action = () => instance.transition("draft", { approved: true, revision: 1 });

    expect(action).toThrow(IllegalTransitionError);
    expect(action).toThrow(expect.objectContaining({
      from: "draft", to: "draft", reason: "not-a-target",
    }));
    expect(instance.state).toBe("draft");
  });

  it("rejects a failed guard without describing an effect or moving", () => {
    const effect = vi.fn((): Effect => ({ kind: "publish", revision: 8 }));
    const instance = publication({ effect }).start();
    const action = () => instance.transition("published", { approved: false, revision: 1 });

    expect(action).toThrow(IllegalTransitionError);
    expect(action).toThrow(expect.objectContaining({
      from: "draft", to: "published", reason: "guard-rejected",
    }));
    expect(effect).not.toHaveBeenCalled();
    expect(instance.state).toBe("draft");
  });

  it("propagates a throwing guard and leaves the state unchanged", () => {
    const failure = new Error("cannot read approval");
    const effect = vi.fn((): Effect => ({ kind: "publish", revision: 8 }));
    const instance = publication({ guard: () => { throw failure; }, effect }).start();

    expect(() => instance.transition("published", { approved: true, revision: 1 })).toThrow(failure);
    expect(effect).not.toHaveBeenCalled();
    expect(instance.state).toBe("draft");
  });

  it("propagates a throwing effect description and leaves the state unchanged", () => {
    const failure = new Error("cannot describe publication");
    const instance = publication({ effect: () => { throw failure; } }).start();

    expect(() => instance.transition("published", { approved: true, revision: 1 })).toThrow(failure);
    expect(instance.state).toBe("draft");
  });

  it("returns an effect description using the facts supplied for that transition", () => {
    const instance = publication().start();
    instance.available({ approved: true, revision: 1 });

    expect(instance.transition("published", { approved: true, revision: 8 })).toEqual({
      from: "draft", to: "published", effect: { kind: "publish", revision: 8 },
    });
    expect(instance.state).toBe("published");
    expect(instance.isFinal).toBe(true);
  });

  it("rechecks guards when a previously available target is selected", () => {
    const instance = publication().start();
    expect(instance.available({ approved: true, revision: 1 })).toEqual(["review", "published"]);

    expect(() => instance.transition("published", { approved: false, revision: 2 })).toThrow(
      expect.objectContaining({ reason: "guard-rejected" }),
    );
    expect(instance.state).toBe("draft");
  });

  it("enforces a manual edge's guard when the operator names it", () => {
    const instance = publication().start();
    expect(() => instance.transition("cancelled", { approved: false, revision: 1 })).toThrow(
      expect.objectContaining({ reason: "guard-rejected" }),
    );
    expect(instance.state).toBe("draft");

    expect(instance.transition("cancelled", { approved: true, revision: 2 })).toEqual({
      from: "draft", to: "cancelled", effect: undefined,
    });
    expect(instance.state).toBe("cancelled");
  });

  it("allows a final state to move and a facts-less machine to transition(to)", () => {
    const instance = defineMachine()({
      initial: "park",
      states: {
        park: { final: true, targets: [{ name: "drive" }] },
        drive: { targets: [{ name: "park" }] },
      },
    }).start();

    expect(instance.isFinal).toBe(true);
    expect(instance.available()).toEqual(["drive"]);
    expect(instance.transition("drive")).toEqual({ from: "park", to: "drive", effect: undefined });
    expect(instance.isFinal).toBe(false);
    expect(instance.transition("park")).toEqual({ from: "drive", to: "park", effect: undefined });
    expect(instance.isFinal).toBe(true);
  });
});
