import type { ExtensionAPI, ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import type { ArtifactKind, StorageStore } from "../../skills/_shared/storage/contract.js";
import { executeWorkflowState, rejectCallerScope, resolveTrustedContext, type ArtifactRef, type TrustedWorkflowContext, type WorkflowRequest, type WorkflowRole } from "../../skills/_shared/scripts/workflow-state.js";

const Params = Type.Object({
  operation: Type.String(),
  token: Type.Optional(Type.String()),
  subjectId: Type.Optional(Type.String()),
  kind: Type.Optional(Type.String()),
  logicalName: Type.Optional(Type.String()),
  revision: Type.Optional(Type.String()),
  text: Type.Optional(Type.String()),
  prefix: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number()),
  cursor: Type.Optional(Type.String()),
  body: Type.Optional(Type.String()),
  bytesBase64: Type.Optional(Type.String()),
  predecessorRevision: Type.Optional(Type.String()),
  idempotencyKey: Type.Optional(Type.String()),
  expectedRevision: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  branchRef: Type.Optional(Type.String()),
  attemptId: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  artifactRevisions: Type.Optional(Type.Array(Type.String())),
  metadataDuties: Type.Optional(Type.Array(Type.String())),
  receiptKind: Type.Optional(Type.String()),
  fromRevision: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  expectedState: Type.Optional(Type.String()),
  intent: Type.Optional(Type.Unknown()),
  evidence: Type.Optional(Type.Array(Type.String())),
}, { additionalProperties: false });

export interface WorkflowStateToolDeps {
  cwd?: string;
  role?: WorkflowRole;
  context?: TrustedWorkflowContext;
  store?: StorageStore;
}

function result(value: unknown): { content: Array<{ type: "text"; text: string }>; details: unknown } {
  return { content: [{ type: "text", text: JSON.stringify(value) }], details: value };
}
function logicalRef(params: Record<string, unknown>): ArtifactRef | undefined {
  if (typeof params.subjectId !== "string" || typeof params.kind !== "string" || typeof params.logicalName !== "string") return undefined;
  return { subjectId: params.subjectId, kind: params.kind as ArtifactKind, logicalName: params.logicalName, ...(typeof params.revision === "string" ? { revision: params.revision } : {}) };
}
function requestFrom(params: Record<string, unknown>): WorkflowRequest {
  rejectCallerScope(params);
  const ref = logicalRef(params);
  const operation = String(params.operation);
  if (operation === "write-receipt") return { ...params, operation, kind: params.receiptKind } as WorkflowRequest;
  if (operation === "read" || operation === "write" || operation === "correct") return { operation, ...params, ...(ref ? { ref } : {}) } as WorkflowRequest;
  return { operation, ...params } as WorkflowRequest;
}

export function workflowStateTool(deps: WorkflowStateToolDeps = {}): ToolDefinition<typeof Params> {
  const role = deps.role ?? "write";
  return {
    name: "workflow_state",
    label: "Workflow State",
    description: "Typed logical operations over Buck workflow artifacts. Address artifacts by token or subject/kind/logicalName. Do not pass project, branch, worktree, run, or visibility scope; the runtime binds them. Restricted stages cannot widen that scope.",
    promptSnippet: "workflow_state: read/list/search/write artifacts by token. No project or visibility arguments. CLI fallback: bun skills/_shared/scripts/workflow-state-cli.ts",
    parameters: Params,
    async execute(_id, params) {
      try {
        rejectCallerScope(params);
        const cwd = deps.cwd ?? process.cwd();
        const context = deps.context ?? await resolveTrustedContext(cwd);
        const value = await executeWorkflowState({ cwd, request: requestFrom(params as Record<string, unknown>), context, role, ...(deps.store ? { store: deps.store } : {}) });
        return result(value);
      } catch (error) {
        const message = (error instanceof Error ? error.message : String(error)).replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted connection]");
        throw new Error(`workflow_state failed: ${message}`);
      }
    },
  };
}

export function wire(api: ExtensionAPI, deps: WorkflowStateToolDeps = {}): void {
  api.registerTool(workflowStateTool(deps));
}
