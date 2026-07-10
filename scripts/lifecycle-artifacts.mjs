/**
 * Lifecycle helpers for review-gated phase state (Phase 1).
 * Pure functions — fixture tests construct subjects and observe results.
 */

import { createHash } from "node:crypto";
import { basename } from "node:path";

/**
 * @typedef {Object} PhaseRef
 * @property {string} path
 * @property {string} status
 * @property {number} [order]
 * @property {string} [name]
 */

/**
 * @typedef {Object} PhaseSelection
 * @property {"selected" | "ambiguous" | "none"} kind
 * @property {PhaseRef | null} phase
 * @property {PhaseRef[]} candidates
 * @property {string} reason
 */

/**
 * Select the active phase for no-argument review/build.
 * Single `in-progress` outranks later `pending`.
 *
 * @param {PhaseRef[]} phases
 * @returns {PhaseSelection}
 */
export function selectActivePhase(phases) {
  const list = [...phases].sort((a, b) => {
    const ao = a.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.path.localeCompare(b.path);
  });

  const inProgress = list.filter((p) => p.status === "in-progress");
  if (inProgress.length === 1) {
    return {
      kind: "selected",
      phase: inProgress[0],
      candidates: inProgress,
      reason: "single-in-progress",
    };
  }
  if (inProgress.length > 1) {
    return {
      kind: "ambiguous",
      phase: null,
      candidates: inProgress,
      reason: "multiple-in-progress",
    };
  }

  const pending = list.filter(
    (p) => p.status !== "completed" && p.status !== "superseded"
  );
  if (pending.length === 1) {
    return {
      kind: "selected",
      phase: pending[0],
      candidates: pending,
      reason: "single-non-completed",
    };
  }
  if (pending.length > 1) {
    return {
      kind: "ambiguous",
      phase: null,
      candidates: pending,
      reason: "multiple-non-completed-without-in-progress",
    };
  }

  return {
    kind: "none",
    phase: null,
    candidates: [],
    reason: "no-active-phase",
  };
}

/**
 * Deterministic review-pass basename for a reviewed target path.
 * @param {string} targetPath
 * @returns {string}
 */
export function reviewPassFileName(targetPath) {
  const base = basename(targetPath.replace(/\\/g, "/"));
  const stem = base.endsWith(".md") ? base.slice(0, -3) : base;
  return `review-pass-${stem}.md`;
}

/**
 * Full path of the review-pass artifact inside a subject folder.
 * @param {string} subjectDir
 * @param {string} targetPath
 * @returns {string}
 */
export function reviewPassPath(subjectDir, targetPath) {
  const dir = subjectDir.replace(/\\/g, "/").replace(/\/$/, "");
  return `${dir}/${reviewPassFileName(targetPath)}`;
}

/**
 * @typedef {Object} FingerprintFile
 * @property {string} path
 * @property {string} content
 */

/**
 * Implementation fingerprint: ordered path + content digests.
 * Callers must pass only implementation files (exclude later .context durability).
 *
 * @param {FingerprintFile[]} files
 * @returns {{ algorithm: string, fingerprint: string, paths: string[] }}
 */
export function computeImplementationFingerprint(files) {
  const algorithm = "sha256-path-content-v1";
  const sorted = [...files].sort((a, b) =>
    a.path.replace(/\\/g, "/").localeCompare(b.path.replace(/\\/g, "/"))
  );
  const hash = createHash("sha256");
  for (const file of sorted) {
    const path = file.path.replace(/\\/g, "/");
    hash.update(path);
    hash.update("\0");
    hash.update(file.content);
    hash.update("\0");
  }
  return {
    algorithm,
    fingerprint: `sha256:${hash.digest("hex")}`,
    paths: sorted.map((f) => f.path.replace(/\\/g, "/")),
  };
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function isFingerprintMatch(a, b) {
  return Boolean(a) && Boolean(b) && a === b;
}

/**
 * Mutually exclusive review write boundary for one attempt.
 *
 * @param {"pass" | "pass-with-follow-up" | "needs-work"} verdict
 * @returns {{ writeReviewPass: boolean, writeIterate: boolean, verdict: string }}
 */
export function reviewWriteBoundary(verdict) {
  if (verdict === "needs-work") {
    return { writeReviewPass: false, writeIterate: true, verdict };
  }
  if (verdict === "pass" || verdict === "pass-with-follow-up") {
    return { writeReviewPass: true, writeIterate: false, verdict };
  }
  throw new Error(`unknown review verdict: ${verdict}`);
}

/**
 * Apply the save-owned closeout transition to normalized lifecycle state.
 * The input is never mutated; callers persist the returned state as one
 * recoverable transaction.
 *
 * @param {Record<string, any>} input
 * @returns {{
 *   status: "applied" | "refused" | "noop",
 *   reason: string,
 *   state: Record<string, any>,
 *   nextPhase: Record<string, any> | null
 * }}
 */
export function closeAcceptedUnit(input) {
  const state = structuredClone(input);
  const refuse = (reason) => ({
    status: "refused",
    reason,
    state,
    nextPhase: null,
  });
  if (!state.reviewPass) {
    return refuse("missing-review-pass");
  }
  if (
    state.target.status === "completed" &&
    state.reviewPass.status === "completed"
  ) {
    return {
      status: "noop",
      reason: "already-closed",
      state,
      nextPhase: null,
    };
  }
  if (state.reviewPass.status !== "active") {
    return refuse("inactive-review-pass");
  }
  if (state.reviewPass.target !== state.target.path) {
    return refuse("review-pass-target-mismatch");
  }
  if (
    state.reviewPass.verdict !== "pass" &&
    state.reviewPass.verdict !== "pass-with-follow-up"
  ) {
    return refuse("invalid-review-verdict");
  }
  const targetBase = basename(state.target.path.replace(/\\/g, "/"));
  const blockingIterate = state.iterates.some(
    (iterate) =>
      iterate.status === "active" &&
      (iterate.addresses === state.target.path ||
        iterate.addresses === targetBase)
  );
  if (blockingIterate) {
    return refuse("active-iterate");
  }
  if (
    !isFingerprintMatch(
      state.reviewPass.fingerprint,
      state.currentFingerprint
    )
  ) {
    return refuse("stale-review-pass");
  }
  const isPhased = state.target.kind === "phase";
  let nextPhase = null;
  let isFinalPhase = false;
  const current = isPhased
    ? state.phases.find((phase) => phase.path === state.target.path)
    : null;
  if (isPhased && !current) {
    return refuse("phase-target-not-found");
  }
  if (
    isPhased &&
    (state.target.status !== "in-progress" ||
      current.status !== "in-progress")
  ) {
    return refuse("phase-not-in-progress");
  }
  const overviewRow = isPhased
    ? state.overview?.rows.find((row) => row.phase === current.order)
    : null;
  if (isPhased && !overviewRow) {
    return refuse("phase-overview-row-not-found");
  }
  if (
    isPhased &&
    !Object.prototype.hasOwnProperty.call(
      state.backlog.items,
      current.backlogPath
    )
  ) {
    return refuse("phase-backlog-item-not-found");
  }

  state.target.status = "completed";
  state.target.acceptance = state.target.acceptance.map(() => true);

  if (isPhased) {
    current.status = "completed";
    overviewRow.status = "completed";

    const completedOrders = new Set(
      state.phases
        .filter((phase) => phase.status === "completed")
        .map((phase) => phase.order)
    );
    nextPhase =
      [...state.phases]
        .sort((a, b) => a.order - b.order)
        .find(
          (phase) =>
            phase.status === "pending" &&
            phase.dependsOn.every((dependency) =>
              completedOrders.has(dependency)
            )
        ) ?? null;

    const currentBacklogPath = current.backlogPath;
    state.backlog.todo = state.backlog.todo.filter(
      (path) => path !== currentBacklogPath
    );
    state.backlog.archived = [
      ...new Set([...state.backlog.archived, currentBacklogPath]),
    ];
    state.backlog.items[currentBacklogPath] = {
      ...state.backlog.items[currentBacklogPath],
      status: "completed",
      completed: state.date,
    };
    if (nextPhase) {
      state.backlog.todo = [
        ...new Set([...state.backlog.todo, nextPhase.backlogPath]),
      ];
    }

    isFinalPhase = state.phases.every(
      (phase) => phase.status === "completed"
    );
    if (isFinalPhase) {
      state.overview.status = "completed";
    }
  }

  if (!isPhased || isFinalPhase) {
    state.parents = state.parents.map((parent) => ({
      ...parent,
      status: "completed",
    }));
    const hasOtherActiveUnit = state.otherUnits.some(
      (unit) =>
        unit.status !== "completed" && unit.status !== "superseded"
    );
    state.subject.status = hasOtherActiveUnit ? "active" : "completed";
  }

  state.memory.status = "completed";
  state.reviewPass.status = "completed";
  state.reviewPass.completed = state.date;

  return {
    status: "applied",
    reason: !isPhased
      ? "non-phased-closed"
      : isFinalPhase
        ? "final-phase-closed"
        : "intermediate-phase-closed",
    state,
    nextPhase,
  };
}
