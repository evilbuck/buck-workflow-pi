/**
 * Domain-neutral, synchronous state-machine rule evaluator.
 *
 * Consumers own facts, states, events, choices, and opaque outputs. This
 * module only selects one valid route and rejects missing, ambiguous, stale,
 * or otherwise illegal decisions.
 */

export type MachineFailureCode =
  | "MISSING_STATE"
  | "TERMINAL_STATE"
  | "AMBIGUOUS_AUTOMATIC"
  | "AMBIGUOUS_ROUTE"
  | "NO_ROUTE"
  | "AMBIGUOUS_CHOICE"
  | "ILLEGAL_CHOICE"
  | "UNKNOWN_EVENT"
  | "INVALID_EVENT"
  | "AMBIGUOUS_EVENT"
  | "INVALID_TERMINAL_EVENT"
  | "INVALID_TARGET"
  | "UNSUPPORTED_CHOICE";

const FAILURE_SUMMARY: Record<MachineFailureCode, string> = {
  MISSING_STATE: "state is not defined",
  TERMINAL_STATE: "cannot advance a terminal state",
  AMBIGUOUS_AUTOMATIC: "multiple automatic rules are enabled",
  AMBIGUOUS_ROUTE: "automatic and choice routes are both enabled",
  NO_ROUTE: "no automatic or choice route is enabled",
  AMBIGUOUS_CHOICE: "multiple enabled choice rules share one key",
  ILLEGAL_CHOICE: "choice is not legal",
  UNKNOWN_EVENT: "event is not defined",
  INVALID_EVENT: "event is not enabled",
  AMBIGUOUS_EVENT: "multiple event rules are enabled",
  INVALID_TERMINAL_EVENT: "cannot send an event to a terminal state",
  INVALID_TARGET: "rule targets an undefined state",
  UNSUPPORTED_CHOICE: "choice cannot be isolated",
};

/**
 * Thrown for every illegal machine operation. Fails closed: no defaults, no
 * silent fallbacks, no declaration-order tiebreakers.
 *
 * Handle with `error.code` (machine-readable, from {@link MachineFailureCode})
 * and `error.context` (structured detail: state, ruleIds, legalChoiceKeys, …).
 * Assert on `code` in tests, never on message text.
 */
export class MachineFailure extends Error {
  constructor(
    readonly code: MachineFailureCode,
    readonly context: Readonly<Record<string, unknown>>,
  ) {
    super(`${FAILURE_SUMMARY[code]} (${String(context.state ?? "unknown")})`);
    this.name = "MachineFailure";
  }
}

export interface AutomaticRule<State, Facts, Output> {
  readonly id: string;
  readonly when: (facts: Facts) => boolean;
  readonly target: State;
  readonly output: (facts: Facts) => Output;
}

export interface ChoiceRule<State, Facts, Choice, Output> {
  readonly id: string;
  readonly choice: Choice;
  readonly when: (facts: Facts) => boolean;
  readonly target: State;
  readonly output: (facts: Facts, choice: Choice) => Output;
}

export interface EventRule<State, Facts, Event, Output> {
  readonly id: string;
  readonly event: Event;
  readonly when: (facts: Facts, event: Event) => boolean;
  readonly target: State;
  readonly output: (facts: Facts, event: Event) => Output;
}

export interface StateDefinition<State, Facts, Choice, Event, Output> {
  readonly terminal?: boolean;
  readonly automatic?: readonly AutomaticRule<State, Facts, Output>[];
  readonly choices?: readonly ChoiceRule<State, Facts, Choice, Output>[];
  readonly events?: readonly EventRule<State, Facts, Event, Output>[];
}

export interface MachineDefinition<State extends PropertyKey, Facts, Choice, Event, Output> {
  readonly stateOf: (facts: Facts) => State;
  readonly choiceKey: (choice: Choice) => PropertyKey;
  readonly eventKey: (event: Event) => PropertyKey;
  readonly states: Partial<Record<State, StateDefinition<State, Facts, Choice, Event, Output>>>;
}

export type TransitionDecision<State, Output> = {
  readonly kind: "transition";
  readonly from: State;
  readonly to: State;
  readonly output: Output;
};

export type ChoiceDecision<State, Choice> = {
  readonly kind: "choices";
  readonly state: State;
  readonly choices: readonly Choice[];
};

export type AdvanceDecision<State, Choice, Output> =
  | TransitionDecision<State, Output>
  | ChoiceDecision<State, Choice>;

export interface CompiledMachine<State, Facts, Choice, Event, Output> {
  /**
   * Drives the loop tick. Returns a `transition` when exactly one automatic
   * rule is enabled, or a `choices` listing the currently legal options when
   * an outside decision is required. Feed a returned choice back into
   * {@link CompiledMachine.choose} — choices go stale when facts change.
   *
   * @param facts - Current snapshot; `stateOf(facts)` must name a declared state.
   * @returns One validated transition or the legal choice set.
   * @throws {MachineFailure} `MISSING_STATE`, `TERMINAL_STATE`,
   *   `AMBIGUOUS_AUTOMATIC`, `AMBIGUOUS_ROUTE`, `NO_ROUTE`, `INVALID_TARGET`,
   *   or `UNSUPPORTED_CHOICE`.
   */
  advance(facts: Facts): AdvanceDecision<State, Choice, Output>;
  /**
   * Consumes a choice previously returned by {@link CompiledMachine.advance}.
   * Matched by `choiceKey` against choices legal for the *current* facts —
   * stale choices are rejected, never replayed.
   *
   * @param facts - Current snapshot.
   * @param choice - One of the choices `advance` returned.
   * @returns The validated transition, with the declared choice deep-cloned
   *   into `output` so no mutable memory is shared with the caller.
   * @throws {MachineFailure} `MISSING_STATE`, `TERMINAL_STATE`, `ILLEGAL_CHOICE`,
   *   `INVALID_TARGET`, or `UNSUPPORTED_CHOICE`.
   */
  choose(facts: Facts, choice: Choice): TransitionDecision<State, Output>;
  /**
   * Applies an external signal (operator command, UI event). Matched by
   * `eventKey`; exactly one matching rule's `when` must pass.
   *
   * @param facts - Current snapshot.
   * @param event - The incoming signal.
   * @returns The validated transition.
   * @throws {MachineFailure} `MISSING_STATE`, `INVALID_TERMINAL_EVENT`,
   *   `UNKNOWN_EVENT`, `INVALID_EVENT`, `AMBIGUOUS_EVENT`, `INVALID_TARGET`.
   */
  send(facts: Facts, event: Event): TransitionDecision<State, Output>;
}

type Operation = "advance" | "choose" | "send";

type LocatedState<State extends PropertyKey, Facts, Choice, Event, Output> = {
  state: State;
  definition: StateDefinition<State, Facts, Choice, Event, Output>;
};
type IsolatedChoiceRule<State, Facts, Choice, Output> = {
  rule: ChoiceRule<State, Facts, Choice, Output>;
  choice: Choice;
  key: PropertyKey;
};


/**
 * Compiles a machine definition into an evaluator with three operations:
 * `advance` (drive the loop), `choose` (consume a picked choice), and `send`
 * (apply an external event). All are synchronous and pure in `facts`; every
 * illegal situation throws {@link MachineFailure} rather than guessing.
 *
 * Outputs describe effects; the caller executes them. The evaluator owns no
 * state between calls — everything it knows comes from the facts passed in.
 *
 * @param machine - Declarative definition: state extraction, choice/event
 *   identity keys, and per-state rules. Every rule needs a unique, grep-able
 *   `id`; `when` predicates must be pure and mutually exclusive within a list.
 * @returns A compiled machine. It is stateless and safe to share.
 *
 * @example
 * ```ts
 * type State = "draft" | "published";
 * type Facts = { state: State; ready: boolean };
 *
 * const machine = defineMachine<State, Facts, never, never, null>({
 *   stateOf: (f) => f.state,
 *   choiceKey: (c) => c,
 *   eventKey: (e) => e,
 *   states: {
 *     draft: {
 *       automatic: [{ id: "go", when: (f) => f.ready, target: "published", output: () => null }],
 *     },
 *     published: { terminal: true },
 *   },
 * });
 *
 * machine.advance({ state: "draft", ready: true });
 * // => { kind: "transition", from: "draft", to: "published", output: null }
 * ```
 */
export function defineMachine<State extends PropertyKey, Facts, Choice, Event, Output>(
  machine: MachineDefinition<State, Facts, Choice, Event, Output>,
): CompiledMachine<State, Facts, Choice, Event, Output> {
  const isolatedChoices = new Map<
    ChoiceRule<State, Facts, Choice, Output>,
    IsolatedChoiceRule<State, Facts, Choice, Output>
  >();
  for (const stateKey of Reflect.ownKeys(machine.states)) {
    const definition = machine.states[stateKey as State];
    for (const rule of definition?.choices ?? []) {
      const choice = cloneChoice(rule.choice, {
        definitionState: stateKey,
        ruleId: rule.id,
        operation: "define",
      });
      isolatedChoices.set(rule, { rule, choice, key: machine.choiceKey(choice) });
    }
  }

  function locate(facts: Facts, operation: Operation): LocatedState<State, Facts, Choice, Event, Output> {
    const state = machine.stateOf(facts);
    if (!hasState(machine.states, state)) {
      throw new MachineFailure("MISSING_STATE", { state, operation });
    }
    return { state, definition: machine.states[state] };
  }

  function validateTarget(state: State, target: State, ruleId: string, operation: Operation): void {
    if (!hasState(machine.states, target)) {
      throw new MachineFailure("INVALID_TARGET", { state, target, ruleId, operation });
    }
  }

  function transition(
    state: State,
    target: State,
    output: () => Output,
    ruleId: string,
    operation: Operation,
  ): TransitionDecision<State, Output> {
    validateTarget(state, target, ruleId, operation);
    return { kind: "transition", from: state, to: target, output: output() };
  }

  function evaluateRoutes(
    state: State,
    definition: StateDefinition<State, Facts, Choice, Event, Output>,
    facts: Facts,
  ): {
    automatic: AutomaticRule<State, Facts, Output> | undefined;
    choices: readonly IsolatedChoiceRule<State, Facts, Choice, Output>[];
  } {
    const automatic = (definition.automatic ?? []).filter((rule) => rule.when(facts));
    if (automatic.length > 1) {
      throw new MachineFailure("AMBIGUOUS_AUTOMATIC", {
        state,
        ruleIds: automatic.map((rule) => rule.id),
      });
    }

    const choices = (definition.choices ?? [])
      .filter((rule) => rule.when(facts))
      .map((rule) => {
        const isolated = isolatedChoices.get(rule);
        if (!isolated) {
          throw new MachineFailure("UNSUPPORTED_CHOICE", {
            state,
            ruleId: rule.id,
            operation: "evaluate",
            reason: "choice rule was added after machine definition",
          });
        }
        return isolated;
      });
    assertUniqueChoiceKeys(state, choices);
    if (automatic.length === 1 && choices.length > 0) {
      throw new MachineFailure("AMBIGUOUS_ROUTE", {
        state,
        automaticRuleId: automatic[0].id,
        choiceRuleIds: choices.map(({ rule }) => rule.id),
      });
    }
    return { automatic: automatic[0], choices };
  }

  return {
    advance(facts) {
      const { state, definition } = locate(facts, "advance");
      if (definition.terminal) {
        throw new MachineFailure("TERMINAL_STATE", { state, operation: "advance" });
      }

      const { automatic, choices } = evaluateRoutes(state, definition, facts);
      if (automatic) {
        return transition(state, automatic.target, () => automatic.output(facts), automatic.id, "advance");
      }
      if (choices.length > 0) {
        return {
          kind: "choices",
          state,
          choices: choices.map(({ choice, rule }) =>
            cloneChoice(choice, { state, ruleId: rule.id, operation: "advance" }),
          ),
        };
      }
      throw new MachineFailure("NO_ROUTE", { state, operation: "advance" });
    },

    choose(facts, choice) {
      const { state, definition } = locate(facts, "choose");
      const choiceKey = machine.choiceKey(choice);
      if (definition.terminal) {
        throw new MachineFailure("ILLEGAL_CHOICE", { state, choiceKey, terminal: true });
      }

      const { choices } = evaluateRoutes(state, definition, facts);
      const matching = choices.filter((candidate) => candidate.key === choiceKey);
      if (matching.length !== 1) {
        throw new MachineFailure("ILLEGAL_CHOICE", {
          state,
          choiceKey,
          legalChoiceKeys: choices.map((candidate) => candidate.key),
        });
      }
      const { rule, choice: declaredChoice } = matching[0];
      return transition(
        state,
        rule.target,
        () => rule.output(facts, cloneChoice(declaredChoice, { state, ruleId: rule.id, operation: "choose" })),
        rule.id,
        "choose",
      );
    },

    send(facts, event) {
      const { state, definition } = locate(facts, "send");
      const eventKey = machine.eventKey(event);
      if (definition.terminal) {
        throw new MachineFailure("INVALID_TERMINAL_EVENT", { state, eventKey });
      }

      const matching = (definition.events ?? []).filter(
        (rule) => machine.eventKey(rule.event) === eventKey,
      );
      if (matching.length === 0) {
        throw new MachineFailure("UNKNOWN_EVENT", {
          state,
          eventKey,
          knownEventKeys: (definition.events ?? []).map((rule) => machine.eventKey(rule.event)),
        });
      }
      const enabled = matching.filter((rule) => rule.when(facts, event));
      if (enabled.length === 0) {
        throw new MachineFailure("INVALID_EVENT", { state, eventKey, ruleIds: matching.map((rule) => rule.id) });
      }
      if (enabled.length > 1) {
        throw new MachineFailure("AMBIGUOUS_EVENT", { state, eventKey, ruleIds: enabled.map((rule) => rule.id) });
      }
      const rule = enabled[0];
      return transition(state, rule.target, () => rule.output(facts, event), rule.id, "send");
    },
  };
}

function assertUniqueChoiceKeys<State, Facts, Choice, Output>(
  state: State,
  choices: readonly IsolatedChoiceRule<State, Facts, Choice, Output>[],
): void {
  const byKey = new Map<PropertyKey, string[]>();
  for (const { key, rule } of choices) {
    const ids = byKey.get(key);
    if (ids) ids.push(rule.id);
    else byKey.set(key, [rule.id]);
  }
  for (const [key, ruleIds] of byKey) {
    if (ruleIds.length > 1) {
      throw new MachineFailure("AMBIGUOUS_CHOICE", { state, choiceKey: key, ruleIds });
    }
  }
}

function cloneChoice<Choice>(choice: Choice, context: Readonly<Record<string, unknown>>): Choice {
  if (choice === null || (typeof choice !== "object" && typeof choice !== "function")) return choice;
  if (typeof choice === "function") {
    throw new MachineFailure("UNSUPPORTED_CHOICE", { ...context, reason: "functions are not cloneable" });
  }

  try {
    const cloned = structuredClone(choice);
    assertNoSharedMemory(cloned, context);
    return cloned;
  } catch (error) {
    if (error instanceof MachineFailure) throw error;
    throw new MachineFailure("UNSUPPORTED_CHOICE", {
      ...context,
      reason: error instanceof Error ? error.name : "choice clone failed",
    });
  }
}

function assertNoSharedMemory(
  value: unknown,
  context: Readonly<Record<string, unknown>>,
  seen = new WeakSet<object>(),
): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);

  const sharedArrayBuffer =
    typeof SharedArrayBuffer === "undefined" ? undefined : SharedArrayBuffer;
  if (
    (sharedArrayBuffer && value instanceof sharedArrayBuffer) ||
    (ArrayBuffer.isView(value) && sharedArrayBuffer && value.buffer instanceof sharedArrayBuffer)
  ) {
    throw new MachineFailure("UNSUPPORTED_CHOICE", {
      ...context,
      reason: "shared memory cannot be isolated",
    });
  }
  if (value instanceof Map) {
    for (const [key, entry] of value) {
      assertNoSharedMemory(key, context, seen);
      assertNoSharedMemory(entry, context, seen);
    }
    return;
  }
  if (value instanceof Set) {
    for (const entry of value) assertNoSharedMemory(entry, context, seen);
    return;
  }
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    if ("value" in descriptor) assertNoSharedMemory(descriptor.value, context, seen);
  }
}

function hasState<State extends PropertyKey, Definition>(
  states: Partial<Record<State, Definition>>,
  state: State,
): states is Partial<Record<State, Definition>> & Record<State, Definition> {
  return Object.prototype.hasOwnProperty.call(states, state);
}

