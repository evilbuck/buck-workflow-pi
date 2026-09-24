/**
 * Parent-side Buck model picker. Nested sessions cannot own this call:
 * extension discovery is disabled there, so Jev runs here.
 */
import {
  createTypeSafeEvaluator,
  type TypeSafeEvaluation,
  type TypeSafeEvaluator,
  type TypeSafeRequest,
} from "../typed-output/evaluator.js";
import type {
  BuckModelCandidate,
  BuckResolveStop,
  BuckStageResolution,
  BuckThinking,
} from "../omp-models.js";

export type ResolvedBuckStage = Extract<BuckStageResolution, { ok: true }>;

export type BuckModelPick =
  | {
      ok: true;
      id: string;
      thinking: BuckThinking;
      source: "jev" | "random";
      confidence: number | null;
    }
  | { ok: false; stop: BuckResolveStop };

export interface BuckModelPickInput {
  resolution: ResolvedBuckStage;
  skill: string;
  context: unknown;
  exclude?: readonly string[];
}

export interface BuckModelPickerDeps {
  evaluate?: TypeSafeEvaluator;
  random?: () => number;
}

const INSTRUCTIONS = "Pick exactly one configured model id for this Buck stage.";

export function createBuckModelPicker(deps: BuckModelPickerDeps = {}) {
  const evaluate = deps.evaluate ?? createTypeSafeEvaluator();
  const random = deps.random ?? Math.random;
  return {
    pick(input: BuckModelPickInput): Promise<BuckModelPick> {
      return pickModel(input, evaluate, random);
    },
  };
}

function namedStop(resolution: ResolvedBuckStage, dropped: readonly string[]): BuckModelPick {
  return {
    ok: false,
    stop: {
      code: "no-candidates",
      profile: resolution.profile,
      stage: resolution.stage,
      excluded: [...resolution.excluded, ...dropped],
    },
  };
}

function choiceRequest(input: BuckModelPickInput, candidates: readonly BuckModelCandidate[]): TypeSafeRequest {
  const criteria: Record<string, string> = {};
  for (const candidate of candidates) {
    criteria[candidate.id] = candidate.note && candidate.note.length > 0 ? candidate.note : candidate.id;
  }
  return {
    state: {
      stage: input.resolution.stage,
      skill: input.skill,
      candidates: candidates.map((candidate) =>
        candidate.note && candidate.note.length > 0
          ? { id: candidate.id, note: candidate.note }
          : { id: candidate.id },
      ),
      context: input.context,
    },
    questions: {
      model: {
        type: "choice",
        instructions: INSTRUCTIONS,
        criteria,
      },
    },
  };
}

function modelAnswer(answers: unknown): object | null {
  if (!answers || typeof answers !== "object" || !("model" in answers)) return null;
  const model = answers.model;
  if (!model || typeof model !== "object") return null;
  return model;
}

function memberChoice(
  evaluation: TypeSafeEvaluation,
  candidates: readonly BuckModelCandidate[],
): { id: string; confidence: number | null } | null {
  if (!evaluation.ok) return null;
  const model = modelAnswer(evaluation.result.answers);
  if (!model || !("choice" in model) || typeof model.choice !== "string") return null;
  if (!candidates.some((candidate) => candidate.id === model.choice)) return null;
  const confidence = "confidence" in model && typeof model.confidence === "number" ? model.confidence : null;
  return { id: model.choice, confidence };
}

/** `Math.random()` is `[0, 1)`. An injected `1` must not collapse to index 0. */
function randomIndex(random: () => number, length: number): number | null {
  const index = Math.floor(random() * length);
  if (!Number.isInteger(index) || index < 0 || index >= length) return null;
  return index;
}

async function pickModel(
  input: BuckModelPickInput,
  evaluate: TypeSafeEvaluator,
  random: () => number,
): Promise<BuckModelPick> {
  const blocked = new Set(input.exclude ?? []);
  const candidates = input.resolution.available.filter((candidate) => !blocked.has(candidate.id));
  const dropped = input.resolution.available
    .filter((candidate) => blocked.has(candidate.id))
    .map((candidate) => candidate.id);
  if (candidates.length === 0) return namedStop(input.resolution, dropped);
  const chosen = memberChoice(await evaluate(choiceRequest(input, candidates)), candidates);
  if (chosen) {
    return {
      ok: true,
      id: chosen.id,
      thinking: input.resolution.thinking,
      source: "jev",
      confidence: chosen.confidence,
    };
  }
  const index = randomIndex(random, candidates.length);
  if (index === null) return namedStop(input.resolution, [...dropped, ...candidates.map((candidate) => candidate.id)]);
  return {
    ok: true,
    id: candidates[index].id,
    thinking: input.resolution.thinking,
    source: "random",
    confidence: null,
  };
}
