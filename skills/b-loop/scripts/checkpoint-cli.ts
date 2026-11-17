#!/usr/bin/env bun
/**
 * Trusted private checkpoint CLI adapter for `/b-loop`.
 * Executed via `bun <resolved-path>/checkpoint-cli.ts` so it reuses `workflow-state.ts`
 * (`FileStorageStore` / `consumers.ts` run-private scope) with revision CAS,
 * branch-ref assertions, and readback verification without polluting `.context/`.
 */

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { resolveTrustedContext, withBoundStore, type TrustedWorkflowContext } from "../../_shared/scripts/workflow-state.js";
import { revisionHash } from "../../_shared/storage/adapter-utils.js";
import { consumerKey, type ConsumerScope } from "../../_shared/storage/consumers.js";
import type { StorageStore } from "../../_shared/storage/contract.js";

interface CliArgs {
  op: "read" | "write";
  kind: "checkpoint" | "run-state";
  cwd: string;
  subjectId: string;
  branchRef: string;
  logicalName: string;
  configPath?: string;
  expectedRevision?: string | null;
  payloadMode?: string;
}

function readFlagMap(argv: readonly string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 1; i < argv.length; i += 2) {
    const flag = argv[i];
    const val = argv[i + 1];
    if (!flag?.startsWith("--") || val === undefined) {
      throw new Error(`Invalid flag argument near "${flag ?? ""}"`);
    }
    map.set(flag, val);
  }
  return map;
}

function parseExpectedRevision(raw: string | undefined): string | null | undefined {
  if (raw === "") throw new Error("--expected-revision cannot be empty");
  if (raw === undefined) return undefined;
  return raw === "null" ? null : raw;
}

function parseKind(raw: string | undefined): "checkpoint" | "run-state" {
  if (!raw || raw === "checkpoint") return "checkpoint";
  if (raw === "run-state") return "run-state";
  throw new Error(`Unsupported checkpoint-cli --kind "${raw}"`);
}

function parseCliArgs(argv: readonly string[]): CliArgs {
  const op = argv[0];
  if (op !== "read" && op !== "write") {
    throw new Error(`Unsupported checkpoint-cli operation "${op ?? ""}"`);
  }
  const map = readFlagMap(argv);
  const rawCwd = map.get("--cwd");
  const subjectId = map.get("--subject");
  const branchRef = map.get("--branch-ref");
  const logicalName = map.get("--logical-name");
  if (!rawCwd || !subjectId || !branchRef || !logicalName) {
    throw new Error("Missing required --cwd, --subject, --branch-ref, or --logical-name");
  }
  return {
    op,
    kind: parseKind(map.get("--kind")),
    cwd: realpathSync(rawCwd),
    subjectId,
    branchRef,
    logicalName,
    configPath: map.get("--config-path") || undefined,
    expectedRevision: parseExpectedRevision(map.get("--expected-revision")),
    payloadMode: map.get("--payload-stdin"),
  };
}

function assertCurrentBranch(cwd: string, expectedBranchRef: string): void {
  const actual = execFileSync("git", ["-C", cwd, "symbolic-ref", "--quiet", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  if (actual !== expectedBranchRef) {
    throw new Error(`Branch drifted during checkpoint operation: expected ${expectedBranchRef}, got ${actual}`);
  }
}

function consumerScopeOf(context: TrustedWorkflowContext): ConsumerScope {
  if (!context.worktreeId || !context.runId) {
    throw new Error("Private checkpoint requires bound worktreeId and runId in trusted workflow context.");
  }
  return {
    projectId: context.projectId,
    branchId: context.branchId,
    worktreeId: context.worktreeId,
    runId: context.runId,
    publishedRevisionIds: context.publishedRevisionIds,
  };
}

async function readPrivateRecord(
  store: StorageStore,
  scope: ConsumerScope,
  input: Pick<CliArgs, "kind" | "subjectId" | "logicalName">,
) {
  const key = consumerKey(scope, input.kind, input.subjectId, input.logicalName);
  const found = await store.read(key);
  if (!found) return { found: false };
  if (found.key.worktreeId !== scope.worktreeId || found.key.runId !== scope.runId) {
    return { found: false };
  }
  if (revisionHash(found.bytes) !== found.sha256) {
    throw new Error(`Private checkpoint digest mismatch on read (${found.revision})`);
  }
  return {
    found: true,
    revision: found.revision,
    sha256: found.sha256,
    checkpoint: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(found.bytes)),
  };
}

function parseWritePayload(payloadMode: string | undefined): { jsonText: string; bytes: Uint8Array; sha256: string } {
  if (payloadMode !== "json") {
    throw new Error("write requires --payload-stdin json");
  }
  const raw = readFileSync(0, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Checkpoint payload must be a JSON object.");
  }
  const jsonText = JSON.stringify(parsed);
  const bytes = new TextEncoder().encode(jsonText);
  return { jsonText, bytes, sha256: revisionHash(bytes) };
}

function assertStoredReadback(
  readback: Awaited<ReturnType<StorageStore["read"]>>,
  scope: ConsumerScope,
  expectedRevision: string,
  expectedSha: string,
) {
  if (!readback) throw new Error("Private checkpoint readback verification failed: missing record");
  const scopeOk =
    readback.key.worktreeId === scope.worktreeId &&
    readback.key.runId === scope.runId &&
    readback.key.branchId === scope.branchId;
  if (!scopeOk || readback.revision !== expectedRevision || readback.sha256 !== expectedSha || revisionHash(readback.bytes) !== expectedSha) {
    throw new Error("Private checkpoint readback verification failed");
  }
  return readback;
}

async function writePrivateCheckpoint(store: StorageStore, scope: ConsumerScope, input: CliArgs) {
  if (input.expectedRevision === undefined) {
    throw new Error("write requires --expected-revision");
  }
  const { bytes, sha256 } = parseWritePayload(input.payloadMode);
  const key = consumerKey(scope, input.kind, input.subjectId, input.logicalName);
  const revision = randomUUID();
  const [written] = await store.writeBatch([
    {
      key,
      revision,
      bytes,
      sha256,
      author: "b-loop",
      source: "b-loop-checkpoint",
      createdAt: new Date().toISOString(),
      links: [],
      expectedRevision: input.expectedRevision,
    },
  ]);
  if (!written || written.revision !== revision || written.sha256 !== sha256) {
    throw new Error("Private checkpoint write returned mismatched revision or digest");
  }
  const readback = assertStoredReadback(await store.read(key, written.revision), scope, written.revision, sha256);
  return {
    revision: readback.revision,
    sha256: readback.sha256,
    checkpoint: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(readback.bytes)),
  };
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  assertCurrentBranch(args.cwd, args.branchRef);
  const context = await resolveTrustedContext(args.cwd, { configPath: args.configPath });
  if (context.selection?.storage.adapter !== "repo-files" || context.selection?.integrationRef) {
    throw new Error("Checkpoint CLI supports only repo-files without integration_ref.");
  }
  const scope = consumerScopeOf(context);
  const output = await withBoundStore(args.cwd, context, async (store) => {
    return args.op === "read"
      ? readPrivateRecord(store, scope, args)
      : writePrivateCheckpoint(store, scope, args);
  });
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
