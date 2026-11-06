import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import type { ArtifactKey, ArtifactRevision, CheckpointSeal, StorageStore } from "./contract.js";

export type AncestryProof = { kind: "ancestor" } | { kind: "not-ancestor" } | { kind: "error"; message: string };
export function resolveCommit(cwd: string, value: string): string {
  if (!value || value.startsWith("-") || value.includes("\0")) throw new Error("invalid Git revision");
  const oid = execFileSync("git", ["-C", cwd, "rev-parse", "--verify", "--end-of-options", `${value}^{commit}`], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 5000 }).trim();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/iu.test(oid)) throw new Error("malformed Git commit id");
  return oid;
}
/** Local proof only; exit 1 is negative evidence, every other failure is unprovable. */
export function proveAncestor(cwd: string, anchor: string, tip: string): AncestryProof {
  try {
    const a = resolveCommit(cwd, anchor);
    const t = resolveCommit(cwd, tip);
    try {
      execFileSync("git", ["-C", cwd, "merge-base", "--is-ancestor", a, t], { stdio: "ignore", timeout: 5000 });
      return { kind: "ancestor" };
    } catch (error) {
      if (error && typeof error === "object" && "status" in error && error.status === 1) return { kind: "not-ancestor" };
      throw error;
    }
  } catch (error) { return { kind: "error", message: String(error) }; }
}
export type CheckpointPublicationProof =
  | { kind: "publishable"; anchor: string; integrationTip: string }
  | { kind: "private"; reason: "already-integrated-at-seal" | "not-yet-integrated" }
  | { kind: "error"; message: string };
export function proveCheckpointPublication(cwd: string, source: string, baseline: string, tip: string): CheckpointPublicationProof {
  try {
    const anchor = resolveCommit(cwd, source);
    const integrationTip = resolveCommit(cwd, tip);
    const before = proveAncestor(cwd, anchor, baseline);
    if (before.kind === "error") return before;
    if (before.kind === "ancestor") return { kind: "private", reason: "already-integrated-at-seal" };
    const after = proveAncestor(cwd, anchor, integrationTip);
    if (after.kind === "error") return after;
    return after.kind === "ancestor" ? { kind: "publishable", anchor, integrationTip } : { kind: "private", reason: "not-yet-integrated" };
  } catch (error) { return { kind: "error", message: String(error) }; }
}
export async function validateCheckpointSeal(checkpoint: CheckpointSeal, read: (revision: string) => Promise<ArtifactRevision | null>): Promise<void> {
  if (!checkpoint.projectId || !checkpoint.branchId || !checkpoint.commit || !checkpoint.integrationTip) throw new Error("checkpoint seal requires project, branch, source commit, and integration tip");
  const seen = new Set<string>();
  for (const entry of checkpoint.revisionSet) {
    if (!entry.revision || !/^[a-f0-9]{64}$/iu.test(entry.sha256) || seen.has(entry.revision)) throw new Error("invalid or duplicate checkpoint member");
    seen.add(entry.revision);
    const item = await read(entry.revision);
    if (!item || item.key.projectId !== checkpoint.projectId || item.key.branchId !== checkpoint.branchId || item.sha256 !== entry.sha256) throw new Error("checkpoint revision is missing, out of scope, or hash-mismatched");
  }
}
export interface CheckpointRecord extends CheckpointSeal { id: string; boundCommit?: string }
/** A binding may select the sealed source or a subsequent commit containing it.
 * Freeze OIDs, never mutable refs; the bound commit is the publication anchor. */
export function checkpointBinding(cwd: string, checkpoint: CheckpointRecord, commit: string): string {
  if (checkpoint.boundCommit) throw new Error("already-bound checkpoint");
  const oid = resolveCommit(cwd, commit);
  if (!/^[a-f0-9]{40,64}$/iu.test(checkpoint.commit) || !/^[a-f0-9]{40,64}$/iu.test(checkpoint.integrationTip)) throw new Error("checkpoint must freeze resolved Git OIDs");
  if (proveAncestor(cwd, checkpoint.commit, oid).kind !== "ancestor") throw new Error("binding is unrelated to sealed source");
  return oid;
}
export interface RewriteAttestation {
  projectId: string;
  checkpointId: string;
  revisionSet: CheckpointSeal["revisionSet"];
  targetCommit: string;
  evidence: readonly string[];
}
function exactSnapshot(a: CheckpointSeal["revisionSet"], b: CheckpointSeal["revisionSet"]): boolean {
  if (!a.length || a.length !== b.length || new Set(a.map(x => x.revision)).size !== a.length) return false;
  const entries = new Map(b.map(x => [x.revision, x.sha256]));
  return a.every(x => entries.get(x.revision) === x.sha256);
}
export function acceptRewriteAttestation(cwd: string, mapping: RewriteAttestation, checkpoint: CheckpointRecord, tip: string): { ok: true; target: string } | { ok: false; reason: string } {
  if (mapping.projectId !== checkpoint.projectId || mapping.checkpointId !== checkpoint.id || !exactSnapshot(mapping.revisionSet, checkpoint.revisionSet)) return { ok: false, reason: "mapping requires selected checkpoint and exact snapshot" };
  if (!mapping.evidence.some(x => x.trim() && !/^patch-id:/iu.test(x))) return { ok: false, reason: "patch-id alone is not mapping evidence" };
  try {
    const target = resolveCommit(cwd, mapping.targetCommit);
    if (proveAncestor(cwd, target, tip).kind !== "ancestor") return { ok: false, reason: "mapping target is not reachable" };
    return { ok: true, target };
  } catch (error) { return { ok: false, reason: String(error) }; }
}
export interface PublishedMember { revision: string; sha256: string; key: ArtifactKey; checkpointId: string; anchor: string }
export interface PublicationView {
  tip: string;
  members: PublishedMember[];
  conflicts: Record<string, PublishedMember[]>;
  proofs: { checkpointId: string; anchor?: string; kind: string }[];
}
export interface PublicationLedger {
  mappings: RewriteAttestation[];
  resolutions: Record<string, { revision: string; candidates: string[] }>;
  view: PublicationView;
}
function logicalKey(key: ArtifactKey): string { return JSON.stringify([key.projectId, key.subjectId, key.kind, key.logicalName]); }
function ledgerKey(projectId: string): ArtifactKey {
  return { projectId, branchId: "publication-authority", worktreeId: "worktree-00000000-0000-0000-0000-000000000000", runId: "run-00000000-0000-0000-0000-000000000000", subjectId: "publication-authority", kind: "run-state", logicalName: "integration-view.json" };
}
export async function readPublicationLedger(store: StorageStore, projectId: string): Promise<{ revision: string | null; value: PublicationLedger }> {
  const stored = await store.read(ledgerKey(projectId));
  return { revision: stored?.revision ?? null, value: stored ? JSON.parse(new TextDecoder().decode(stored.bytes)) as PublicationLedger : { mappings: [], resolutions: {}, view: { tip: "", members: [], conflicts: {}, proofs: [] } } };
}
async function writeLedger(store: StorageStore, projectId: string, revision: string | null, value: PublicationLedger): Promise<void> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  await store.writeBatch([{ key: ledgerKey(projectId), revision: randomUUID(), expectedRevision: revision, bytes, sha256: createHash("sha256").update(bytes).digest("hex"), source: "publication-authority", author: "runtime", createdAt: new Date().toISOString(), links: [] }]);
}
function checkpointEvidence(cwd: string, checkpoint: CheckpointRecord, tip: string, mappings: RewriteAttestation[]): { kind: string; anchor?: string } {
  if (checkpoint.branchId.startsWith("private-")) return { kind: "workspace-private" };
  if (!checkpoint.boundCommit) return { kind: "unbound" };
  const proof = proveCheckpointPublication(cwd, checkpoint.boundCommit, checkpoint.integrationTip, tip);
  if (proof.kind === "publishable") return { kind: "published", anchor: proof.anchor };
  for (const mapping of mappings.filter(x => x.checkpointId === checkpoint.id)) {
    const accepted = acceptRewriteAttestation(cwd, mapping, checkpoint, tip);
    if (accepted.ok) return { kind: "mapped", anchor: accepted.target };
  }
  return { kind: proof.kind === "private" ? proof.reason : "git-error" };
}
async function checkpointMembers(store: StorageStore, checkpoint: CheckpointRecord, anchor: string): Promise<PublishedMember[]> {
  const results: PublishedMember[] = [];
  for (const entry of checkpoint.revisionSet) {
    const item = await store.readCheckpointRevision(checkpoint.projectId, checkpoint.branchId, entry.revision);
    if (!item || item.sha256 !== entry.sha256) throw new Error("sealed member unavailable");
    if (item.key.runId || item.key.worktreeId || staysPrivateAfterMerge(item.key.kind)) continue;
    results.push({ ...entry, key: item.key, checkpointId: checkpoint.id, anchor });
  }
  return results;
}
function supersedes(cwd: string, older: PublishedMember, newer: PublishedMember, parents: ReadonlyMap<string, string>): boolean {
  if (older.revision === newer.revision) return false;
  const seen = new Set<string>();
  let parent = parents.get(newer.revision);
  while (parent && !seen.has(parent)) {
    if (parent === older.revision) return true;
    seen.add(parent);
    parent = parents.get(parent);
  }
  // Code ancestry does not authorize superseding an independent branch draft.
  return older.key.branchId === newer.key.branchId && older.anchor !== newer.anchor
    && proveAncestor(cwd, older.anchor, newer.anchor).kind === "ancestor";
}
function selectArtifact(cwd: string, candidates: PublishedMember[], baseline: PublishedMember[], parents: ReadonlyMap<string, string>, resolution?: { revision: string; candidates: string[] }): { members: PublishedMember[]; conflict?: PublishedMember[] } {
  const unique = [...new Map(candidates.map(x => [x.revision, x])).values()];
  const latest = unique.filter(x => !unique.some(y => supersedes(cwd, x, y, parents)));
  const sameConflict = resolution && JSON.stringify(latest.map(x => x.revision).sort()) === JSON.stringify(resolution.candidates);
  const selected = sameConflict ? latest.find(x => x.revision === resolution.revision) : undefined;
  if (selected) return { members: [selected] };
  if (new Set(latest.map(x => x.sha256)).size <= 1) return { members: latest.slice(0, 1) };
  return { members: baseline.filter(x => candidates.some(y => y.revision === x.revision)), conflict: latest };
}

async function provenGroups(store: StorageStore, cwd: string, projectId: string, tip: string, mappings: RewriteAttestation[]) {
  const groups = new Map<string, PublishedMember[]>();
  const proofs: PublicationView["proofs"] = [];
  const checkpoints = [...await store.listCheckpoints(projectId)].sort((a, b) => a.id.localeCompare(b.id));
  for (const checkpoint of checkpoints) {
    const evidence = checkpointEvidence(cwd, checkpoint, tip, mappings);
    const anchor = evidence.anchor;
    proofs.push({ checkpointId: checkpoint.id, ...evidence });
    if (!anchor) continue;
    for (const member of await checkpointMembers(store, checkpoint, anchor)) {
      const key = logicalKey(member.key);
      groups.set(key, [...(groups.get(key) ?? []), member]);
    }
  }
  return { groups, proofs };
}
export async function reconcileStore(store: StorageStore, cwd: string, projectId: string, integrationRef: string): Promise<readonly string[]> {
  const previous = await readPublicationLedger(store, projectId);
  let tip: string;
  try { tip = resolveCommit(cwd, integrationRef); } catch {
    const value = { ...previous.value, view: { tip: "", members: [], conflicts: {}, proofs: [{ checkpointId: "", kind: "integration-tip-unprovable" }] } };
    await writeLedger(store, projectId, previous.revision, value);
    return [];
  }
  const { groups, proofs } = await provenGroups(store, cwd, projectId, tip, previous.value.mappings);
  const parents = await store.correctionLineage(projectId);
  const view: PublicationView = { tip, members: [], conflicts: {}, proofs };
  for (const [key, candidates] of groups) {
    const selected = selectArtifact(cwd, candidates, previous.value.view.members.filter(x => logicalKey(x.key) === key), parents, previous.value.resolutions[key]);
    view.members.push(...selected.members);
    if (selected.conflict) view.conflicts[key] = selected.conflict;
  }
  const value = { ...previous.value, view };
  if (JSON.stringify(value) !== JSON.stringify(previous.value)) await writeLedger(store, projectId, previous.revision, value);
  return view.members.map(x => x.revision);
}
export async function recordRewriteMapping(store: StorageStore, cwd: string, projectId: string, integrationRef: string, mapping: RewriteAttestation): Promise<void> {
  const checkpoint = (await store.listCheckpoints(projectId)).find(x => x.id === mapping.checkpointId);
  if (!checkpoint || mapping.projectId !== projectId) throw new Error("unknown selected checkpoint");
  const accepted = acceptRewriteAttestation(cwd, mapping, checkpoint, integrationRef);
  if (!accepted.ok) throw new Error(accepted.reason);
  const previous = await readPublicationLedger(store, projectId);
  previous.value.mappings = [...previous.value.mappings.filter(x => x.checkpointId !== checkpoint.id), { ...mapping, targetCommit: accepted.target }];
  await writeLedger(store, projectId, previous.revision, previous.value);
}

export async function revokeRewriteMapping(store: StorageStore, projectId: string, checkpointId: string): Promise<void> {
  const previous = await readPublicationLedger(store, projectId);
  if (!previous.value.mappings.some(x => x.checkpointId === checkpointId)) throw new Error("unknown rewrite mapping");
  previous.value.mappings = previous.value.mappings.filter(x => x.checkpointId !== checkpointId);
  await writeLedger(store, projectId, previous.revision, previous.value);
}
export async function resolvePublicationConflict(store: StorageStore, projectId: string, revision: string): Promise<void> {
  const previous = await readPublicationLedger(store, projectId);
  const conflict = Object.entries(previous.value.view.conflicts).find(([, candidates]) => candidates.some(x => x.revision === revision));
  if (!conflict) throw new Error("revision is not a current conflict candidate");
  previous.value.resolutions[conflict[0]] = { revision, candidates: conflict[1].map(x => x.revision).sort() };
  await writeLedger(store, projectId, previous.revision, previous.value);
}
const PRIVATE_AFTER_MERGE: Record<string, true> = { "run-state": true, checkpoint: true, activity: true, audit: true, receipt: true, attribution: true };
export function staysPrivateAfterMerge(kind: string): boolean { return PRIVATE_AFTER_MERGE[kind] === true; }
