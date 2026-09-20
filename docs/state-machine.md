# State-Machine Evaluator — Usage Guide

This guide explains how to use the state-machine evaluator in `extensions/state-machine.ts`. It assumes you have **no prior knowledge of this project**, of Pi/OMP extensions, or of state machines in general. Everything you need is on this page. The evaluator itself also carries JSDoc with runnable `@example` blocks — your editor will show them on hover over `defineMachine`.

## 1. What is a state machine, and why use one?

Long-running automation (a build loop, a deploy pipeline, a review cycle) tends to grow into spaghetti: a pile of `if`s and boolean flags where it's impossible to know what happens next, or why the code tried something illegal.

A **state machine** fixes this by making the flow explicit:

- The system is always in exactly one **state** (e.g. `idle`, `building`, `blocked`, `done`).
- Moving between states is a **transition**, and every legal transition is written down up front as a **rule**.
- Anything not written down is impossible — the machine *refuses* rather than guessing.

This project contains a small, dependency-free, synchronous evaluator implementing exactly that: one TypeScript file, `extensions/state-machine.ts`.

**What it does:** given a description of your states and rules plus a snapshot of the current situation ("facts"), it tells you the one legal next step — or throws if the situation is illegal or ambiguous.

**What it does NOT do:** it never performs work itself. No file writes, no API calls, no sleeps, no commands. It only *decides*; you execute. Decisions are pure and testable; execution lives in your code.

## 2. The five things you must provide

`defineMachine` takes five type parameters:

| Type parameter | Meaning | Example |
|---|---|---|
| `State` | Names of your states | `"draft" \| "review" \| "published"` |
| `Facts` | Everything you know right now, including the current state | `{ state: "draft", wordCount: 300 }` |
| `Choice` | Options presented to a human or AI that picks one | `{ kind: "approve" } \| { kind: "reject" }` |
| `Event` | External signals pushed in from outside | `{ type: "SUBMIT" } \| { type: "CANCEL" }` |
| `Output` | A *description* of work to do — not the work itself | `{ effect: "notify-editor" }` |

The evaluator is generic: it knows nothing about documents, builds, or emails. You teach it your domain through these five types.

## 3. Defining a machine — a complete example

A tiny document-approval workflow. This compiles and runs as-is (see §5 for driving it):

```ts
import { defineMachine, MachineFailure } from "../state-machine.js";

type State = "draft" | "review" | "published";
type Facts = { state: State; wordCount: number; editorBusy: boolean };
type Choice = { kind: "approve" } | { kind: "reject" };
type Event = { type: "SUBMIT" };
type Output = { effect: "notify-editor" } | { effect: "none" };

const machine = defineMachine<State, Facts, Choice, Event, Output>({
  // How to read the current state out of your facts:
  stateOf: (facts) => facts.state,
  // How to tell two choices apart (matches an answer back to a rule):
  choiceKey: (c) => c.kind,
  // How to tell two events apart:
  eventKey: (e) => e.type,

  states: {
    draft: {
      events: [
        {
          id: "submit",                        // required, unique, grep-able
          event: { type: "SUBMIT" },
          when: (f) => f.wordCount >= 200,     // gate: allowed only if long enough
          target: "review",
          output: () => ({ effect: "notify-editor" }), // caller acts on this
        },
      ],
    },
    review: {
      choices: [
        {
          id: "await-approval",
          choice: { kind: "approve" },
          when: (f) => !f.editorBusy,          // can only approve when editor is free
          target: "published",
          output: () => ({ effect: "none" }),
        },
        {
          id: "await-rejection",
          choice: { kind: "reject" },
          when: () => true,
          target: "draft",
          output: () => ({ effect: "none" }),
        },
      ],
    },
    published: { terminal: true },             // nothing leaves a terminal state
  },
});
```

Rules about rules:

- **`id`** is required and appears in every error message — make it unique and grep-able.
- **`when`** is a pure predicate over the facts (plus the event, for event rules). No side effects. If two rules in the same list could both fire, that's a definition bug — the machine throws instead of picking one.
- **`output`** returns a description of work. The machine never executes it.
- **`target`** must be a declared state. A bad target throws `INVALID_TARGET` when the rule is evaluated, not at definition time — so tests must exercise every rule (§8).
- **`terminal: true`** marks a finished state; `advance`, `choose`, and `send` all throw there.

### The three rule kinds, by example

```ts
// automatic: fires by itself when `when(facts)` is true — no outside input needed.
//     Used for "the situation itself determines what happens next".
automatic: [{ id: "publish-ready", when: (f) => f.wordCount > 5000, target: "published", output: ... }]

// choices: the machine PAUSES and asks an outside decision-maker to pick one.
//     Used for human/AI decisions. advance() returns the legal list; choose() consumes a pick.
choices: [{ id: "await-approval", choice: { kind: "approve" }, when: ..., target: ..., output: ... }]

// events: an external signal PUSHED in (button click, operator command).
//     Used for operator intent. send() applies one.
events: [{ id: "submit", event: { type: "SUBMIT" }, when: ..., target: ..., output: ... }]
```

## 4. The three operations — with output shown

All synchronous. Each example assumes the machine and facts from §3.

### `advance(facts)` — "what happens next?"

```ts
const facts = { state: "review", wordCount: 300, editorBusy: false };

const decision = machine.advance(facts);
// => { kind: "choices", state: "review", choices: [{kind:"approve"}, {kind:"reject"}] }
// No automatic rule exists in "review", so the machine asks for a decision.
```

Two return shapes:

```ts
if (decision.kind === "transition") {
  decision.from;    // "review"
  decision.to;      // "published"
  decision.output;  // { effect: "notify-editor" } — you execute this
} else {
  decision.state;   // where we're paused
  decision.choices; // legal options right now — show these, collect one, call choose()
}
```

### `choose(facts, choice)` — "consume a picked choice"

```ts
const d = machine.choose(facts, { kind: "approve" });
// => { kind: "transition", from: "review", to: "published", output: { effect: "none" } }

// If the facts changed and "approve" is no longer legal:
machine.choose({ state: "review", wordCount: 300, editorBusy: true }, { kind: "approve" });
// throws MachineFailure, code "ILLEGAL_CHOICE",
// context.legalChoiceKeys => ["reject"]
```

Stale choices throw — never cache choices across ticks; feed back one `advance` just produced. Choices are deep-cloned at definition and at use, so callers can't corrupt the machine's declarations by editing a returned value. Choices containing functions are rejected (`UNSUPPORTED_CHOICE`).

### `send(facts, event)` — "an outside signal arrived"

```ts
const d = machine.send({ state: "draft", wordCount: 300, editorBusy: false }, { type: "SUBMIT" });
// => { kind: "transition", from: "draft", to: "review", output: { effect: "notify-editor" } }

machine.send({ state: "draft", wordCount: 50, editorBusy: false }, { type: "SUBMIT" });
// throws MachineFailure, code "INVALID_EVENT" — the SUBMIT rule's
// when(wordCount >= 200) failed.

machine.send({ state: "published", wordCount: 9999, editorBusy: false }, { type: "SUBMIT" });
// throws MachineFailure, code "INVALID_TERMINAL_EVENT"
```

## 5. Driving the whole workflow — a complete loop

This is the shape every consumer in this repo uses. The machine decides; the loop executes.

```ts
let facts: Facts = { state: "draft", wordCount: 300, editorBusy: false };
let running = true;

while (running) {
  let decision;
  try {
    decision = machine.advance(facts);
  } catch (error) {
    if (error instanceof MachineFailure) {
      // e.g. NO_ROUTE = stuck; TERMINAL_STATE shouldn't happen here.
      console.error("blocked:", error.code, error.context);
      break;
    }
    throw error; // not the machine's error — let it bubble
  }

  if (decision.kind === "transition") {
    runEffect(decision.output);                     // YOUR side effects
    facts = { ...facts, state: decision.to };
    if (decision.to === "published") running = false;
  } else {
    const picked = askEditor(decision.choices);     // YOUR I/O: prompt a human or model
    const d2 = machine.choose(facts, picked);
    runEffect(d2.output);
    facts = { ...facts, state: d2.to };
  }
}

function runEffect(output: Output) {
  if (output.effect === "notify-editor") console.log("→ pinging editor");
}
```

Rules of thumb:

- The machine holds **no state between calls**. Everything it knows comes from the `facts` you pass. Persist `facts` yourself (disk, DB) if you need to resume later.
- All effects, timing, retries, network, and I/O live in your loop, driven by `output`.
- Keep the machine definition in its own module with named helpers so it reads like a table.

## 6. Failure semantics: it fails closed

Every illegal situation throws `MachineFailure` — a standard `Error` subclass with two extra fields:

```ts
error.code;     // machine-readable, e.g. "NO_ROUTE", "AMBIGUOUS_AUTOMATIC"
error.context;  // structured detail: state, ruleIds, legalChoiceKeys, ...
```

Full code list (`MachineFailureCode` in the source): `MISSING_STATE`, `TERMINAL_STATE`, `AMBIGUOUS_AUTOMATIC`, `AMBIGUOUS_ROUTE`, `NO_ROUTE`, `AMBIGUOUS_CHOICE`, `ILLEGAL_CHOICE`, `UNKNOWN_EVENT`, `INVALID_EVENT`, `AMBIGUOUS_EVENT`, `INVALID_TERMINAL_EVENT`, `INVALID_TARGET`, `UNSUPPORTED_CHOICE`.

**No defaults, no silent fallbacks.** Two automatic rules enabled at once does *not* fire the first — it throws `AMBIGUOUS_AUTOMATIC` naming both rule `id`s. Overlap is treated as a defect in your definition. In tests, assert on `error.code`, never message text.

## 7. Reference consumer in this repo

`extensions/buck-loop/machine.ts` is a real, working example: the workflow of an autonomous build loop (`idle → resolving → building → reviewing → … → done/blocked`) built with named guard helpers (`canRunWork`, `limitsExceeded`), output factories (`blocked(...)`, `runSkill(...)`, `none(...)`), and a `stopEvent(state)` helper for a repeated `STOP` event. Its `Output` is `{ effect: ...; why: string }` — the machine picks and explains; `loop.ts` executes.

`extensions/state-machine.test.ts` has miniature fixture machines covering evaluator semantics — useful templates for your own tests.

## 8. Testing your machine

Minimal fixture machines (2–4 states) should cover:

1. A single automatic route fires and returns the right `from`/`to`/`output`.
2. A choice state returns the legal choices; feeding back a now-stale choice throws `ILLEGAL_CHOICE`.
3. Overlapping rules throw the right ambiguity code (`AMBIGUOUS_AUTOMATIC`, `AMBIGUOUS_EVENT`, `AMBIGUOUS_CHOICE`).
4. Terminal states reject `advance`, `choose`, and `send`.
5. Every rule is exercised at least once so a bad `target` surfaces as `INVALID_TARGET`.

Example assertion style (matches the existing tests):

```ts
import { describe, expect, it } from "vitest";

it("rejects a stale choice", () => {
  expect(() => machine.choose({ state: "review", wordCount: 300, editorBusy: true }, { kind: "approve" }))
    .toThrowError(expect.objectContaining({ code: "ILLEGAL_CHOICE" }));
});
```

## 9. Where the architecture rationale lives

Why this evaluator exists instead of a library, and why effect execution stays outside it: [ADR 0002 — observably-invoked happy-path loop](adr/0002-observably-invoked-happy-path-loop.md), summarized in [extension-loading.md](extension-loading.md). Read those if you're deciding whether a new feature should use this evaluator at all.
