import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";
import type { Choice, LoopState } from "./types.js";

export type Profile = "compact" | "standard" | "verbose";
export type Usage = { input: number; output: number };
export type Visit = { state: LoopState; model?: string; models?: readonly string[]; usage?: Usage };
export type RankedChoice = { kind: Choice["kind"]; score?: number };
export type ContextView = { usedTokens: number | null; contextWindow: number; percent: number | null };
export interface ActivityView extends Visit {
  skill?: string;
  attempt: number;
  iteration: number;
  previous?: Visit;
  visits: readonly Visit[];
  activity: readonly string[];
  choices: readonly RankedChoice[];
  expectedState?: LoopState;
  reason?: string;
  rankingError?: string;
  context?: ContextView;
}

const clean = (text: string): string => text.replace(/\x1b\[[0-?]*[ -/]*[@-~]|[\x00-\x1f\x7f]/g, " ");
export const tokenLabel = (usage?: Usage): string => usage ? `${usage.input + usage.output} tokens` : "tokens unknown";
const visitLabel = (visit: Visit, verbose: boolean): string =>
  `${visit.state} · ${visit.models?.join(" + ") || visit.model || "model unknown"} · ${tokenLabel(visit.usage)}${verbose && visit.usage ? ` (I ${visit.usage.input} / O ${visit.usage.output})` : ""}`;

const contextCount = (tokens: number): string => tokens >= 1000 ? `${tokens / 1000}k` : String(tokens);
function contextLabel(context: ContextView, profile: Profile): string {
  const window = contextCount(context.contextWindow);
  if (context.usedTokens === null || context.percent === null) return `ctx /${window}`;
  const percent = `${Math.round(context.percent)}%`;
  if (profile === "compact") return percent;
  if (profile === "standard") return `ctx ${percent}`;
  return `ctx ${contextCount(context.usedTokens)} / ${window} · ${percent}`;
}

function currentBox(view: ActivityView, profile: Profile, width: number, spinner: string): string[] {
  const inner = Math.max(1, width - 4);
  const content = [`CURRENT ${view.state} · ${view.skill ?? "supervisor"}`, `${tokenLabel(view.usage)} ${spinner}`];
  if (profile !== "compact") content.push(`${view.model ?? "model unknown"} · attempt ${view.attempt} · iteration ${view.iteration}`);
  if (view.context) content.push(contextLabel(view.context, profile));
  if (profile === "verbose" && view.usage) content.push(`I ${view.usage.input} / O ${view.usage.output}`);
  const rows = content.flatMap(text => wrapTextWithAnsi(clean(text), inner))
    .map(row => `┃ ${row}${" ".repeat(Math.max(0, inner - visibleWidth(row)))} ┃`);
  return [`┏${"━".repeat(Math.max(0, width - 2))}┓`, ...rows, `┗${"━".repeat(Math.max(0, width - 2))}┛`];
}

function continuationRows(view: ActivityView, profile: Profile): string[] {
  if (!view.choices.length) return view.expectedState ? [`→ ${view.expectedState}`] : [];
  if (profile === "compact") return [`→ ${view.choices.map(choice => choice.kind).join(" | ")} (advisory)`];
  const rows = [view.choices.every(choice => choice.score !== undefined) ? "NEXT · ranked, not pre-selected" : "NEXT · legal, not pre-selected"];
  for (const choice of view.choices) rows.push(`  → ${choice.kind}${choice.score === undefined ? "" : ` · ${choice.score}/4`}`);
  if (profile === "verbose") {
    if (view.reason) rows.push(`Reason: ${view.reason}`);
    if (view.rankingError) rows.push(`Ranking: ${view.rankingError}`);
  }
  return rows;
}

function detailRows(view: ActivityView, profile: Profile): string[] {
  if (profile === "compact") return [];
  const rows: string[] = [];
  const known = [...view.visits, view].filter(visit => visit.usage !== undefined);
  rows.push(`Known run total: ${known.reduce((sum, visit) => sum + visit.usage!.input + visit.usage!.output, 0)} tokens (reported usage only)`);
  if (profile === "verbose") for (const visit of view.visits) rows.push(`Visit ${visitLabel(visit, true)}`);
  return rows;
}

function activityRows(view: ActivityView, profile: Profile, width: number): string[] {
  if (profile === "compact") return [];
  const entries = profile === "verbose" ? view.activity : view.activity.slice(-3);
  const rows = entries.flatMap(row => wrapTextWithAnsi(clean(row), width));
  return profile === "verbose" ? rows : rows.slice(-3);
}

/** Pure: caller supplies the animated glyph. Supported terminal widths: >= 24. */
export function renderActivityView(view: ActivityView, profile: Profile, width: number, spinner: string): string[] {
  width = Math.max(1, Math.floor(width));
  const lines: string[] = [];
  if (profile !== "compact" && view.previous) lines.push(...wrapTextWithAnsi(clean(`PREVIOUS ${visitLabel(view.previous, profile === "verbose")}`), width));
  lines.push(...currentBox(view, profile, width, spinner));
  for (const row of continuationRows(view, profile)) {
    lines.push(...wrapTextWithAnsi(clean(row), width));
  }
  lines.push(...activityRows(view, profile, width));
  for (const row of detailRows(view, profile)) lines.push(...wrapTextWithAnsi(clean(row), width));
  return lines.map(line => truncateToWidth(line, width, ""));
}
