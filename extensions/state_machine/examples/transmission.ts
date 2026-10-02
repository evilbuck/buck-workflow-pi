import { defineMachine, IllegalTransitionError } from "../index.js";

type Drive = { readonly speed: number };

// Effects are plain data: easy to log, persist before running, and assert on in tests.
type ShiftEffect =
  | { readonly kind: "rev-match"; readonly rpm: number }
  | { readonly kind: "engage-parking-pawl" };

const MAX_FIRST_GEAR_SPEED = 40;
const FIRST_GEAR_RPM_PER_MPH = 90;

const transmission = defineMachine<Drive, ShiftEffect>()({
  initial: "park",
  states: {
    park: { final: true, targets: [{ name: "reverse" }, { name: "neutral" }] },
    neutral: {
      final: true,
      targets: [
        { name: "park", effect: () => ({ kind: "engage-parking-pawl" }) },
        { name: "reverse" },
        { name: "first" },
      ],
    },
    reverse: { targets: [{ name: "park" }, { name: "neutral" }, { name: "first" }] },
    first: { targets: [{ name: "neutral" }, { name: "second" }, { name: "reverse" }] },
    second: { targets: [{ name: "first" }, { name: "third" }] },
    third: { targets: [{ name: "second" }, { name: "fourth" }] },
    fourth: {
      targets: [
        { name: "third" },
        {
          name: "first",
          // Skip-downshift: only below first gear's redline, or the engine over-revs.
          guard: (drive) => drive.speed <= MAX_FIRST_GEAR_SPEED,
          effect: (drive) => ({ kind: "rev-match", rpm: drive.speed * FIRST_GEAR_RPM_PER_MPH }),
        },
      ],
    },
  },
});

// Outer code owns execution. A failing effect is handled here, never inside the machine.
function runEffect(effect: ShiftEffect): void {
  switch (effect.kind) {
    case "rev-match":
      console.log(`blip throttle to ${effect.rpm} rpm`);
      return;
    case "engage-parking-pawl":
      console.log("engage parking pawl");
      return;
  }
}

const car = transmission.start(); // park, already final: a run that never moves is complete
car.transition("neutral", { speed: 0 });
car.transition("first", { speed: 0 });
car.transition("second", { speed: 15 });
car.transition("third", { speed: 30 });
car.transition("fourth", { speed: 55 });

// What can the driver do from fourth right now? The guard decides; speed is the fact.
console.log(car.available({ speed: 60 })); // ["third"]
console.log(car.available({ speed: 35 })); // ["third", "first"]

try {
  car.transition("first", { speed: 60 });
} catch (error) {
  if (!(error instanceof IllegalTransitionError)) throw error;
  // reason "guard-rejected": edge exists, too fast right now; car.state is still "fourth"
}

// Rebuilt from outside: the definition is code, only the state name is data.
const resumed = transmission.restore(car.state);
const shift = resumed.transition("first", { speed: 35 }); // slowed down, guard passes
// Typical caller order: persist resumed.state, then run the effect; on failure, decide here
// (retry, transition elsewhere, mark blocked).
if (shift.effect) runEffect(shift.effect);

// ===========================================================================
// Operator actions (STOP / START / resume) as `manual` edges.
//
// A cut-down buck-loop: idle -> working -> done, with blocked for "needs a human"
// and aborted for STOP. The loop step calls available(facts) every tick and must
// NOT be offered STOP; the operator's /buck-loop stop names "aborted" directly.
// ===========================================================================

type LoopEffect = { readonly kind: "run-skill" } | { readonly kind: "await-operator"; readonly reason: string };

// Facts describe the work only. No command field: operator intent is the call itself.
type LoopFacts = {
  readonly workConfirmed: boolean;
  readonly limitReached: boolean;
};

const loop = defineMachine<LoopFacts, LoopEffect>()({
  initial: "idle",
  states: {
    idle: {
      targets: [
        // START: manual, so the tick never takes it on its own.
        { name: "working", manual: true, effect: () => ({ kind: "run-skill" }) },
        { name: "aborted", manual: true },
      ],
    },
    working: {
      targets: [
        { name: "done", guard: (f) => f.workConfirmed && !f.limitReached },
        {
          name: "blocked",
          guard: (f) => f.limitReached,
          effect: () => ({ kind: "await-operator", reason: "loop limit" }),
        },
        // STOP: still repeated per state, but reads as "operator can do this", no fake guard.
        { name: "aborted", manual: true },
      ],
    },
    blocked: {
      targets: [
        // A manual edge can still have a guard. buck-loop's USER_CONFIRMED needs this:
        // resume goes to reviewing or resolving depending on the facts.
        { name: "working", manual: true, guard: (f) => !f.limitReached, effect: () => ({ kind: "run-skill" }) },
        { name: "aborted", manual: true },
      ],
    },
    done: { final: true, targets: [] },
    aborted: { final: true, targets: [] },
  },
});

const tickFacts: LoopFacts = { workConfirmed: false, limitReached: false };
const run = loop.restore("working");
console.log("tick:", run.available(tickFacts)); // [] — manual edges are never offered
// Operator STOP: names the target with the real facts. Nothing extra to fake.
run.transition("aborted", tickFacts);
console.log("after stop:", run.state); // "aborted"
