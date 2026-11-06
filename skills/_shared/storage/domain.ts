import { randomUUID } from "node:crypto";
import { keyId, revisionHash } from "./adapter-utils.js";
import type { ArtifactKind, ArtifactKey, ArtifactQuery, ArtifactRevision, LifecycleRecord, LifecycleTransition, RunReceipt, ScopedCorrection, StorageStore } from "./contract.js";
import { completedSubjectIds } from "../scripts/context-helpers.js";
import { applySubjectLifecycleTexts, inspectSubjectLifecycleTexts, provenanceFromIndexText } from "../scripts/subject-lifecycle.js";

export const TOMBSTONE_SOURCE = "tombstone";

export interface PageItem {
  revision: string;
  createdAt: string;
  logicalName: string;
  source: string;
  searchText: string;
}

export interface KeyedPageItem extends PageItem {
  key: ArtifactKey;
}

export function correctionQuery(correction: ScopedCorrection): ArtifactQuery {
  if (!correction.key.branchId) throw new Error("correction requires a branch identity");
  return { projectId: correction.key.projectId, branchId: correction.key.branchId, publishedRevisionIds: correction.publishedRevisionIds ?? [], worktreeId: correction.key.worktreeId, runId: correction.key.runId };
}

export function tombstoneRevision(key: ArtifactKey, predecessor: string): ArtifactRevision {
  const bytes = new Uint8Array();
  return {
    key: { ...key },
    revision: randomUUID(),
    bytes,
    sha256: revisionHash(bytes),
    author: "storage",
    source: TOMBSTONE_SOURCE,
    createdAt: new Date().toISOString(),
    links: [],
    expectedRevision: predecessor,
  };
}

const LIFECYCLE_NAMES: Partial<Record<ArtifactKind, RegExp>> = {
  "subject-index": /^index\.md$/u,
  plan: /^plan-[^/\\]+\.md$/u,
  phase: /^phase-\d+-[^/\\]+\.md$/u,
};

function evidenceFromBodies(records: readonly ArtifactRevision[]): { index: string; files: Map<string, string>; provenance: LifecycleRecord["provenance"] } {
  const files = new Map<string, string>();
  let index = "";
  for (const record of records) {
    const name = record.key.logicalName;
    if (!LIFECYCLE_NAMES[record.key.kind]?.test(name)) continue;
    const body = new TextDecoder().decode(record.bytes);
    files.set(name, body);
    if (name === "index.md") index = body;
  }
  return { index, files, provenance: provenanceFromIndexText(index) };
}

export interface StoredCorrection {
  predecessorRevision: string;
  /** Exact immutable result, including tombstones; null only in legacy metadata. */
  resultRevision: string | null;
  /** Null denotes deletion; public deletion/replay still returns null. */
  replacementSha256: string | null;
}

export function correctionDecision(existing: StoredCorrection | null, correction: ScopedCorrection): "apply" | "replay" {
  if (!existing) return "apply";
  const sha = correction.replacement?.sha256 ?? null;
  const samePayload = existing.predecessorRevision === correction.predecessorRevision && existing.replacementSha256 === sha;
  if (!samePayload) throw new Error("correction idempotency key conflict");
  return "replay";
}

export function inspectStoredLifecycle(items: readonly ArtifactRevision[], projectId: string, branchId: string, subjectId: string): LifecycleRecord | null {
  const index = items.find((item) => item.key.kind === "subject-index" && item.key.logicalName === "index.md");
  if (!index) return null;
  const texts = evidenceFromBodies(items);
  const inspection = inspectSubjectLifecycleTexts(texts.index, texts.files);
  return { projectId, branchId, subjectId, revision: index.revision, state: inspection.state, effectiveState: inspection.effectiveState, provenance: inspection.provenance, evidence: items.map((item) => item.revision) };
}

export function lifecycleRevision(items: readonly ArtifactRevision[], input: LifecycleTransition): ArtifactRevision {
  const current = inspectStoredLifecycle(items, input.projectId, input.branchId, input.subjectId);
  assertLifecycleCurrent(current, input);
  const texts = evidenceFromBodies(items);
  const text = applySubjectLifecycleTexts(texts.index, texts.files, input.intent);
  const index = items.find((item) => item.key.kind === "subject-index" && item.key.logicalName === "index.md");
  const key: ArtifactKey = { projectId: input.projectId, branchId: input.branchId, subjectId: input.subjectId, kind: "subject-index", logicalName: index?.key.logicalName ?? "index.md" };
  const bytes = new TextEncoder().encode(text);
  return { key, revision: randomUUID(), bytes, sha256: revisionHash(bytes), author: "storage", source: "subject-lifecycle", createdAt: new Date().toISOString(), links: index?.links ?? [], expectedRevision: index?.key.branchId === input.branchId ? index.revision : null };
}

function assertLifecycleCurrent(current: LifecycleRecord | null, input: LifecycleTransition): void {
  if ((current?.revision ?? null) !== input.fromRevision || (current?.state ?? "missing") !== input.expectedState) throw new Error("stale lifecycle transition refused");
}

export function assertCorrectionPredecessor(items: readonly { key: ArtifactKey; revision: string }[], correction: ScopedCorrection): string | null {
  const key = correction.key;
  const predecessor = items.find((item) => item.key.subjectId === key.subjectId && item.key.kind === key.kind && item.key.logicalName === key.logicalName && item.key.worktreeId === key.worktreeId && item.key.runId === key.runId);
  if (!predecessor || predecessor.revision !== correction.predecessorRevision) throw new Error("stale correction rejected");
  if (correction.replacement && keyId(correction.replacement.key) !== keyId(key)) throw new Error("correction cannot change artifact scope");
  return predecessor.key.branchId === key.branchId ? predecessor.revision : null;
}

export function receiptRevisionReadable(item: ArtifactRevision, receipt: RunReceipt): boolean {
  const key = item.key;
  return key.projectId === receipt.projectId && key.branchId === receipt.branchId
    && (!key.worktreeId || key.worktreeId === receipt.worktreeId)
    && (!key.runId || key.runId === receipt.runId)
    && revisionHash(item.bytes) === item.sha256;
}

export function assertReceiptComplete(attempted: RunReceipt | null, receipt: RunReceipt, readable: ReadonlySet<string>): void {
  if (receipt.status !== "complete") return;
  assertAttemptMatch(attempted, receipt);
  assertMetadataDuties(attempted!, receipt);
  if (receipt.artifactRevisions.length === 0) {
    assertNoFact(receipt);
    return;
  }
  assertRowReadback(receipt, readable);
}

export function assertReceiptIdentity(current: RunReceipt | null, receipt: RunReceipt): void {
  if (current === null) {
    if (receipt.status === "complete") throw new Error("complete receipt requires matching attempted identity");
    return;
  }
  if (sameReceiptScope(current, receipt) && current.status !== "complete") {
    assertRequiredDutiesUnchanged(current, receipt);
    return;
  }
  throw new Error("receipt attempt or scope mismatch, or already complete");
}

function assertRequiredDutiesUnchanged(current: RunReceipt, receipt: RunReceipt): void {
  if (receipt.status === "attempted" && !sameIds(current.metadataDuties ?? [], receipt.metadataDuties ?? [])) throw new Error("receipt required metadata duties cannot change");
}

export function assertReceiptReadback(stored: Pick<RunReceipt, "status" | "attemptId" | "branchId">, receipt: RunReceipt): void {
  if (stored.status === receipt.status && stored.attemptId === receipt.attemptId && stored.branchId === receipt.branchId) return;
  throw new Error("receipt readback mismatch");
}

function sameReceiptScope(current: RunReceipt, receipt: RunReceipt): boolean {
  return current.attemptId === receipt.attemptId && current.branchId === receipt.branchId && current.worktreeId === receipt.worktreeId;
}

export function selectPage<T extends PageItem>(items: readonly T[], query: { text?: string; limit?: number; cursor?: string }): T[] {
  const ranked = query.text === undefined ? byTime(withoutTombstones(items)) : rankText(withoutTombstones(items), query.text);
  return sliceAfter(ranked, query.cursor, query.limit);
}

export async function discoverStoredContext(
  store: Pick<StorageStore, "list" | "inspectLifecycle">,
  query: ArtifactQuery,
): Promise<{ subjects: ArtifactRevision[]; backlog: ArtifactRevision[]; links: ArtifactKey[] }> {
  const items = await store.list({ ...query, subjectId: undefined, kind: undefined, logicalNamePrefix: undefined, limit: undefined, cursor: undefined });
  const states = new Map<string, string | null>();
  for (const subjectId of new Set(items.map((item) => item.key.subjectId))) {
    states.set(subjectId, inspectStoredLifecycle(items.filter((item) => item.key.subjectId === subjectId), query.projectId, query.branchId, subjectId)?.effectiveState ?? null);
  }
  const completed = completedSubjectIds(states);
  const visible = items.filter((item) => !completed.has(item.key.subjectId) && matchesDiscoveryFilter(item.key, query));
  return {
    subjects: visible.filter((item) => item.key.kind === "subject-index"),
    backlog: visible.filter((item) => item.key.kind === "backlog"),
    links: visible.flatMap((item) => item.links).filter((link) => !completed.has(link.subjectId)),
  };
}

function matchesDiscoveryFilter(key: ArtifactKey, query: ArtifactQuery): boolean {
  return (query.subjectId === undefined || key.subjectId === query.subjectId)
    && (query.kind === undefined || key.kind === query.kind)
    && (query.logicalNamePrefix === undefined || key.logicalName.startsWith(query.logicalNamePrefix));
}

export async function lookupKnowledge(
  store: Pick<StorageStore, "list" | "search">,
  query: ArtifactQuery & { text?: string },
): Promise<readonly ArtifactRevision[]> {
  return query.text === undefined ? store.list(query) : store.search({ ...query, text: query.text });
}

function assertAttemptMatch(attempted: RunReceipt | null, receipt: RunReceipt): void {
  if (!attempted || attempted.status !== "attempted") throw new Error("complete receipt requires matching attempted identity");
  if (attempted.projectId !== receipt.projectId || attempted.branchId !== receipt.branchId || attempted.worktreeId !== receipt.worktreeId || attempted.runId !== receipt.runId || attempted.attemptId !== receipt.attemptId) {
    throw new Error("receipt attempt or scope mismatch");
  }
  if (sameIds(attempted.artifactRevisions, receipt.artifactRevisions)) return;
  throw new Error("receipt revision set does not match the attempt");
}

function assertMetadataDuties(attempted: RunReceipt, receipt: RunReceipt): void {
  const completed = new Set(receipt.metadataDuties ?? []);
  const missing = (attempted.metadataDuties ?? []).filter((duty) => !completed.has(duty));
  if (missing.length) throw new Error(`receipt complete requires successful metadata duties: ${missing.join(", ")}`);
}

function assertNoFact(receipt: RunReceipt): void {
  if (receipt.kind !== "no-fact" || !receipt.metadataDuties?.includes("probe")) throw new Error("no-fact save requires a successful probe duty");
}

function assertRowReadback(receipt: RunReceipt, readable: ReadonlySet<string>): void {
  if (receipt.kind === "no-fact") throw new Error("no-fact save cannot list artifact revisions");
  if (!receipt.metadataDuties?.includes("readback")) throw new Error("receipt complete requires readback duty");
  if (receipt.artifactRevisions.every((id) => readable.has(id))) return;
  throw new Error("uncertain persistence blocks save");
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return [...left].sort().join("\0") === [...right].sort().join("\0");
}

function withoutTombstones<T extends PageItem>(items: readonly T[]): T[] {
  return items.filter((item) => item.source !== TOMBSTONE_SOURCE);
}

function byTime<T extends PageItem>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.revision.localeCompare(right.revision));
}

function rankText<T extends PageItem>(items: readonly T[], text: string): T[] {
  const terms = text.toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return items
    .map((item) => ({ item, score: terms.reduce((sum, term) => sum + Number(item.searchText.includes(term)), 0) }))
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score || left.item.logicalName.localeCompare(right.item.logicalName) || left.item.revision.localeCompare(right.item.revision))
    .map((row) => row.item);
}

function sliceAfter<T extends { revision: string }>(items: readonly T[], cursor: string | undefined, limit: number | undefined): T[] {
  if (cursor !== undefined && !items.some((item) => item.revision === cursor)) return [];
  const start = cursor === undefined ? 0 : items.findIndex((item) => item.revision === cursor) + 1;
  const rest = items.slice(start);
  return limit === undefined ? rest : rest.slice(0, limit);
}
