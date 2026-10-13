#!/usr/bin/env bun
import { resolve } from "node:path";
import { createLazyPool } from "../storage/db.js";
import { applyMigrations } from "../storage/migrations.js";
import { executeWorkflowState, parseArtifactToken, resolveTrustedContext, type ArtifactRef, type WorkflowRequest, type WorkflowRole } from "./workflow-state.js";

const SCOPE = ["projectId", "branchId", "publishedRevisionIds", "worktreeId", "runId", "project", "visibility"] as const;
const SUBJECT_FREE: Record<string, true> = { discover: true, inspect: true, recover: true, migrate: true, list: true, search: true, "read-receipt": true, "write-receipt": true };

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
function rejectScope(value: Record<string, unknown>): void {
  for (const key of SCOPE) if (key in value) fail(`callers cannot supply ${key}; workflow context is bound by the runtime`);
}
function flag(rest: string[], name: string): { value?: string; rest: string[] } {
  const index = rest.indexOf(name);
  if (index < 0) return { rest };
  return { value: rest[index + 1], rest: rest.filter((_, item) => item !== index && item !== index + 1) };
}
function refFor(subject: string | undefined, input: Record<string, unknown>): ArtifactRef | undefined {
  const nested = input.ref;
  if (nested && typeof nested === "object") return { ...(nested as ArtifactRef), ...(subject ? { subjectId: subject } : {}) };
  if (!subject || typeof input.kind !== "string" || typeof input.logicalName !== "string") return undefined;
  return { subjectId: subject, kind: input.kind as ArtifactRef["kind"], logicalName: input.logicalName, ...(typeof input.revision === "string" ? { revision: input.revision } : {}) };
}
function buildRequest(operation: string, subject: string | undefined, branchRef: string | undefined, input: Record<string, unknown>): WorkflowRequest {
  if (operation === "inspect") {
    if (!branchRef) fail("inspect requires --branch refs/heads/<name>");
    return { operation: "inspect", branchRef };
  }
  if (operation === "recover") return { operation: "recover" };
  const ref = refFor(subject, input);
  if (operation === "read") return { operation: "read", ...(typeof input.token === "string" ? { token: input.token } : {}), ...(ref ? { ref } : {}) };
  if (operation === "write" || operation === "correct") return { operation, ...input, ...(ref ? { ref } : {}) } as WorkflowRequest;
  return { operation, ...input, ...(subject ? { subjectId: subject } : {}) } as WorkflowRequest;
}

async function migrate(): Promise<void> {
  const selection = (await resolveTrustedContext(resolve(process.cwd()))).selection!;
  if (selection.storage.adapter !== "postgres") {
    console.log(JSON.stringify({ applied: [], adapter: selection.storage.adapter, message: "SQL migrations apply only to the PostgreSQL adapter" }));
    return;
  }
  const envName = selection.storage.connection_env;
  const url = envName ? process.env[envName] : undefined;
  if (!envName || !url) fail(`PostgreSQL connection env ${envName ?? "(missing)"} is unset`);
  const pool = createLazyPool(url)();
  try { console.log(JSON.stringify(await applyMigrations(pool))); }
  finally { await pool.end(); }
}

const argv = process.argv.slice(2);
const operation = argv[0];
if (!operation) fail("Usage: bun workflow-state-cli.ts <op> [--subject <id>] [--branch <ref>] [JSON]");
if (operation === "migrate") await migrate();
else {
  const subjectFlag = flag(argv.slice(1), "--subject");
  const branchFlag = flag(subjectFlag.rest, "--branch");
  if (subjectFlag.value && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(subjectFlag.value)) fail("--subject must be one safe logical subject id");
  const input = branchFlag.rest[0] ? JSON.parse(branchFlag.rest[0]) as Record<string, unknown> : {};
  rejectScope(input);
  const subject = subjectFlag.value ?? (typeof input.token === "string" ? parseArtifactToken(input.token).subjectId : undefined);
  if (!subject && !SUBJECT_FREE[operation]) fail(`${operation} requires --subject`);
  const cwd = resolve(process.cwd());
  const context = await resolveTrustedContext(cwd);
  // Operator-only executable: restricted children have no execution tool.
  // Ordinary mutations need save permissions, never cross-branch administration.
  const role: WorkflowRole = operation === "inspect" || operation === "recover" ? "admin" : "save";
  const value = await executeWorkflowState({ cwd, request: buildRequest(operation, subject, branchFlag.value, input), context, role });
  if (value === null || value === undefined) process.exitCode = 1;
  console.log(JSON.stringify(value ?? null));
}
