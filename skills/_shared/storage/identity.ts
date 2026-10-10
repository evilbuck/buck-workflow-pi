import { createHash, randomUUID } from "node:crypto";
import { isAbsolute, normalize, sep } from "node:path";
import type { ArtifactKey } from "./contract.js";

export interface ProjectIdentityInput {
  configuredKey?: string;
  origin?: string;
  gitCommonDir?: string;
}
export interface ProjectIdentity {
  projectId: string;
  identitySource: "configured" | "origin" | "git-common-dir";
  redactedOrigin?: string;
}
export interface BranchIdentity {
  branchId: string;
  ref: string;
  incarnation: string;
  initialTip: string;
}
export interface WorkspaceIdentity {
  projectId: string;
  branchId: string;
  worktreeId: string;
  runId: string;
  private: true;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Canonical comparison form shared by project identity and configuration lookup.
 * Relative filesystem remotes require an absolute origin or configured key.
 */
export function redactOrigin(origin: string): string {
  const text = origin.trim();
  if (!text) throw new Error("Project identity origin is empty");
  if (isAbsolute(text)) return normalize(text);
  if (!text.includes("://")) {
    const match = /^(?:[^@/]+@)?([^:/\s]+):(.+)$/.exec(text);
    if (!match) throw new Error("Relative local project origin is ambiguous; use an absolute origin or configured key");
    return `${match[1]!.toLowerCase()}:${match[2]}`;
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("Project origin is malformed");
  }
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

/** Config is versionable: reject credentials rather than silently discarding them. */
export function configuredOrigin(origin: string): string {
  if (origin.includes("://")) {
    let url: URL;
    try {
      url = new URL(origin.trim());
    } catch {
      throw new Error("Project origin is malformed");
    }
    if (url.username || url.password || url.search || url.hash) throw new Error("Configured project origin must not contain credentials or secret-bearing query/fragment data");
  }
  return redactOrigin(origin);
}

export function resolveProjectIdentity(input: ProjectIdentityInput): ProjectIdentity {
  if (input.configuredKey !== undefined) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(input.configuredKey)) throw new Error("Configured project identity is invalid");
    return { projectId: input.configuredKey, identitySource: "configured" };
  }
  if (input.origin) {
    const redactedOrigin = redactOrigin(input.origin);
    return { projectId: `origin-${digest(redactedOrigin)}`, identitySource: "origin", redactedOrigin };
  }
  if (input.gitCommonDir) {
    const canonical = normalize(input.gitCommonDir);
    if (!isAbsolute(canonical) || canonical.split(sep).includes("..")) throw new Error("Git common directory identity is ambiguous");
    return { projectId: `workspace-${digest(canonical)}`, identitySource: "git-common-dir" };
  }
  throw new Error("Cannot resolve project identity without a configured key, remote origin, or Git common directory");
}

function validLocalBranchRef(ref: string): boolean {
  if (!ref.startsWith("refs/heads/")) return false;
  const name = ref.slice("refs/heads/".length);
  return name.split("/").every((segment) => segment.length > 0 && !segment.startsWith(".") && !segment.endsWith(".") && !segment.endsWith(".lock"))
    && /^[A-Za-z0-9._/-]+$/.test(ref)
    && !ref.includes("..");
}

/** Generate once per observed branch incarnation and persist; do not regenerate for each read or run. */
export function createBranchIdentity(ref: string, initialTip: string): BranchIdentity {
  if (!validLocalBranchRef(ref)) throw new Error("Branch ref is not a canonical local branch ref");
  if (!/^[a-f0-9]{40,64}$/i.test(initialTip)) throw new Error("Branch incarnation needs an observed commit tip");
  const incarnation = randomUUID();
  return { branchId: `branch-${incarnation}`, ref, incarnation, initialTip };
}

export function requireBranchIdentity(identity: BranchIdentity | undefined): BranchIdentity {
  if (!identity || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(identity.branchId) || !/^[0-9a-f-]{36}$/i.test(identity.incarnation) || !identity.initialTip) throw new Error("Branch identity is missing or ambiguous; refusing shared scope");
  if (!validLocalBranchRef(identity.ref)) throw new Error("Branch ref is not a canonical local branch ref");
  if (!/^[a-f0-9]{40,64}$/i.test(identity.initialTip)) throw new Error("Branch incarnation has no valid observed initial tip");
  return identity;
}
function validOpaqueId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
}
export function requireWorkspaceIdentity(identity: WorkspaceIdentity): WorkspaceIdentity {
  if (!validOpaqueId(identity.projectId) || !validOpaqueId(identity.branchId) || !/^worktree-[0-9a-f-]{36}$/i.test(identity.worktreeId) || !/^run-[0-9a-f-]{36}$/i.test(identity.runId)) {
    throw new Error("Workspace identity is missing, ambiguous, or unsafe; refusing shared scope");
  }
  return identity;
}
export function createWorktreeId(): string {
  return `worktree-${randomUUID()}`;
}
export function createRunId(): string {
  return `run-${randomUUID()}`;
}

function hasEmptyWorkspaceField(ids: { projectId: string; workspaceNonce: string; worktreeId: string; runId: string }): boolean {
  return [ids.projectId, ids.workspaceNonce, ids.worktreeId, ids.runId].some((value) => !value.trim());
}
function privateBranchId(projectId: string, workspaceNonce: string): string {
  return "private-" + digest(projectId + "\0" + workspaceNonce);
}
export function createPrivateWorkspaceIdentity(ids: { projectId: string; workspaceNonce: string; worktreeId: string; runId: string }): WorkspaceIdentity {
  if (hasEmptyWorkspaceField(ids)) throw new Error("Private workspace identity fields are required");
  return requireWorkspaceIdentity({ projectId: ids.projectId, branchId: privateBranchId(ids.projectId, ids.workspaceNonce), worktreeId: ids.worktreeId, runId: ids.runId, private: true });
}

function validArtifactScope(key: ArtifactKey): boolean {
  if (!validOpaqueId(key.projectId) || !validOpaqueId(key.subjectId) || !validOpaqueId(key.kind)) return false;
  return key.branchId === undefined || validOpaqueId(key.branchId);
}
function validArtifactRunScope(key: ArtifactKey): boolean {
  if ((key.worktreeId === undefined) !== (key.runId === undefined)) return false;
  if (key.worktreeId === undefined) return true;
  return /^worktree-[0-9a-f-]{36}$/i.test(key.worktreeId) && /^run-[0-9a-f-]{36}$/i.test(key.runId!);
}
function validArtifactName(name: string): boolean {
  if (!name || name.includes("\\") || name.includes("\0") || isAbsolute(name)) return false;
  return name.split("/").every((part) => part !== ".." && part !== "." && part !== "");
}
export function validateArtifactKey(key: ArtifactKey): ArtifactKey {
  if (!validArtifactScope(key)) throw new Error("Artifact identity fields must be safe opaque ids");
  if (!validArtifactRunScope(key)) throw new Error("Run-scoped artifact ids are unsafe");
  if (!validArtifactName(key.logicalName)) throw new Error("Artifact logicalName must be a normalized relative path without traversal components");
  return key;
}
