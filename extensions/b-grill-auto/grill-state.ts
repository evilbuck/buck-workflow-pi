/**
 * Grill session state management for b-grill-auto.
 *
 * Manages the lifecycle of a grilling session:
 * - Initialize session state
 * - Add questions and record answers
 * - Track decision domains and model divergences
 * - Assess boundaries at threshold
 * - Write session files to subject folder
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import type {
  GrillConfig,
  GrillSessionState,
  GrillQuestion,
  DecisionDomain,
  ModelDivergence,
  AnswererResponse,
  BoundaryAssessment,
} from "./types.js";

const STATE_DIR = ".context/workflow";
const STATE_FILE = "grill-session.json";

/**
 * Create a new grill session state.
 */
export function initSession(
  config: GrillConfig,
  planContent: string,
  subjectFolder: string,
): GrillSessionState {
  const [provider, model] = parseModelId(config.model);
  return {
    id: `grill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    planPath: config.planPath,
    planContent,
    subjectFolder,
    answererModel: { provider, model },
    threshold: config.threshold,
    questions: [],
    domains: [],
    divergences: [],
    status: "active",
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

/**
 * Add a new question to the session.
 */
export function addQuestion(
  session: GrillSessionState,
  question: string,
  type: GrillQuestion["type"],
  domain: string,
): GrillQuestion {
  const num = session.questions.length + 1;
  const q: GrillQuestion = {
    number: num,
    text: question,
    type,
    domain,
    answer: "",
    assumptions: [],
    risks: [],
    unknowns: [],
    followUp: null,
    resolution: "resolved",
    resolutionNote: null,
  };
  session.questions.push(q);

  // Update or create domain tracking
  updateDomain(session, domain, num);

  return q;
}

/**
 * Record an answerer response for a question.
 */
export function recordAnswer(
  session: GrillSessionState,
  questionIdx: number,
  response: AnswererResponse,
): void {
  if (questionIdx < 0 || questionIdx >= session.questions.length) return;

  const q = session.questions[questionIdx];
  q.answer = response.answer;
  q.assumptions = response.assumptions;
  q.risks = response.risks;
  q.unknowns = response.unknowns;
  q.followUp = response.followUp;

  // Determine resolution based on content
  if (response.risks.length > 0 || response.unknowns.length > 2) {
    q.resolution = "model_diverged";
    session.divergences.push({
      questionNumber: q.number,
      modelSuggested: response.answer.slice(0, 200),
      determinedCorrect: "Review needed — model identified risks/unknowns",
      reason: `Risks: ${response.risks.join(", ") || "none"}`,
    });
  } else if (response.halted) {
    q.resolution = "blocked";
  } else if (response.unknowns.length > 0) {
    q.resolution = "deferred";
  } else {
    q.resolution = "model_aligned";
  }
}

/**
 * Get a summary of decision domains.
 */
export function getDomainSummary(session: GrillSessionState): DecisionDomain[] {
  return session.domains;
}

/**
 * Get a condensed summary of the last N Q&A pairs for context injection.
 */
export function getPriorQASummary(session: GrillSessionState, lastN = 5): string {
  const recent = session.questions.slice(-lastN);
  if (recent.length === 0) return "";

  const parts: string[] = [];
  for (const q of recent) {
    const answer = q.answer.length > 300
      ? q.answer.slice(0, 300) + "..."
      : q.answer;
    parts.push(`Q${q.number}: ${q.text}\nA: ${answer}`);
  }
  return parts.join("\n\n---\n\n");
}

/**
 * Assess boundaries at threshold.
 * Analyzes decision domains to determine if plan boundaries were found.
 */
export function assessBoundaries(session: GrillSessionState): BoundaryAssessment {
  const domains = session.domains;
  const divergences = session.divergences;
  const totalQuestions = session.questions.length;

  // Find natural break points between domains
  const breakPoints: number[] = [];
  for (const domain of domains) {
    if (domain.questionRange[0] > 1) {
      breakPoints.push(domain.questionRange[0] - 1);
    }
  }

  // Determine if boundaries were found
  const hasDivergences = divergences.length > 2;
  const hasMultipleDomains = domains.length >= 2;
  const hasDeferred = session.questions.some((q) => q.resolution === "deferred" || q.resolution === "blocked");

  const boundariesFound = hasDivergences || hasMultipleDomains;

  // Generate recommended phases from domains
  const recommendedPhases: string[] = [];
  for (const domain of domains) {
    recommendedPhases.push(`Phase: ${domain.name} (Q${domain.questionRange[0]}-Q${domain.questionRange[1]})`);
  }

  if (recommendedPhases.length === 0 && boundariesFound) {
    recommendedPhases.push("Phase: Core implementation");
    recommendedPhases.push("Phase: Edge cases and error handling");
  }

  const summary = boundariesFound
    ? `Found ${domains.length} decision domains across ${totalQuestions} questions. ` +
      `${divergences.length} model divergences detected. ` +
      (hasDeferred ? "Some questions deferred/blocked." : "")
    : `Plan appears cohesive — ${totalQuestions} questions, ${divergences.length} divergences, ` +
      `${domains.length} domain(s). No clear phase boundaries found.`;

  return {
    assessment: boundariesFound ? "boundaries_found" : "cohesive",
    breakPoints,
    recommendedPhases,
    summary,
  };
}

/**
 * Write the session output file (grill-auto-session-*.md) to the subject folder.
 */
export function writeSessionFile(session: GrillSessionState, outputPath: string): void {
  const frontmatter = buildFrontmatter(session);
  const body = buildSessionBody(session);
  const content = `${frontmatter}\n\n${body}`;

  const dir = dirname(outputPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(outputPath, content, "utf-8");
}

/**
 * Write the session state to the workflow state file.
 */
export function writeSessionState(session: GrillSessionState, cwd: string): void {
  const dir = join(cwd, STATE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, STATE_FILE), JSON.stringify(session, null, 2) + "\n", "utf-8");
}

/**
 * Read the session state from the workflow state file.
 */
export function readSessionState(cwd: string): GrillSessionState | null {
  try {
    const path = join(cwd, STATE_DIR, STATE_FILE);
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as GrillSessionState;
  } catch {
    return null;
  }
}

/**
 * Clear the session state file.
 */
export function clearSessionState(cwd: string): void {
  try {
    const path = join(cwd, STATE_DIR, STATE_FILE);
    if (existsSync(path)) unlinkSync(path);
  } catch {
    // Ignore removal errors
  }
}

// ============================================================
// Internal helpers
// ============================================================

function parseModelId(modelId: string): [string, string] {
  const slashIdx = modelId.indexOf("/");
  if (slashIdx < 1) return ["unknown", modelId];
  return [modelId.slice(0, slashIdx), modelId.slice(slashIdx + 1)];
}

function updateDomain(
  session: GrillSessionState,
  domain: string,
  questionNum: number,
): void {
  const existing = session.domains.find((d) => d.name === domain);
  if (existing) {
    existing.questionRange[1] = questionNum;
  } else {
    session.domains.push({
      name: domain,
      questionRange: [questionNum, questionNum],
      resolved: 0,
      deferred: 0,
      modelAligned: 0,
      modelDiverged: 0,
    });
  }
  // Recompute domain stats
  updateDomainStats(session);
}

function updateDomainStats(session: GrillSessionState): void {
  for (const domain of session.domains) {
    domain.resolved = 0;
    domain.deferred = 0;
    domain.modelAligned = 0;
    domain.modelDiverged = 0;

    const start = domain.questionRange[0];
    const end = domain.questionRange[1];
    for (const q of session.questions) {
      if (q.number >= start && q.number <= end) {
        switch (q.resolution) {
          case "resolved":
          case "blocked":
            domain.resolved++;
            break;
          case "deferred":
            domain.deferred++;
            break;
          case "model_aligned":
            domain.modelAligned++;
            break;
          case "model_diverged":
            domain.modelDiverged++;
            break;
        }
      }
    }
  }
}

function buildFrontmatter(session: GrillSessionState): string {
  const domains = session.domains.map((d) => {
    return `  - name: ${d.name}\n` +
      `    questions: [${d.questionRange[0]}-${d.questionRange[1]}]\n` +
      `    resolved: ${d.resolved}\n` +
      `    deferred: ${d.deferred}\n` +
      `    model_aligned: ${d.modelAligned}\n` +
      `    model_diverged: ${d.modelDiverged}`;
  }).join("\n");

  const breakPoints = assessBoundaries(session).breakPoints;

  return [
    "---",
    `type: grill-auto-session`,
    `date: ${new Date().toISOString().slice(0, 10)}`,
    `subject: ${session.subjectFolder}`,
    `total_questions: ${session.questions.length}`,
    `assessment_threshold: ${session.threshold}`,
    `boundary_assessment: ${assessBoundaries(session).assessment}`,
    `break_points: [${breakPoints.join(", ")}]`,
    `grilling_model: ${session.answererModel.provider}/${session.answererModel.model}`,
    `decision_domains:`,
    domains,
    `status: ${session.status}`,
    "---",
  ].join("\n");
}

function buildSessionBody(session: GrillSessionState): string {
  const lines: string[] = [];
  const assessment = assessBoundaries(session);

  lines.push(`# Grill Auto Session: ${session.id}`);
  lines.push("");
  lines.push(`**Grilling Model**: ${session.answererModel.provider}/${session.answererModel.model}`);
  lines.push(`**Threshold**: ${session.threshold}`);
  lines.push(`**Status**: ${session.status}`);
  lines.push(`**Created**: ${session.createdAt}`);
  if (session.completedAt) {
    lines.push(`**Completed**: ${session.completedAt}`);
  }
  lines.push("");

  // Decision domains
  if (session.domains.length > 0) {
    lines.push("## Decision Domains");
    lines.push("");
    for (const domain of session.domains) {
      lines.push(`### Domain: ${domain.name}`);
      lines.push(
        `Q${domain.questionRange[0]}-Q${domain.questionRange[1]}: ` +
        `${domain.modelAligned} aligned, ${domain.modelDiverged} diverged, ` +
        `${domain.deferred} deferred`,
      );
      lines.push("");

      for (const q of session.questions) {
        if (q.number >= domain.questionRange[0] && q.number <= domain.questionRange[1]) {
          const answer = q.answer.length > 200
            ? q.answer.slice(0, 200) + "..."
            : q.answer;
          lines.push(`- **Q${q.number}** [${q.type}]: ${q.text}`);
          lines.push(`  - Resolution: ${q.resolution}`);
          lines.push(`  - Answer: ${answer}`);
          if (q.risks.length > 0) {
            lines.push(`  - Risks: ${q.risks.join(", ")}`);
          }
          if (q.unknowns.length > 0) {
            lines.push(`  - Unknowns: ${q.unknowns.join(", ")}`);
          }
        }
      }
      lines.push("");
    }
  }

  // Model divergence analysis
  if (session.divergences.length > 0) {
    lines.push("## Model Divergence Analysis");
    lines.push("");
    for (const d of session.divergences) {
      lines.push(`- **Q${d.questionNumber}**: ${d.reason}`);
    }
    lines.push("");
  }

  // Boundary assessment
  lines.push("## Boundary Assessment");
  lines.push("");
  lines.push(`> Triggered at Q${session.questions.length} (threshold: ${session.threshold})`);
  lines.push("");
  lines.push(`**Assessment**: ${assessment.assessment}`);
  lines.push("");
  if (assessment.assessment === "boundaries_found" && assessment.recommendedPhases.length > 0) {
    lines.push("**Recommended phases:**");
    for (const phase of assessment.recommendedPhases) {
      lines.push(`- ${phase}`);
    }
    lines.push("");
    lines.push("Run \`/skill:b-phase\` to formalize.");
  }
  lines.push("");
  lines.push(assessment.summary);

  // Deferred questions
  const deferred = session.questions.filter((q) => q.resolution === "deferred" || q.resolution === "blocked");
  if (deferred.length > 0) {
    lines.push("");
    lines.push("## Deferred Questions");
    for (const q of deferred) {
      lines.push(`- Q${q.number}: ${q.text} — resolution: ${q.resolution}`);
    }
  }

  return lines.join("\n");
}
