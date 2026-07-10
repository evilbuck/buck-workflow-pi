/**
 * Machine-readable artifact schema substrate.
 * Phase 1: existing kinds + review-pass.
 * Phase 9 expands remaining kinds and becomes the sole registry.
 */

/** @typedef {"memory" | "subject-index" | "research" | "plan" | "backlog-item" | "review-pass"} ArtifactKind */

/**
 * @typedef {Object} ArtifactSchema
 * @property {string[]} required
 * @property {Record<string, string[]>} enums
 */

/** @type {Record<ArtifactKind, ArtifactSchema>} */
export const ARTIFACT_SCHEMAS = {
  memory: {
    required: ["date", "domains", "topics", "related", "priority", "status"],
    enums: {
      priority: ["high", "medium", "low"],
      status: ["active", "completed", "superseded"],
    },
  },
  "subject-index": {
    required: ["status", "date", "subject"],
    enums: {
      status: ["active", "completed", "superseded", "draft"],
    },
  },
  research: {
    required: ["status", "date", "subject", "topics", "informs"],
    enums: {
      status: ["active", "completed", "superseded", "draft"],
    },
  },
  plan: {
    required: ["status", "date", "subject", "topics", "research", "memory"],
    enums: {
      status: ["active", "completed", "superseded", "draft"],
    },
  },
  "backlog-item": {
    required: ["title", "status", "priority", "created", "updated", "completed", "related"],
    enums: {
      priority: ["high", "medium", "low"],
      status: ["active", "completed"],
    },
  },
  "review-pass": {
    required: [
      "status",
      "date",
      "subject",
      "target",
      "verdict",
      "documentation_impact",
      "fingerprint",
      "topics",
      "related",
      "completed",
    ],
    enums: {
      status: ["active", "completed", "superseded"],
      verdict: ["pass", "pass-with-follow-up"],
      documentation_impact: ["none", "flagged"],
    },
  },
};

/**
 * Classify a path relative to `.context/` (no leading `.context/`).
 * Order is specific → generic so later expansions (Phase 9) can insert
 * more-specific patterns above plan-*.
 *
 * @param {string} rel
 * @returns {ArtifactKind | null}
 */
export function classifyRelativeContextPath(rel) {
  const normalized = rel.replace(/\\/g, "/");

  if (normalized === "memory/index.md") return null;
  if (normalized.startsWith("memory/")) return "memory";
  if (/^\d{4}-\d{2}-\d{2}\.[^/]+\/index\.md$/.test(normalized)) return "subject-index";
  // review-pass before generic plan-* so it never falls through as unknown
  if (/^\d{4}-\d{2}-\d{2}\.[^/]+\/review-pass-.*\.md$/.test(normalized)) return "review-pass";
  if (/^\d{4}-\d{2}-\d{2}\.[^/]+\/research-.*\.md$/.test(normalized)) return "research";
  if (/^\d{4}-\d{2}-\d{2}\.[^/]+\/plan-.*\.md$/.test(normalized)) return "plan";
  if (/^backlog\/items\/.*\.md$/.test(normalized)) return "backlog-item";

  return null;
}

/**
 * @param {string} path
 * @returns {string} path relative to `.context/` when possible
 */
export function toContextRelative(path) {
  const normalized = path.replace(/\\/g, "/");
  const marker = "/.context/";
  const idx = normalized.indexOf(marker);
  if (idx >= 0) return normalized.slice(idx + marker.length);
  return normalized.replace(/^\.context\//, "");
}
