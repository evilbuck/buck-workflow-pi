/**
 * report — human rendering of immutable pass artifacts and the single
 * git-portable terminal report written into the resolved `.context/`
 * subject. Reports are evidence-led and non-prescriptive: findings describe
 * defects with ratings and reproduction status; remediation proposals are
 * omitted. Raw prompts, hidden reasoning, and model transcripts stay out.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { scheduleConfiguredRetain } from "../../skills/_shared/storage/consumers.js";
import type { PassFixerRecord, PassReviewRecord, RunState } from "./run-state.js";
import { executeWorkflowState, resolveConsumerContext, withBoundStore, type TrustedWorkflowContext } from "../../skills/_shared/scripts/workflow-state.js";
import type { StorageStore } from "../../skills/_shared/storage/contract.js";

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
      `Runtime state is retained by the configured workflow store. Re-run the command on this branch to resume automatically; ${input.runDir} is an optional local export.`,
    );
  }
  return lines.join("\n");
}

export interface ReportSubject {
  dir: string;
  created: boolean;
}


/** Resolve canonical active subjects; local directories are only report exports. */
export async function resolveReportSubject(contextDir: string, cwd: string, today = new Date()): Promise<ReportSubject> {
  const context = await resolveConsumerContext(cwd);
  return withBoundStore(cwd, context, async (store) => {
    const items = await executeWorkflowState({ cwd, context, store, role: "read", request: { operation: "list", kind: "subject-index" } }) as { subjectId: string }[];
    const names = new Set(items.map(item => item.subjectId));
    const candidates = [...names].filter(name => /^\d{4}-\d{2}-\d{2}\./u.test(name)).sort().reverse();
    for (const subjectId of candidates) {
      const lifecycle = await store.inspectLifecycle(context.projectId, context.branchId, subjectId, context.publishedRevisionIds);
      if (lifecycle?.provenance !== "malformed" && lifecycle?.effectiveState === "active") {
        const dir = join(contextDir, subjectId);
        mkdirSync(dir, { recursive: true });
        return { dir, created: false };
      }
    }
    return createReportSubject(store, context, cwd, contextDir, today, names);
  });
}

async function createReportSubject(store: StorageStore, context: TrustedWorkflowContext, cwd: string, contextDir: string, today: Date, names: ReadonlySet<string>): Promise<ReportSubject> {
  const date = today.toISOString().slice(0, 10);
  const baseName = `${date}.code-review-iteration`;
  let subjectId = baseName;
  for (let suffix = 2; names.has(subjectId); suffix++) subjectId = `${baseName}-${suffix}`;
  const ref = { subjectId, kind: "subject-index" as const, logicalName: "index.md" };
  const seeded = await executeWorkflowState({
    cwd, context, store, role: "write", request: {
      operation: "write", ref, expectedRevision: null,
      body: `---\ncreated: ${date}\n---\n\n# Code review iteration reports\n\nTerminal reports from the isolated review loop land here.\n`,
    },
  }) as { revision: string };
  const scope = { projectId: context.projectId, branchId: context.branchId, subjectId, publishedRevisionIds: context.publishedRevisionIds };
  const initialized = await store.transition({ ...scope, fromRevision: seeded.revision, expectedState: "missing", intent: { kind: "initialize" }, evidence: [] });
  const active = await store.transition({ ...scope, fromRevision: initialized, expectedState: "draft", intent: { kind: "activate" }, evidence: [initialized] });
  const index = await store.read({ projectId: context.projectId, branchId: context.branchId, ...ref }, active);
  if (!index || index.revision !== active) throw new Error("Report subject lifecycle readback is missing");
  const dir = join(contextDir, subjectId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.md"), index.bytes);
  return { dir, created: true };
}

export async function writeFinalReport(subjectDir: string, runId: string, markdown: string, cwd: string): Promise<string> {
  const path = `${subjectDir}/review-iteration-${runId}.md`;
  const body = `${markdown}\n`;
  writeFileSync(path, body, "utf-8");
  await scheduleConfiguredRetain({
    kind: "review",
    subjectId: basename(subjectDir),
    logicalName: `review-iteration-${runId}.md`,
    bytes: new TextEncoder().encode(body),
    cwd,
    source: "code-review-iteration",
  });
  return path;
}
