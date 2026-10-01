// A state machine a human can read top to bottom.
//
// Two phases, never mixed:
//   1. defineMachine<Facts, Effect>()(...)    — static graph, validated once, holds no current state
//   2. definition.start()                     — instance at `initial`
//      definition.restore(name)               — instance rebuilt from outside (persisted state, etc.)
//
// Vocabulary:
//   initial  — machine-level: where start() begins. Exactly one.
//   final    — state-level: a legal place for a run to end. May still have targets,
//              so the initial state can also be final (park: start here, finish here).
//   targets  — edges out of a state. Always declared; [] means nothing leaves it.
//              Each target is one row of a from/to join table: { name, guard?, effect?, manual? }.
//              At most one row (so at most one guard) per from -> to pair.
//   guard    — (facts) => boolean on one edge. true = allowed now. Pure and synchronous.
//   manual   — operator-only edge (STOP, START, resume). available() never offers it, so the
//              loop cannot take it on its own; transition() still takes it when the caller
//              names it. May also carry a guard (resume that depends on the facts).
//   effect   — (facts) => Effect on one edge. Describes work as data; never performs it.
//              transition() returns it and the caller runs it, so the caller owns async,
//              retries, and failure handling. The machine never sees an effect fail.
//   facts    — caller-owned data about the world (speed, plan status), passed to transition().
//              Rebuilt by the caller each time; the machine reads it and never stores it.

// ---------------------------------------------------------------------------
// Definition types
// ---------------------------------------------------------------------------

export type Guard<Facts> = (facts: Facts) => boolean;
export type EffectOf<Facts, Effect> = (facts: Facts) => Effect;

type EdgeRule<Facts, Effect> = {
  readonly guard?: Guard<Facts>;
  readonly effect?: EffectOf<Facts, Effect>;
  /** Operator-only: hidden from available(); transition() still takes it when named. */
  readonly manual?: true;
};

// One row of the from -> to join table. `name` is the target state.
type Edge<Name extends string, Facts, Effect> = { readonly name: Name } & EdgeRule<Facts, Effect>;

type StateDef<Name extends string, Facts, Effect> = {
  readonly targets: readonly Edge<Name, Facts, Effect>[];
  readonly final?: true;
};

/** What transition() hands back. `effect` is undefined when the edge declares none. */
export type Transition<Name extends string, Effect> = {
  readonly from: Name;
  readonly to: Name;
  readonly effect: Effect | undefined;
};

// Machines without guards/effects need no facts: transition(to). Otherwise transition(to, facts).
type FactsArg<Facts> = [Facts] extends [void] ? [] : [facts: Facts];

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: string,
    readonly to: string,
    /** not-a-target: no such edge (definition or caller bug). guard-rejected: edge exists, blocked now. */
    readonly reason: "not-a-target" | "guard-rejected",
  ) {
    super(`illegal transition ${from} -> ${to} (${reason})`);
    this.name = "IllegalTransitionError";
  }
}

export class UnknownStateError extends Error {
  constructor(readonly state: string) {
    super(`unknown state: ${state}`);
    this.name = "UnknownStateError";
  }
}

export class InvalidMachineError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`invalid machine: ${problems.join("; ")}`);
    this.name = "InvalidMachineError";
  }
}

// ---------------------------------------------------------------------------
// Phase 1: definition
// ---------------------------------------------------------------------------

export interface MachineDefinition<Name extends string, Facts, Effect> {
  readonly initial: Name;
  /** Static graph: every declared target, guarded or not. */
  targets(state: Name): readonly Name[];
  isFinal(state: Name): boolean;
  /** Guard and effect for one edge; throws on a missing edge. */
  edge(from: Name, to: Name): EdgeRule<Facts, Effect>;
  start(): MachineInstance<Name, Facts, Effect>;
  /** Untrusted input (disk, JSON, another process): validated, never assumed. */
  restore(state: string): MachineInstance<Name, Facts, Effect>;
}

// Curried so Facts and Effect are written once and every guard/effect is typed from them.
// Name is inferred from the keys of `states` only (NoInfer elsewhere), so a typo
// in a target or `initial` is a compile error, not a new state name.
export function defineMachine<Facts = void, Effect = never>() {
  return <const Name extends string>(config: {
    readonly initial: NoInfer<Name>;
    readonly states: { readonly [K in Name]: StateDef<NoInfer<Name>, Facts, Effect> };
  }): MachineDefinition<Name, Facts, Effect> => {
    const initial = config.initial;
    const edges = normalize<Facts, Effect>(config.states);
    assertValid(initial, config.states, edges);
    const finalStates = new Set(
      Object.entries<StateDef<Name, Facts, Effect>>(config.states)
        .filter(([, state]) => state.final === true).map(([name]) => name),
    );

    const has = (state: string): state is Name => edges.has(state);

    const definition: MachineDefinition<Name, Facts, Effect> = {
      initial,
      targets: (state) => [...edges.get(state)!.keys()] as Name[],
      isFinal: (state) => finalStates.has(state),
      edge: (from, to) => {
        const rule = edges.get(from)!.get(to);
        if (!rule) throw new IllegalTransitionError(from, to, "not-a-target");
        return rule;
      },
      start: () => new MachineInstance(definition, initial),
      restore: (state) => {
        if (!has(state)) throw new UnknownStateError(state);
        return new MachineInstance(definition, state);
      },
    };
    return definition;
  };
}

// state -> (target -> rule).
type EdgeMap<Facts, Effect> = Map<string, Map<string, EdgeRule<Facts, Effect>>>;

function normalize<Facts, Effect>(
  states: Record<string, StateDef<string, Facts, Effect>>,
): EdgeMap<Facts, Effect> {
  const edges: EdgeMap<Facts, Effect> = new Map();
  for (const [name, state] of Object.entries(states)) {
    const out = new Map<string, EdgeRule<Facts, Effect>>();
    for (const { name: to, guard, effect, manual } of state.targets) {
      if (!Object.hasOwn(states, to)) throw new InvalidMachineError([`undeclared target: ${name} -> ${to}`]);
      if (out.has(to)) throw new InvalidMachineError([`duplicate edge: ${name} -> ${to}`]);
      out.set(to, { guard, effect, manual });
    }
    edges.set(name, out);
  }
  return edges;
}

// Compile time already rejects undeclared targets and an unknown initial.
// Runtime catches what types cannot:
//   - duplicate edges (normalize)
//   - unreachable states (declared but no path from initial; guards ignored — this is the static graph)
//   - stuck states (nothing leaves, yet the run may not end there)
//   - no way to finish (no final state declared)
function assertValid<Facts, Effect>(
  initial: string,
  states: Record<string, StateDef<string, Facts, Effect>>,
  edges: EdgeMap<Facts, Effect>,
): void {
  const reached = new Set<string>([initial]);
  const queue = [initial];
  for (let state = queue.shift(); state !== undefined; state = queue.shift()) {
    for (const target of edges.get(state)!.keys()) {
      if (!reached.has(target)) {
        reached.add(target);
        queue.push(target);
      }
    }
  }

  const problems: string[] = [];
  for (const [name, state] of Object.entries(states)) {
    if (!reached.has(name)) problems.push(`unreachable from ${initial}: ${name}`);
    if (state.targets.length === 0 && state.final !== true) problems.push(`stuck (no targets, not final): ${name}`);
  }
  if (!Object.values(states).some((state) => state.final === true)) problems.push("no final state");
  if (problems.length > 0) throw new InvalidMachineError(problems);
}

// ---------------------------------------------------------------------------
// Phase 2: instance (the only thing that holds a current state)
// ---------------------------------------------------------------------------

export class MachineInstance<Name extends string, Facts, Effect> {
  #state: Name;

  constructor(
    readonly definition: MachineDefinition<Name, Facts, Effect>,
    state: Name,
  ) {
    this.#state = state;
  }

  get state(): Name {
    return this.#state;
  }

  /** True when the run may legally end here. Does not prevent further transitions. */
  get isFinal(): boolean {
    return this.definition.isFinal(this.#state);
  }

  /**
   * Targets reachable right now: every edge out of the current state whose guard passes
   * (unguarded edges always pass). One result, several, or none — what to do with that
   * count is the caller's policy, not the machine's. Manual edges are never included.
   *
   * DEFERRED (known gap): because manual edges are hidden, a UI cannot list the operator's
   * options from here. If that is needed, add an opt-in such as
   * `available(facts, { includeManual: true })`; keep the default (exclude manual) unchanged
   * so the loop tick can never take an operator edge.
   */
  available(...[facts]: FactsArg<Facts>): readonly Name[] {
    return this.definition.targets(this.#state).filter((to) => {
      const { guard, manual } = this.definition.edge(this.#state, to);
      return !manual && (guard?.(facts as Facts) ?? true);
    });
  }

  /**
   * Order: edge exists -> guard passes -> effect described -> state moves.
   * Anything that throws before the last step (missing edge, rejected guard, a throwing
   * guard or effect function) leaves the state unchanged.
   */
  transition(to: Name, ...[facts]: FactsArg<Facts>): Transition<Name, Effect> {
    const from = this.#state;
    const { guard, effect } = this.definition.edge(from, to);
    if (guard && !guard(facts as Facts)) {
      throw new IllegalTransitionError(from, to, "guard-rejected");
    }
    const described = effect?.(facts as Facts);
    this.#state = to;
    return { from, to, effect: described };
  }
}
