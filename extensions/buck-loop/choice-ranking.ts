import { runJev } from "../jev-tool/index.js";
import { createTypeSafeEvaluator } from "../typed-output/evaluator.js";
import { CONTINUATION_RUBRIC } from "./choice.js";
import type { Choice } from "./types.js";
import type { RankedChoice } from "./activity-view.js";

export type Ranking = { choices: RankedChoice[]; error?: string; durationMs: number };
const criteria = ["Very unlikely", "Unlikely", "Plausible", "Likely", "Very likely"];

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function scoreFor(details: unknown, kind: string): number {
  const answers = record(details) ? details.answers : undefined;
  const answer = record(answers) ? answers[kind] : undefined;
  if (record(answer) && answer.type === "score" && typeof answer.score === "number" &&
      Number.isFinite(answer.score) && answer.score >= 0 && answer.score <= 4) return answer.score;
  throw new Error(`Native judgment returned no valid display score for ${kind}`);
}

/** A score per legal action, never a selected action. Failure exposes the unranked legal set. */
export async function rankChoices(legal: readonly Choice[], context: string, ask = runJev): Promise<Ranking> {
  const choices = legal.map(choice => ({ kind: choice.kind }));
  if (legal.length < 2) return { choices, durationMs: 0 };
  const started = performance.now();
  try {
    const questions = Object.fromEntries(legal.map(choice => [choice.kind, {
      type: "score", criteria,
      instructions: `Rate how likely this legal continuation is appropriate: ${CONTINUATION_RUBRIC[choice.kind] ?? choice.kind}. Display advice only; do not select an action.`,
    }]));
    const { details } = await ask(createTypeSafeEvaluator(), { state: context, questions });
    if (record(details) && details.error === true && typeof details.message === "string") throw new Error(details.message);
    const ranked = legal.map(choice => ({ kind: choice.kind, score: scoreFor(details, choice.kind) }));
    ranked.sort((a, b) => b.score - a.score);
    return { choices: ranked, durationMs: performance.now() - started };
  } catch (error) {
    return { choices, error: error instanceof Error ? error.message : String(error), durationMs: performance.now() - started };
  }
}
