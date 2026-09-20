import { describe, expect, it } from "vitest";
import { defineMachine, MachineFailure } from "./state-machine.js";

type State = "draft" | "review" | "published" | "cancelled" | "missing";
type Choice = { kind: "publish" } | { kind: "revise" } | { kind: "delete" };
type Event = { type: "submit" } | { type: "cancel" } | { type: "reopen" };
type Facts = {
  state: State;
  reviewComplete: boolean;
  canPublish: boolean;
  version: number;
};
type Output =
  | { task: "announce"; audience: number }
  | { task: "edit"; preserveDraft: boolean }
  | { task: "queue-review"; revision: number }
  | { task: "discard"; reason: string };

const publish: Choice = { kind: "publish" };
const revise: Choice = { kind: "revise" };

function facts(overrides: Partial<Facts> = {}): Facts {
  return {
    state: "review",
    reviewComplete: false,
    canPublish: true,
    version: 3,
    ...overrides,
  };
}

function fixture() {
  return defineMachine<State, Facts, Choice, Event, Output>({
    stateOf: (current) => current.state,
    choiceKey: (choice) => choice.kind,
    eventKey: (event) => event.type,
    states: {
      draft: {
        events: [
          {
            id: "submit-draft",
            event: { type: "submit" },
            when: (current) => current.version > 0,
            target: "review",
            output: (current) => ({ task: "queue-review", revision: current.version }),
          },
          {
            id: "cancel-draft",
            event: { type: "cancel" },
            when: () => true,
            target: "cancelled",
            output: () => ({ task: "discard", reason: "operator cancelled" }),
          },
        ],
      },
      review: {
        automatic: [
          {
            id: "review-complete",
            when: (current) => current.reviewComplete,
            target: "published",
            output: () => ({ task: "announce", audience: 42 }),
          },
        ],
        choices: [
          {
            id: "publish-approved",
            choice: publish,
            when: (current) => !current.reviewComplete && current.canPublish,
            target: "published",
            output: () => ({ task: "announce", audience: 7 }),
          },
          {
            id: "revise-draft",
            choice: revise,
            when: (current) => !current.reviewComplete,
            target: "draft",
            output: () => ({ task: "edit", preserveDraft: true }),
          },
        ],
      },
      published: { terminal: true },
      cancelled: { terminal: true },
    },
  });
}

function expectFailure(action: () => unknown, code: MachineFailure["code"]) {
  try {
    action();
    throw new Error(`expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(MachineFailure);
    expect(error).toMatchObject({ code });
    return error as MachineFailure;
  }
}

describe("automatic evaluation", () => {
  it("takes the only enabled automatic rule and preserves opaque domain output", () => {
    expect(fixture().advance(facts({ reviewComplete: true }))).toEqual({
      kind: "transition",
      from: "review",
      to: "published",
      output: { task: "announce", audience: 42 },
    });
  });

  it("fails when multiple automatic rules are enabled instead of using declaration order", () => {
    const machine = defineMachine({
      stateOf: (current: { state: "open" | "done" }) => current.state,
      choiceKey: (choice: string) => choice,
      eventKey: (event: string) => event,
      states: {
        open: {
          automatic: [
            { id: "first", when: () => true, target: "done", output: () => "first" },
            { id: "second", when: () => true, target: "done", output: () => "second" },
          ],
        },
        done: { terminal: true },
      },
    });

    const error = expectFailure(() => machine.advance({ state: "open" }), "AMBIGUOUS_AUTOMATIC");
    expect(error.context).toMatchObject({ state: "open", ruleIds: ["first", "second"] });
  });

  it("fails when a non-terminal state has no enabled automatic or choice route", () => {
    expectFailure(() => fixture().advance(facts({ state: "draft" })), "NO_ROUTE");
  });
});

describe("closed choices", () => {
  it("derives legal choices from enabled choice rules", () => {
    expect(fixture().advance(facts())).toEqual({
      kind: "choices",
      state: "review",
      choices: [publish, revise],
    });
    expect(fixture().advance(facts({ canPublish: false }))).toEqual({
      kind: "choices",
      state: "review",
      choices: [revise],
    });
  });

  it("applies a currently enabled choice through the same rule declaration", () => {
    expect(fixture().choose(facts(), { kind: "publish" })).toEqual({
      kind: "transition",
      from: "review",
      to: "published",
      output: { task: "announce", audience: 7 },
    });
  });

  it("uses the declared choice after key matching instead of caller-supplied fields", () => {
    type Approval = { kind: "approve"; authority: "reviewer" | "admin" };
    const machine = defineMachine<
      "pending" | "approved",
      { state: "pending" },
      Approval,
      string,
      Approval["authority"]
    >({
      stateOf: (current) => current.state,
      choiceKey: (choice) => choice.kind,
      eventKey: (event) => event,
      states: {
        pending: {
          choices: [
            {
              id: "approve",
              choice: { kind: "approve", authority: "reviewer" },
              when: () => true,
              target: "approved",
              output: (_current, choice) => choice.authority,
            },
          ],
        },
        approved: { terminal: true },
      },
    });

    expect(
      machine.choose({ state: "pending" }, { kind: "approve", authority: "admin" }).output,
    ).toBe("reviewer");
  });

  it("isolates supported choices without mutating caller-owned definitions", () => {
    type Approval = {
      kind: "approve";
      details: { authority: "reviewer" | "admin" };
      expiresAt: Date;
      permissions: Map<string, boolean>;
    };
    const declared: Approval = {
      kind: "approve",
      details: { authority: "reviewer" },
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      permissions: new Map([["publish", true]]),
    };
    const machine = defineMachine<
      "pending" | "approved",
      { state: "pending" },
      Approval,
      string,
      { authority: Approval["details"]["authority"]; expiresAt: number; canPublish: boolean }
    >({
      stateOf: (current) => current.state,
      choiceKey: (choice) => choice.kind,
      eventKey: (event) => event,
      states: {
        pending: {
          choices: [
            {
              id: "approve",
              choice: declared,
              when: () => true,
              target: "approved",
              output: (_current, choice) => ({
                authority: choice.details.authority,
                expiresAt: choice.expiresAt.getTime(),
                canPublish: choice.permissions.get("publish") === true,
              }),
            },
          ],
        },
        approved: { terminal: true },
      },
    });

    const offered = machine.advance({ state: "pending" });
    expect(offered.kind).toBe("choices");
    if (offered.kind !== "choices") throw new Error("expected choices");
    offered.choices[0].details.authority = "admin";
    offered.choices[0].expiresAt.setTime(0);
    offered.choices[0].permissions.set("publish", false);

    expect(declared).toEqual({
      kind: "approve",
      details: { authority: "reviewer" },
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      permissions: new Map([["publish", true]]),
    });
    expect(Object.isFrozen(declared)).toBe(false);
    expect(Object.isFrozen(declared.details)).toBe(false);
    expect(machine.choose({ state: "pending" }, offered.choices[0]).output).toEqual({
      authority: "reviewer",
      expiresAt: new Date("2030-01-01T00:00:00.000Z").getTime(),
      canPublish: true,
    });
  });

  it("rejects choices backed by shared memory before they can enter the canonical snapshot", () => {
    const shared = new SharedArrayBuffer(1);
    const declared = {
      kind: "approve",
      payload: { bytes: new Uint8Array(shared) },
    };

    expectFailure(
      () =>
        defineMachine({
          stateOf: (current: { state: "pending" }) => current.state,
          choiceKey: (choice: typeof declared) => choice.kind,
          eventKey: (event: string) => event,
          states: {
            pending: {
              choices: [
                {
                  id: "shared-memory",
                  choice: declared,
                  when: () => true,
                  target: "pending",
                  output: () => "unused",
                },
              ],
            },
          },
        }),
      "UNSUPPORTED_CHOICE",
    );

    new Uint8Array(shared)[0] = 9;
    expect(declared.payload.bytes[0]).toBe(9);
  });

  it("rejects choices that cannot be safely isolated", () => {
    expectFailure(
      () =>
        defineMachine({
          stateOf: (current: { state: "pending" }) => current.state,
          choiceKey: (choice: { kind: string; callback: () => void }) => choice.kind,
          eventKey: (event: string) => event,
          states: {
            pending: {
              choices: [
                {
                  id: "unsafe",
                  choice: { kind: "unsafe", callback: () => undefined },
                  when: () => true,
                  target: "pending",
                  output: () => "unused",
                },
              ],
            },
          },
        }),
      "UNSUPPORTED_CHOICE",
    );

    const proxied = new Proxy({ kind: "unsafe" }, {});
    expectFailure(
      () =>
        defineMachine({
          stateOf: (current: { state: "pending" }) => current.state,
          choiceKey: (choice: { kind: string }) => choice.kind,
          eventKey: (event: string) => event,
          states: {
            pending: {
              choices: [
                {
                  id: "proxied",
                  choice: proxied,
                  when: () => true,
                  target: "pending",
                  output: () => "unused",
                },
              ],
            },
          },
        }),
      "UNSUPPORTED_CHOICE",
    );
  });

  it("rejects stale, forged, and disabled choices", () => {
    const machine = fixture();
    expectFailure(() => machine.choose(facts({ reviewComplete: true }), publish), "ILLEGAL_CHOICE");
    expectFailure(() => machine.choose(facts(), { kind: "delete" }), "ILLEGAL_CHOICE");
    expectFailure(() => machine.choose(facts({ canPublish: false }), publish), "ILLEGAL_CHOICE");
  });

  it("rejects a choice when an automatic route became enabled", () => {
    const machine = defineMachine<"open" | "done", { state: "open"; ready: boolean }, string, string, string>({
      stateOf: (current) => current.state,
      choiceKey: (choice) => choice,
      eventKey: (event) => event,
      states: {
        open: {
          automatic: [{ id: "finish", when: (current) => current.ready, target: "done", output: () => "auto" }],
          choices: [{ id: "wait", choice: "wait", when: () => true, target: "open", output: () => "choice" }],
        },
        done: { terminal: true },
      },
    });

    expectFailure(() => machine.choose({ state: "open", ready: true }, "wait"), "AMBIGUOUS_ROUTE");
  });
});

describe("external events", () => {
  it("dispatches a valid event and passes domain facts to its output", () => {
    expect(fixture().send(facts({ state: "draft", version: 9 }), { type: "submit" })).toEqual({
      kind: "transition",
      from: "draft",
      to: "review",
      output: { task: "queue-review", revision: 9 },
    });
  });

  it("distinguishes unknown, disabled, and terminal event paths", () => {
    const machine = fixture();
    expectFailure(() => machine.send(facts({ state: "draft" }), { type: "reopen" }), "UNKNOWN_EVENT");
    expectFailure(
      () => machine.send(facts({ state: "draft", version: 0 }), { type: "submit" }),
      "INVALID_EVENT",
    );
    expectFailure(
      () => machine.send(facts({ state: "published" }), { type: "cancel" }),
      "INVALID_TERMINAL_EVENT",
    );
  });
});

describe("state and target validation", () => {
  it("fails with structured context when the current state is missing", () => {
    const error = expectFailure(() => fixture().advance(facts({ state: "missing" })), "MISSING_STATE");
    expect(error.context).toMatchObject({ state: "missing", operation: "advance" });
  });

  it("validates a selected transition target before producing output", () => {
    const machine = defineMachine<"open" | "ghost", { state: "open" | "ghost" }, string, string, string>({
      stateOf: (current) => current.state,
      choiceKey: (choice) => choice,
      eventKey: (event) => event,
      states: {
        open: {
          automatic: [{ id: "vanish", when: () => true, target: "ghost", output: () => "unreachable" }],
        },
      },
    });

    const error = expectFailure(() => machine.advance({ state: "open" }), "INVALID_TARGET");
    expect(error.context).toMatchObject({ state: "open", target: "ghost", ruleId: "vanish" });
  });
});
