import { legalChoices, next } from "./machine.js";
import type { Snapshot } from "./types.js";
import type { ActivityView, Usage, Visit } from "./activity-view.js";

const skills: Partial<Record<Snapshot["state"], string>> = {
  building: "b-build", reviewing: "b-review", iterating: "b-iterate", documenting: "b-docs", saving: "b-save", committing: "b-commit",
};

/** Runtime usage is deliberately separate from the machine/persisted transition facts. */
export function projectActivitySnapshot(snapshot: Snapshot, runtime: Partial<ActivityView> = {}): ActivityView {
  const choices = legalChoices(snapshot.state, snapshot);
  let expectedState: Snapshot["state"] | undefined;
  let reason: string | undefined;
  if (!["idle", "blocked", "aborted", "done"].includes(snapshot.state)) {
    const transition = next(snapshot);
    reason = transition.why;
    if (transition.effect.kind !== "choose") expectedState = transition.to;
  }
  return {
    ...runtime, state: snapshot.state, skill: runtime.skill ?? skills[snapshot.state],
    attempt: snapshot.workFacts.retriesUsed + 1, iteration: snapshot.iterateCyclesOnPhase,
    visits: runtime.visits ?? [], activity: runtime.activity ?? [],
    choices: choices.map(choice => ({ kind: choice.kind })), expectedState, reason,
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function tokenCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

// Plain runtime narrowing survives both Pi's TypeBox and OMP's schema shim.
function parseUsage(value: unknown): Usage | undefined {
  if (!record(value)) return undefined;
  const { input, output, cacheRead = 0, cacheWrite = 0 } = value;
  if (!tokenCount(input) || !tokenCount(output)) return undefined;
  if (!tokenCount(cacheRead) || !tokenCount(cacheWrite)) return undefined;
  return { input: input + cacheRead + cacheWrite, output };
}

/** Only completed assistant messages have authoritative usage; partial text is not tokens. */
export function reportedUsage(event: unknown): Usage | undefined {
  if (!record(event) || event.type !== "message_end") return undefined;
  const message = event.message;
  if (!record(message) || message.role !== "assistant") return undefined;
  return parseUsage(message.usage);
}

export function addUsage(visit: Visit, usage: Usage): void {
  visit.usage = { input: (visit.usage?.input ?? 0) + usage.input, output: (visit.usage?.output ?? 0) + usage.output };
}
