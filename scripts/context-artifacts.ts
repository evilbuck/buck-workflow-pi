#!/usr/bin/env bun
import {
  classifyArtifact,
  generateIndexes,
  parseSimpleYaml,
  scanContextDir,
  validateArtifact,
  writeIndexes,
} from "../skills/_shared/scripts/context-helpers.js";

export {
  classifyArtifact,
  generateIndexes,
  scanContextDir,
  validateArtifact,
  writeIndexes,
};

/** Compatibility alias: richer parseSimpleYaml-backed parser. */
export const parseFrontmatter = parseSimpleYaml;

function printHelp(): number {
  console.log([
    "Usage:",
    "  bun scripts/context-artifacts.ts <command>",
    "",
    "Commands:",
    "  index      Scan .context/ and regenerate JSON indexes.",
    "  validate   Scan .context/ and report validation issues.",
    "  help       Show this message.",
  ].join("\n"));
  return 0;
}

function runIndex(root: string): number {
  const artifacts = scanContextDir(root);
  const indexes = generateIndexes(artifacts);
  writeIndexes(indexes, root);
  console.log(`index: wrote subjects(${indexes.subjects.length}) memory(${indexes.memory.length}) backlog(${indexes.backlog.length}) artifacts(${indexes.artifacts.length})`);
  return 0;
}

function reportArtifactIssues(artifact: { path: string; errors: string[] }): { warnings: number; errors: number } {
  const warnings = artifact.errors.filter((error) => error.includes("missing required field"));
  const hardErrors = artifact.errors.filter((error) => !error.includes("missing required field"));
  if (warnings.length > 0) {
    console.warn(`${artifact.path}:`);
    for (const warning of warnings) console.warn(`  warn: ${warning}`);
  }
  if (hardErrors.length > 0) {
    console.error(`${artifact.path}:`);
    for (const error of hardErrors) console.error(`  error: ${error}`);
  }
  return { warnings: warnings.length, errors: hardErrors.length };
}

function runValidate(root: string): number {
  let warningCount = 0;
  let errorCount = 0;
  for (const artifact of scanContextDir(root)) {
    const counts = reportArtifactIssues(artifact);
    warningCount += counts.warnings;
    errorCount += counts.errors;
  }
  if (warningCount === 0 && errorCount === 0) console.log("validate: no issues found");
  else if (errorCount === 0) console.log(`validate: ${warningCount} warning(s), 0 errors`);
  else console.log(`validate: ${warningCount} warning(s), ${errorCount} error(s)`);
  return errorCount === 0 ? 0 : 1;
}

export function runCli(): number {
  const command = process.argv[2];
  const root = process.argv[3] || ".";
  if (!command || command === "help") return printHelp();
  if (command === "index") return runIndex(root);
  if (command === "validate") return runValidate(root);
  console.error(`unknown command: '${command}'`);
  return 1;
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("context-artifacts.ts");
if (isMain) {
  process.exit(runCli());
}
