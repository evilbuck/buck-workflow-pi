/**
 * Autonomous Buck phased loop runner for OMP's Bun `eval` kernel.
 * Imported explicitly via module URL from `prompts/b-loop.md` (no bare npm imports).
 */

export {
  countAcceptanceCriteria,
  parseAcceptanceCriteria,
  parseFrontmatter,
  unwrapToolResult,
} from "./frontmatter.js";
export type * from "./types.js";
export {
  parseSubjectArgument,
  resolveAndPinPlan,
  runSh,
  validateBridges,
  validateNamedBranch,
  validateStorageConfig,
} from "./validation.js";

import type { BuckLoopOptions, BuckLoopResult } from "./types.js";
import {
  parseSubjectArgument,
  resolveAndPinPlan,
  tryReadGitOrigin,
  validateBridges,
  validateNamedBranch,
  validateStorageConfig,
} from "./validation.js";

function blockFailure(options: BuckLoopOptions, message: string): BuckLoopResult {
  if (typeof options.bridges?.log === "function") {
    options.bridges.log(`[b-loop blocked] ${message}`);
  }
  return { ok: false, state: "blocked", message };
}

/**
 * Validate bridges, target subject, named Git branch, `repo-files` storage configuration,
 * and discrete phase plan via `workflow_state` before executing stage orchestration.
 */
export async function runBuckLoop(options: BuckLoopOptions = {}): Promise<BuckLoopResult> {
  const cwd = options.cwd ?? (typeof process !== "undefined" ? process.cwd() : ".");
  const rawArgs = options.args ?? "";

  try {
    const subjectId = parseSubjectArgument(rawArgs, options.subject);
    const bridges = validateBridges(options.bridges);
    const branch = await validateNamedBranch(cwd, bridges.sh);
    const origin = await tryReadGitOrigin(cwd, bridges.sh);
    validateStorageConfig({
      configPath: options.configPath,
      xdgConfigHome: options.xdgConfigHome,
      origin,
    });

    const pinnedPlan = await resolveAndPinPlan(bridges.tool.workflow_state, subjectId, branch);
    bridges.phase(`Pinned ${pinnedPlan.subjectId} (${pinnedPlan.phases.length} phases on ${branch.branchName})`);
    bridges.log(
      `[b-loop pinned] subject=${pinnedPlan.subjectId} branch=${branch.branchName} phases=${pinnedPlan.phases.map((p) => p.logicalName).join(",")}`,
    );

    return {
      ok: true,
      state: "pinned",
      subject: pinnedPlan.subjectId,
      branch: branch.branchName,
      pinnedPlan,
      message: `Pinned ${pinnedPlan.phases.length} discrete phases for ${pinnedPlan.subjectId}`,
    };
  } catch (error) {
    return blockFailure(options, error instanceof Error ? error.message : String(error));
  }
}
