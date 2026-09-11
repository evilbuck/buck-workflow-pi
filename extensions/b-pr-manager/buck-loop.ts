import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { attestationsForHead, type BuildAttestation, type ReviewAttestation, type VerificationAttestation } from "./types.js";

export type BuildBlock = "unrelated_paths" | "no_progress" | "placeholder" | "destructive";

export interface BuildInspection {
  expectedPaths: string[];
  actualPaths: string[];
  blocked: BuildBlock | null;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function containsPlaceholder(text: string): boolean {
  return /\b(?:TODO|FIXME|not implemented|placeholder)\b/i.test(text);
}

export function inspectBuild(expectedPaths: readonly string[], actualPaths: readonly string[], changedText: readonly string[] = [], destructive = false): BuildInspection {
  const expected = unique(expectedPaths);
  const actual = unique(actualPaths);
  if (destructive) return { expectedPaths: expected, actualPaths: actual, blocked: "destructive" };
  if (actual.length === 0) return { expectedPaths: expected, actualPaths: actual, blocked: "no_progress" };
  if (actual.some((path) => !expected.includes(path))) return { expectedPaths: expected, actualPaths: actual, blocked: "unrelated_paths" };
  if (changedText.some(containsPlaceholder)) return { expectedPaths: expected, actualPaths: actual, blocked: "placeholder" };
  return { expectedPaths: expected, actualPaths: actual, blocked: null };
}

export function attestationsMatchHead(review: ReviewAttestation | null, verification: VerificationAttestation | null, headOid: string, diffDigest: string): boolean {
  const current = attestationsForHead(review, verification, headOid);
  return current.reviewAttestation?.diffDigest === diffDigest && current.verificationAttestation?.diffDigest === diffDigest;
}

export function artifactPath(contextDir: string, date: string, prNumber: number, round: number): string {
  return join(contextDir, `${date}.pr-${prNumber}-feedback`, `iterate-pr-${prNumber}-round-${round}.md`);
}

export async function writeIterationArtifact(options: { contextDir: string; date: string; prNumber: number; round: number; feedbackIds: readonly string[]; expectedPaths: readonly string[]; actualPaths: readonly string[]; verificationCommands: readonly string[]; exitCodes: readonly number[] }): Promise<string> {
  const path = artifactPath(options.contextDir, options.date, options.prNumber, options.round);
  await mkdir(join(options.contextDir, `${options.date}.pr-${options.prNumber}-feedback`), { recursive: true });
  const lines = [
    `# Iterate PR ${options.prNumber} round ${options.round}`,
    "", "## Feedback", ...options.feedbackIds.map((id) => `- ${id}`),
    "", "## Expected paths", ...options.expectedPaths.map((path) => `- ${path}`),
    "", "## Actual paths", ...options.actualPaths.map((path) => `- ${path}`),
    "", "## Deterministic checks", ...options.verificationCommands.map((command, index) => `- ${command} (exit ${options.exitCodes[index] ?? "not run"})`), "",
  ];
  await writeFile(path, lines.join("\n"));
  return path;
}

export function buildAttestation(headOid: string, inspection: BuildInspection): BuildAttestation {
  return { headOid, expectedPaths: inspection.expectedPaths, actualPaths: inspection.actualPaths };
}

export interface CheckContract {
  source: "guardrails.json" | "none";
  commands: string[];
}

export async function resolveCheckContract(repoRoot: string): Promise<CheckContract> {
  try {
    const raw = JSON.parse(await readFile(join(repoRoot, "guardrails.json"), "utf8")) as {
      ecosystems?: Array<{ test_runner?: string | null }>;
    };
    const commands = (raw.ecosystems ?? [])
      .map((ecosystem) => ecosystem.test_runner)
      .filter((command): command is string => typeof command === "string" && command.length > 0);
    if (commands.length > 0) return { source: "guardrails.json", commands };
  } catch {
    /* missing or invalid contract */
  }
  return { source: "none", commands: [] };
}

