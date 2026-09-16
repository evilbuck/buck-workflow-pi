/**
 * report — human rendering of immutable pass artifacts and the single
 * git-portable terminal report written into the resolved `.context/`
 * subject. Reports are evidence-led and non-prescriptive: findings describe
 * defects with ratings and reproduction status; remediation proposals are
 * omitted. Raw prompts, hidden reasoning, and model transcripts stay out.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import type { PassFixerRecord, PassReviewRecord, RunState } from "./run-state.js";

export function renderPassReviewMarkdown(record: PassReviewRecord, pass: number): string {
  const lines: string[] = [
    `# Review pass ${String(pass).padStart(2, "0")}`,
    "",
    `- Persona: ${record.persona}`,
    `- Model: ${record.requested_model ?? "—"}${record.requested_temperature === null ? " (provider-default temperature)" : ` @ temperature ${record.requested_temperature}`}${record.thinking_level ? ` · thinking ${record.thinking_level}` : ""}`,
    `- Reviewed HEAD: ${record.reviewed_head}`,
    `- Findings: ${record.findings.length}`,
  ];
  if (record.errors.length > 0) {
    lines.push("", "## Validation errors", ...record.errors.map((e) => `- ${e}`));
  }
  for (const f of record.findings) {
    lines.push(
      "",
      `## ${f.id}: ${f.title}`,
      `- Rating: **${f.rating}** · score ${f.score} (2·impact + likelihood + breadth; raw inputs in review.json)`,
      `- Confidence: ${f.confidence} · Fix hardness: ${f.fixHardness}${f.blocking ? " (blocking)" : " (report-only)"}`,
      `- Location: ${f.location}`,
      `- Reproduction: ${f.reproduction.status}${f.reproduction.commandIds.length > 0 ? ` (${f.reproduction.commandIds.join(", ")})` : ""}`,
      "",
      `**Observed**: ${f.observed}`,
      "",
      `**Expected**: ${f.expected}`,
      "",
      `**Evidence**: ${f.evidence}`,
    );
  }
  return lines.join("\n");
}

export interface FinalReportInput {
  state: RunState;
  passes: Array<{ pass: number; review: PassReviewRecord | null; fixer: PassFixerRecord | null }>;
  runDir: string;
  finalHead: string;
}

/** The one durable terminal report for a run. */
export function renderFinalReport(input: FinalReportInput): string {
  const { state } = input;
  const lines: string[] = [
    `# Code review iteration ${state.run_id}`,
    "",
    `**Outcome: ${state.status.toUpperCase()}**${state.terminal ? ` — ${state.terminal.reason}` : ""}`,
    "",
    "- Run state (machine-readable, resumable): `${gitCommonDir}/code-review-iteration/…`",
    `  - This run: ${input.runDir}`,
    `- Branch: ${state.branch ?? "(detached)"}`,
    `- Base: origin/${state.base_branch} at ${state.base_commit ?? "—"}`,
    `- Starting HEAD: ${state.start_head}`,
    `- Final HEAD: ${input.finalHead}`,
    `- Persona: ${state.persona}`,
    `- Reviewer model: ${state.reviewer_model ?? "(session default)"}`,
    `- Fixer model: ${state.fixer_model ?? "(not reached)"}`,
    `- Requested reviewer temperature: ${state.requested_temperature ?? "(persona default)"}`,
    `- Loop bound: max ${state.max_passes} review passes · blocking ≥ ${state.min_blocking}`,
  ];
  for (const { pass, review, fixer } of input.passes) {
    lines.push("", `## Pass ${String(pass).padStart(2, "0")}`);
    if (review) {
      const blocking = review.findings.filter((f) => f.blocking);
      lines.push(
        `- Reviewer: ${review.findings.length} findings (${blocking.length} blocking) — see passes/${String(pass).padStart(2, "0")}/review.md`,
      );
      for (const f of review.findings) {
        lines.push(`  - ${f.id} [${f.rating}/${f.score}] ${f.title} — ${f.fixHardness}${f.blocking ? "" : " (report-only)"}`);
      }
    } else {
      lines.push("- Reviewer: not recorded");
    }
    if (fixer) {
      lines.push(`- Fixer: ${fixer.model ?? "—"} (requested hardness ${fixer.requested_hardness ?? "—"})`);
      for (const d of fixer.dispositions) {
        lines.push(`  - ${d.finding_id}: ${d.disposition} — ${d.note}`);
      }
      lines.push(
        `- Checks: ${fixer.checks.command} exit ${fixer.checks.exit_code ?? "—"} (${fixer.checks.passed ? "passed" : "failed"})`,
      );
      lines.push(`- Checkpoint commit: ${fixer.checkpoint_commit ?? "none (checks did not pass)"}`);
    } else if (review) {
      lines.push("- Fixer: not reached (no blocking findings)");
    }
  }
  if ((state.status === "blocked" || state.status === "exhausted" || state.status === "failed" || state.status === "cancelled")) {
    lines.push(
      "",
      "## Resume",
      "",
      `Runtime state is retained at ${input.runDir}. Re-run the command on this branch to resume automatically, or inspect state.json directly.`,
    );
  }
  return lines.join("\n");
}

export interface ReportSubject {
  dir: string;
  created: boolean;
}

function subjectStatus(indexText: string): string | null {
  const match = /^status:\s*(\S+)/m.exec(indexText);
  return match ? match[1] : "active";
}

/**
 * Resolve the active `.context/` subject for the terminal report; creates a
 * fresh review subject when none is active. Never guesses over mismatched
 * subjects — newest active wins.
 */
export function resolveReportSubject(contextDir: string, today = new Date()): ReportSubject {
  const subjects: string[] = [];
  if (existsSync(contextDir)) {
    for (const entry of readdirSync(contextDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^\d{4}-\d{2}-\d{2}\./.test(entry.name)) continue;
      const index = `${contextDir}/${entry.name}/index.md`;
      if (!existsSync(index)) continue;
      if (subjectStatus(readFileSync(index, "utf-8")) === "active") subjects.push(entry.name);
    }
  }
  if (subjects.length > 0) {
    subjects.sort();
    return { dir: `${contextDir}/${subjects[subjects.length - 1]}`, created: false };
  }
  const date = today.toISOString().slice(0, 10);
  const dir = `${contextDir}/${date}.code-review-iteration`;
  mkdirSync(dir, { recursive: true });
  const index = `${dir}/index.md`;
  if (!existsSync(index)) {
    writeFileSync(
      index,
      `---\nstatus: active\ncreated: ${date}\n---\n\n# Code review iteration reports\n\nTerminal reports from the isolated review loop land here.\n`,
      "utf-8",
    );
  }
  return { dir, created: true };
}

export function writeFinalReport(subjectDir: string, runId: string, markdown: string): string {
  const path = `${subjectDir}/review-iteration-${runId}.md`;
  writeFileSync(path, `${markdown}\n`, "utf-8");
  return path;
}
