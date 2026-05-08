/**
 * Shared types for b-grill-auto extension.
 */

/** Parsed command-line arguments for /b-grill-auto */
export interface GrillConfig {
  /** Answerer model in "provider/id" format, e.g. "openai-codex/gpt-5.4" */
  model: string;
  /** Number of questions before boundary assessment triggers */
  threshold: number;
  /** Path to the plan file to grill */
  planPath: string | null;
}

/** A single question in the grilling session */
export interface GrillQuestion {
  number: number;
  text: string;
  type: "scope" | "constraint" | "edge-case" | "dependency" | "rollback" | "verification";
  domain: string;
  answer: string;
  assumptions: string[];
  risks: string[];
  unknowns: string[];
  followUp: string | null;
  resolution: "resolved" | "deferred" | "blocked" | "model_aligned" | "model_diverged";
  resolutionNote: string | null;
}

/** Tracks a decision domain across questions */
export interface DecisionDomain {
  name: string;
  questionRange: [number, number];
  resolved: number;
  deferred: number;
  modelAligned: number;
  modelDiverged: number;
}

/** Records when the answerer model diverges from the optimal answer */
export interface ModelDivergence {
  questionNumber: number;
  modelSuggested: string;
  determinedCorrect: string;
  reason: string;
}

/** Parsed JSON response from the answerer model */
export interface AnswererResponse {
  answer: string;
  assumptions: string[];
  risks: string[];
  unknowns: string[];
  followUp: string | null;
  halted: boolean;
}

/** Result from an RPC agent_end event */
export interface AgentEndResult {
  text: string;
  thinking: string | null;
  stopReason: string;
  rawEvents: Record<string, unknown>[];
}

/** RPC event type union */
export type RPCEvent =
  | { type: "turn_end"; message: Record<string, unknown> }
  | { type: "agent_end"; message: Record<string, unknown> }
  | { type: "message_update"; assistantMessageEvent: { type: string; delta?: string } }
  | { type: "response"; command?: string; success?: boolean; error?: string }
  | { type: string; [key: string]: unknown };

/** Full session state persisted to disk */
export interface GrillSessionState {
  id: string;
  planPath: string | null;
  planContent: string;
  subjectFolder: string;
  answererModel: { provider: string; model: string };
  threshold: number;
  questions: GrillQuestion[];
  domains: DecisionDomain[];
  divergences: ModelDivergence[];
  status: "active" | "completed" | "aborted";
  createdAt: string;
  completedAt: string | null;
}

/** Boundary assessment result computed at threshold */
export interface BoundaryAssessment {
  assessment: "boundaries_found" | "cohesive";
  breakPoints: number[];
  recommendedPhases: string[];
  summary: string;
}
