/** Styling-only prototype. Fixtures are sample values, never live Buck-loop facts. */
import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";

export interface PreviewTheme {
  fg(color: string, text: string): string;
  bold(text: string): string;
}

type Usage = { input: number; output: number };
type Visit = { label: string; state: string; usage: Usage };
export interface PreviewSnapshot {
  name: string;
  state: string;
  skill: string;
  model: string | null;
  phase: string;
  iteration: number;
  attempt: number;
  previous: Visit | null;
  next: string | null;
  usage: Usage | null;
  history: Visit[];
  choices: string[];
  selected: string | null;
  reason: string;
  activity: [string, string, string];
  attention?: boolean;
}

const build: Visit = { label: "Build #1", state: "building", usage: { input: 20100, output: 4000 } };
const review: Visit = { label: "Review #1", state: "reviewing", usage: { input: 6100, output: 1100 } };
const iterate: Visit = { label: "Iterate #1", state: "iterating", usage: { input: 10700, output: 2300 } };
const review2: Visit = { label: "Review #2", state: "reviewing", usage: { input: 5300, output: 900 } };
const save: Visit = { label: "Save #1", state: "saving", usage: { input: 2400, output: 600 } };
const commit: Visit = { label: "Commit #1", state: "committing", usage: { input: 1200, output: 300 } };
const common = {
  phase: "Phase 2 / 4 · Activity presentation",
  iteration: 0,
  attempt: 1,
  model: "Grok 4.7",
  choices: [] as string[],
  selected: null,
  reason: "Automatic transition after this stage completes.",
};

export const fixtures: PreviewSnapshot[] = [
  {
    ...common, name: "Building", state: "building", skill: "b-build", previous: null, next: "reviewing",
    usage: { input: 13200, output: 2700 }, history: [],
    activity: ["> edit extension-activity.ts · 4 edits grouped", "+ read activity contracts · 3 files", "Output: replacing separate start/end rows with one operation row."],
  },
  {
    ...common, name: "Reviewing", state: "reviewing", skill: "b-review", model: "GPT-6.1 Codex",
    previous: build, next: "saving", usage: { input: 4200, output: 800 }, history: [build],
    activity: ["> checking state transitions and usage display", "+ smoke command · 18 scenarios exercised", "Output: checking that retries do not increase the phase iteration."],
  },
  {
    ...common, name: "Pending choice", state: "reviewing", skill: "b-review", model: "typesafe/jev-latest",
    previous: build, next: "documenting", usage: { input: 6100, output: 1100 }, history: [build],
    choices: ["document", "save"], reason: "Awaiting decision · expected path is document, not yet selected.",
    activity: ["> selecting a continuation from the offered choices", "+ review complete · no in-scope defects", "Output: documentation impact identified; choose the next action."],
  },
  {
    ...common, name: "Iteration", state: "iterating", skill: "b-iterate", iteration: 2,
    previous: review, next: "reviewing", usage: { input: 8900, output: 1700 }, history: [build, review],
    choices: ["iterate"], selected: "iterate", reason: "Review found an in-scope width-clipping defect.",
    activity: ["> edit render.ts · 3 edits grouped", "+ narrow-layout smoke · 44 and 80 columns", "Output: retaining the current-state marker at narrow widths."],
  },
  {
    ...common, name: "Model retry", state: "building", skill: "b-build", attempt: 2, model: "GPT-6.1 Codex",
    previous: null, next: "reviewing", usage: { input: 6200, output: 900 }, history: [],
    choices: ["retry", "block"], selected: "retry", reason: "First model call failed; retry attempt changes, phase iteration stays 0.",
    activity: ["> retrying build · model attempt 2", "! prior model call failed · no usage total returned", "Output: continuing the same work stage with the next configured model."],
  },
  {
    ...common, name: "Blocked", state: "blocked", skill: "b-build paused", model: null, attention: true,
    previous: build, next: null, usage: null, history: [build],
    choices: ["retry", "block"], selected: "block", reason: "Awaiting operator · no automatic next state is promised.",
    activity: ["! required credential is unavailable", "+ completed work retained · no further work started", "Action: resolve the credential, then resume the loop."],
  },
  {
    ...common, name: "Committing", state: "committing", skill: "b-commit", model: "GPT-6.1 Codex", iteration: 2,
    previous: save, next: "done", usage: { input: 1200, output: 300 }, history: [build, review, iterate, review2, save],
    choices: ["save"], selected: "save", reason: "Review accepted; save receipt verified before this checkpoint.",
    activity: ["> committing the declared phase deliverables", "+ durable save receipt verified", "Output: preparing the Conventional Commit for the accepted work."],
  },
  {
    ...common, name: "Completed", state: "done", skill: "workflow complete", model: null, iteration: 2,
    previous: commit, next: null, usage: null, history: [build, review, iterate, review2, save, commit],
    reason: "Run complete · no next state.",
    activity: ["+ accepted work committed", "+ closeout evidence verified", "Result: phase completed; all displayed token values are sample data."],
  },
];

export const layoutNames = ["Flow cards", "Compact ribbon", "Vertical timeline"];
const amount = (n: number): string => n < 1000 ? String(n) : `${(n / 1000).toFixed(1)}k`;
const total = (usage: Usage): number => usage.input + usage.output;
const tokens = (usage: Usage | null): string => usage ? `${amount(total(usage))} tokens` : "— tokens";
const title = (state: string): string => state.toUpperCase();

function choiceRows(s: PreviewSnapshot, theme: PreviewTheme, width: number): string[] {
  const line = s.choices.length
    ? `Choices: ${s.choices.map((choice) => choice === s.selected ? `[${choice} · selected]` : `[${choice}]`).join("  ")}`
    : "Choices: none pending · automatic routing";
  return [
    ...wrapTextWithAnsi(theme.fg(s.selected ? "accent" : "muted", line), width),
    ...wrapTextWithAnsi(theme.fg(s.attention ? "warning" : "muted", s.reason), width),
  ];
}

function usageRows(s: PreviewSnapshot, theme: PreviewTheme, width: number): string[] {
  const current = s.usage ? `Current I/O: ${amount(s.usage.input)} / ${amount(s.usage.output)}` : "Current I/O: — / — (no active model call)";
  const completed = s.history.map((visit) => `${visit.label} ${amount(total(visit.usage))}`).join(" · ");
  const knownTotal = s.history.reduce((sum, visit) => sum + total(visit.usage), s.usage ? total(s.usage) : 0);
  return [
    ...wrapTextWithAnsi(theme.fg("muted", current), width),
    ...(completed ? wrapTextWithAnsi(theme.fg("muted", `Past visits: ${completed}`), width) : []),
    theme.fg("muted", `Known run total: ${amount(knownTotal)} tokens · sample input + output`),
  ];
}

function stageRibbon(s: PreviewSnapshot, theme: PreviewTheme): string {
  const stages = ["build", "review", "iterate", "docs", "save", "commit"];
  return theme.fg("muted", "Stages: ") + stages.map((stage) => s.skill === `b-${stage}` ? theme.fg("accent", theme.bold(`[${stage.toUpperCase()}]`)) : theme.fg("muted", stage)).join(theme.fg("muted", " · "));
}

function flowRows(s: PreviewSnapshot, theme: PreviewTheme, width: number): string[] {
  if (width < 76) return timelineRows(s, theme);
  const cellWidth = Math.floor((width - 8) / 3);
  const node = (role: string, state: string, detail: string, active: boolean): string[] => {
    const color = active ? (s.attention ? "warning" : "accent") : "muted";
    const paint = (text: string): string => theme.fg(color, active ? theme.bold(text) : text);
    const side = active ? "║" : "│";
    const row = (text: string): string => {
      const clipped = truncateToWidth(text, cellWidth - 4);
      return paint(`${side} ${clipped}${" ".repeat(cellWidth - 3 - visibleWidth(clipped))}${side}`);
    };
    return [
      paint(`${active ? "╔" : "┌"}${(active ? "═" : "─").repeat(cellWidth - 2)}${active ? "╗" : "┐"}`),
      row(role), row(title(state)), row(detail),
      paint(`${active ? "╚" : "└"}${(active ? "═" : "─").repeat(cellWidth - 2)}${active ? "╝" : "┘"}`),
    ];
  };
  const left = node("PREVIOUS", s.previous?.state ?? "not started", tokens(s.previous?.usage ?? null), false);
  const center = node("CURRENT", s.state, tokens(s.usage), true);
  const right = node(s.next ? "NEXT · expected" : "NO AUTOMATIC NEXT", s.next ?? "—", s.next ? "— tokens · not run" : "—", false);
  return left.map((line, i) => `${line}${i === 2 ? " →  " : "    "}${center[i]}${i === 2 && s.next ? " ⇢  " : "    "}${right[i]}`);
}

function timelineRows(s: PreviewSnapshot, theme: PreviewTheme): string[] {
  return [
    theme.fg("muted", `  PREVIOUS  ${title(s.previous?.state ?? "not started")} · ${tokens(s.previous?.usage ?? null)}`),
    theme.fg("muted", "     │"),
    theme.fg(s.attention ? "warning" : "accent", theme.bold(`> CURRENT   ${title(s.state)} · ${tokens(s.usage)}`)),
    theme.fg("muted", s.next ? "     ┊" : "     ·"),
    theme.fg("muted", s.next ? `  EXPECTED  ${title(s.next)} · — tokens (not run)` : "  NEXT      — (no automatic transition)"),
  ];
}

export function renderPreview(s: PreviewSnapshot, layout: number, theme: PreviewTheme, width: number): string[] {
  const contentWidth = Math.max(1, width - 4);
  const fg = (color: string, text: string): string => theme.fg(color, text);
  const header = fg(s.attention ? "warning" : "accent", theme.bold(`BUCK LOOP  /  ${title(s.state)}`)) + fg("muted", "  SAMPLE DATA");
  const metadata = [
    `${s.phase} · Phase iteration ${s.iteration} / 6`,
    `Stage: ${s.skill} · Model: ${s.model ?? "— (no active call)"} · Attempt ${s.attempt}`,
  ].flatMap((line) => wrapTextWithAnsi(fg("muted", line), contentWidth));
  const activity = s.activity.map((line, i) => fg(i === 0 ? (s.attention ? "warning" : "text") : "muted", truncateToWidth(line, contentWidth)));
  const rule = fg("border", "─".repeat(contentWidth));
  let body: string[];
  if (layout === 1) {
    const prior = title(s.previous?.state ?? "start");
    const next = s.next ? ` ⇢ ${title(s.next)} (expected)` : " · no automatic next";
    const ribbon = fg("muted", `${prior} → `) + fg(s.attention ? "warning" : "accent", theme.bold(`[CURRENT: ${title(s.state)}]`)) + fg("muted", next);
    body = [header, ...metadata, rule, ...wrapTextWithAnsi(ribbon, contentWidth), ...choiceRows(s, theme, contentWidth), rule, ...activity, rule, ...usageRows(s, theme, contentWidth)];
  } else if (layout === 2) {
    body = [header, ...metadata, "", ...timelineRows(s, theme), "", ...choiceRows(s, theme, contentWidth), rule, ...activity, rule, ...usageRows(s, theme, contentWidth)];
  } else {
    body = [header, ...metadata, ...wrapTextWithAnsi(stageRibbon(s, theme), contentWidth), "", ...flowRows(s, theme, contentWidth), ...choiceRows(s, theme, contentWidth), rule, ...activity, rule, ...usageRows(s, theme, contentWidth)];
  }
  return body.map((line) => `  ${truncateToWidth(line, contentWidth)}`);
}
