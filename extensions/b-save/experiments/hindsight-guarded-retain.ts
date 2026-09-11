/**
 * Bounded public-SDK experiment: can a restricted nested OMP session host one
 * caller-owned capability whose opaque token is expanded to prevalidated facts
 * before native Hindsight retain executes?
 *
 * Inspects the installed `@oh-my-pi/pi-coding-agent` sources. Never prompts a
 * model, never calls Hindsight HTTP, never mutates a real memory bank.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export type HindsightDeliveryDecision = "guarded_adapter" | "unsupported";

export interface SdkSourceFiles {
  sdk: string;
  extensionTypes: string;
  hindsightBackend: string;
  memoryRetain: string;
}

export interface SdkInspectionInput {
  version: string;
  files: SdkSourceFiles;
  cliVersion?: string | null;
  sdkRoot?: string;
}

export interface SdkObservations {
  allowRestrictedCustomTools: boolean;
  restrictedSessionsSkipCreateMemoryTools: boolean;
  invokeToolSameToolOnly: boolean;
  hindsightBackendImplementsSave: boolean;
  retainToolUsesEnqueueRetain: boolean;
}

export interface SdkInspectionResult {
  sdkVersion: string;
  cliVersion: string | null;
  sdkRoot: string | null;
  apiSurface: string[];
  observations: SdkObservations;
  decision: HindsightDeliveryDecision;
  mechanism: string | null;
  reasons: string[];
}

const API_SURFACE = [
  "CreateAgentSessionOptions.restrictToolNames",
  "CreateAgentSessionOptions.allowRestrictedCustomTools",
  "CreateAgentSessionOptions.customTools",
  "CreateAgentSessionOptions.toolNames",
  "ExtensionContext.invokeTool",
  "MemoryRuntimeContext.save",
  "MemoryRetainTool.execute",
];

const GUARDED_MECHANISM =
  "Restricted nested createAgentSession(restrictToolNames, allowRestrictedCustomTools) registers a caller-owned retain wrapper whose parameters are an opaque token. Trusted execute() expands the token to the prevalidated facts and ctx.invokeTool runs native MemoryRetainTool with those items before any Hindsight queue write.";

function hindsightBackendObjectBody(source: string) {
  const marker = "export const hindsightBackend";
  const start = source.indexOf(marker);
  if (start < 0) return source;
  const lines = source.slice(start).split("\n");
  const end = lines.findIndex((line) => line.trimStart().startsWith("}") && line.trim().endsWith(";"));
  if (end < 0) return lines.join("\n");
  return lines.slice(0, end + 1).join("\n");
}

function skipMemoryTools(sdk: string) {
  const idx = sdk.indexOf("createMemoryTools:");
  if (idx < 0) return false;
  const window = sdk.slice(idx, idx + 160);
  return window.includes("restrictToolNames") && window.includes("undefined");
}

function observeSdkSources(files: SdkSourceFiles) {
  const sdk = files.sdk;
  const types = files.extensionTypes;
  const backend = hindsightBackendObjectBody(files.hindsightBackend);
  return {
    allowRestrictedCustomTools:
      sdk.includes("allowRestrictedCustomTools") &&
      sdk.includes("options.allowRestrictedCustomTools !== true"),
    restrictedSessionsSkipCreateMemoryTools: skipMemoryTools(sdk),
    invokeToolSameToolOnly: types.includes("same-tool only") || types.includes("hasNativeTool"),
    hindsightBackendImplementsSave: backend.includes("async save(") || backend.includes("save("),
    retainToolUsesEnqueueRetain: files.memoryRetain.includes("enqueueRetain("),
  };
}

function deliveryReasons(observations: SdkObservations, canInject: boolean, canDelegate: boolean) {
  const reasons: string[] = [];
  if (!canInject) {
    reasons.push(
      "Restricted createAgentSession does not admit a caller-owned custom tool (allowRestrictedCustomTools is absent or customTools are dropped).",
    );
  }
  if (observations.restrictedSessionsSkipCreateMemoryTools) {
    reasons.push(
      "restrictToolNames leaves createMemoryTools undefined, so native retain/recall/reflect are never registered and ctx.invokeTool has no retain target.",
    );
  }
  if (!observations.invokeToolSameToolOnly) {
    reasons.push("ExtensionContext.invokeTool is not a same-tool native-retain delegation seam.");
  }
  if (!observations.hindsightBackendImplementsSave) {
    reasons.push(
      "hindsightBackend does not implement MemoryBackend.save(), so ctx.memory.save cannot deliver Hindsight facts.",
    );
  }
  if (canInject && !canDelegate) {
    reasons.push(
      "A token-only custom tool can be injected into a restricted session, but trusted execute() cannot expand that token into native Hindsight retain.",
    );
  }
  return reasons;
}

export function inspectSdkSources(input: SdkInspectionInput) {
  const observations = observeSdkSources(input.files);
  const canInject = observations.allowRestrictedCustomTools;
  const canDelegate =
    observations.invokeToolSameToolOnly && !observations.restrictedSessionsSkipCreateMemoryTools;
  const guarded = canInject && canDelegate;
  return {
    sdkVersion: input.version,
    cliVersion: input.cliVersion ?? null,
    sdkRoot: input.sdkRoot ?? null,
    apiSurface: API_SURFACE.slice(),
    observations,
    decision: guarded ? "guarded_adapter" : "unsupported",
    mechanism: guarded ? GUARDED_MECHANISM : null,
    reasons: deliveryReasons(observations, canInject, canDelegate),
  };
}

export function readSdkSources(sdkRoot: string) {
  const src = join(sdkRoot, "src");
  const files = {
    sdk: join(src, "sdk.ts"),
    extensionTypes: join(src, "extensibility", "extensions", "types.ts"),
    hindsightBackend: join(src, "hindsight", "backend.ts"),
    memoryRetain: join(src, "tools", "memory-retain.ts"),
  };
  for (const [name, path] of Object.entries(files)) {
    if (!existsSync(path)) {
      throw new Error("SDK file missing (" + name + "): " + path);
    }
  }
  return {
    sdk: readFileSync(files.sdk, "utf8"),
    extensionTypes: readFileSync(files.extensionTypes, "utf8"),
    hindsightBackend: readFileSync(files.hindsightBackend, "utf8"),
    memoryRetain: readFileSync(files.memoryRetain, "utf8"),
  };
}

export function readSdkVersion(sdkRoot: string) {
  const pkgPath = join(sdkRoot, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (pkg.name !== "@oh-my-pi/pi-coding-agent") {
    throw new Error("Not @oh-my-pi/pi-coding-agent: " + pkgPath + " name=" + (pkg.name ?? "<missing>"));
  }
  if (!pkg.version) throw new Error("SDK package.json missing version: " + pkgPath);
  return pkg.version;
}

export function readOmpCliVersion() {
  try {
    return execFileSync("omp", ["--version"], { encoding: "utf8", timeout: 5_000 }).trim();
  } catch {
    return null;
  }
}

export async function resolveSdkRoot(explicit?: string) {
  if (explicit) return explicit;
  if (process.env.OMP_SDK_ROOT) return process.env.OMP_SDK_ROOT;
  try {
    const resolved = await import.meta.resolve?.("@oh-my-pi/pi-coding-agent/package.json");
    if (resolved) return dirname(fileURLToPath(resolved));
  } catch {
    // fall through to the explicit error below
  }
  throw new Error(
    "Cannot resolve @oh-my-pi/pi-coding-agent. Pass --sdk-root, set OMP_SDK_ROOT, or add the matching optional peer.",
  );
}

export function formatEvidenceMarkdown(result: SdkInspectionResult) {
  const observations = Object.entries(result.observations)
    .map(([key, value]) => "- `" + key + "`: `" + String(value) + "`")
    .join("\n");
  const reasonLines = result.reasons.map((reason) => "- " + reason).join("\n");
  const reasons = reasonLines.length > 0 ? reasonLines : "- none";
  const api = result.apiSurface.map((name) => "- `" + name + "`").join("\n");
  const lock = result.decision === "guarded_adapter" ? "a guarded retain adapter" : "unsupported";
  const mechanism =
    result.mechanism ?? "None. Phase 5 must record Hindsight delivery as `unsupported`.";
  return [
    "---",
    "status: completed",
    "date: 2026-09-10",
    "subject: 2026-09-10.b-save-state-machine-analysis",
    "topics: [b-save, hindsight, omp-sdk, guarded-retain]",
    "informs: [spec-b-save-command-contract.md, plan-b-save-state-machine.md]",
    "---",
    "",
    "# Hindsight guarded-retain public-SDK result",
    "",
    "Locked decision: **`" + result.decision + "`**",
    "",
    "Installed CLI: `" + (result.cliVersion ?? "unknown") + "`",
    "Inspected package: `@oh-my-pi/pi-coding-agent@" + result.sdkVersion + "`",
    "SDK root: npm pack `@oh-my-pi/pi-coding-agent@" + result.sdkVersion + "` (matches installed CLI when present)",
    "",
    "The experiment reads public SDK sources only. It does not prompt a model, call Hindsight HTTP, or write to a memory bank.",
    "",
    "## API surface inspected",
    "",
    api,
    "",
    "## Observations",
    "",
    observations,
    "",
    "## Mechanism",
    "",
    mechanism,
    "",
    "## Reasons",
    "",
    reasons,
    "",
    "## Phase 5 lock",
    "",
    "Hindsight delivery is `" +
      lock +
      "`. Do not expose raw `retain`, patch OMP, or treat `tool_execution_end` as an integrity boundary. Local and Mnemopi continue to use `ctx.memory.status()/save()`. The durable `.context` checkpoint remains valid either way.",
    "",
  ].join("\n");
}

export async function runExperiment(sdkRoot: string) {
  const version = readSdkVersion(sdkRoot);
  return inspectSdkSources({
    version,
    files: readSdkSources(sdkRoot),
    cliVersion: readOmpCliVersion(),
    sdkRoot,
  });
}

function parseArgs(argv: string[]) {
  const out: { sdkRoot?: string; writeEvidence?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--sdk-root") out.sdkRoot = argv[++i];
    else if (token && token.startsWith("--sdk-root=")) out.sdkRoot = token.slice("--sdk-root=".length);
    else if (token === "--write-evidence") out.writeEvidence = argv[++i];
    else if (token && token.startsWith("--write-evidence=")) {
      out.writeEvidence = token.slice("--write-evidence=".length);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sdkRoot = await resolveSdkRoot(args.sdkRoot);
  const result = await runExperiment(sdkRoot);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (args.writeEvidence) {
    writeFileSync(args.writeEvidence, formatEvidenceMarkdown(result));
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
