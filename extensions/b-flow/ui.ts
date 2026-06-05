import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import { Container, Text } from "@mariozechner/pi-tui";
import type { RouteAction, BuckState } from "./types.js";
import { readProjection } from "./persistence.js";

export interface UIMode {
  mode: "guided" | "autonomous";
  skipSafeTransitions: boolean;
}

export async function confirmTransition(
  api: ExtensionAPI,
  ctx: any,
  fromState: BuckState,
  toState: BuckState,
  action: RouteAction,
  mode: UIMode,
): Promise<{ confirmed: boolean; edited?: boolean }> {
  if (mode.mode === "autonomous" && mode.skipSafeTransitions && !isHighRiskTransition(fromState, toState)) {
    return { confirmed: true };
  }

  const actionDesc = describeAction(action);
  const message =
    `b-flow transition: **${fromState}** → **${toState}**\n\n` +
    `Action: ${actionDesc}\n\n` +
    `Proceed?`;

  const confirmed = await ctx.ui.confirm("b-flow confirmation", message);
  if (!confirmed) {
    return { confirmed: false };
  }

  return { confirmed: true };
}

/**
 * Check if the current state requires confirmation before continuing.
 * States that involve executing work or making irreversible decisions need confirmation.
 */
export function isRiskyState(state: BuckState): boolean {
  const riskyStates: BuckState[] = [
    "executingChunks", // Running workers - may have side effects
    "reviewing", // Review may reveal issues
    "saving", // Persisting state
  ];
  return riskyStates.includes(state);
}
/**
 * Check if a specific transition is high risk.
 */
function isHighRiskTransition(from: BuckState, to: BuckState): boolean {
  const risky: Array<[BuckState, BuckState]> = [
    ["executingChunks", "reviewing"],
    ["reviewing", "saving"],
    ["saving", "done"],
  ];
  return risky.some(([f, t]) => f === from && t === to);
}

function describeAction(action: RouteAction): string {
  switch (action.type) {
    case "run-command":
      return `Run command: \`${action.command}\``;
    case "spawn-worker":
      return `Spawn worker for ${action.state} (${action.mode})`;
    case "ask-user":
      return `Ask: ${action.question}`;
    case "block":
      return `Block: ${action.reason}`;
    case "retry":
      return `Retry: ${action.reason}`;
    case "compact":
      return "Compact context, then continue";
    case "new-session":
      return "Start new session, then continue";
    case "mark-done":
      return `Mark done: ${action.reason}`;
    default:
      return "Unknown action";
  }
}

export function buildStatusWidget(
  ctx: any,
  theme: any,
  projectRoot: string,
): { render(width: number): string[]; invalidate(): void } {
  const projection = readProjection(projectRoot);
  if (!projection) {
    return {
      render: () => [],
      invalidate: () => {},
    };
  }

  const completed = projection.queue.filter((q) => q.status === "completed").length;
  const total = projection.queue.length;
  const activeChunk = projection.queue.find((q) => q.status === "in-progress");

  const container = new Container();
  container.addChild(
    new DynamicBorder((s: string) => theme.fg("accent", s)),
  );
  container.addChild(
    new Text(
      theme.fg("accent", `b-flow: ${projection.currentState}`) +
        theme.fg("dim", ` | ${projection.goal.slice(0, 40)}${projection.goal.length > 40 ? "…" : ""}`),
      1,
      0,
    ),
  );
  if (activeChunk) {
    container.addChild(
      new Text(
        theme.fg("warning", `  ▶ ${activeChunk.type}: ${activeChunk.id}`) +
          theme.fg("dim", ` | Queue: ${completed}/${total}`),
        1,
        0,
      ),
    );
  } else if (total > 0) {
    container.addChild(
      new Text(
        theme.fg("dim", `  Queue: ${completed}/${total} completed`),
        1,
        0,
      ),
    );
  }
  container.addChild(
    new DynamicBorder((s: string) => theme.fg("accent", s)),
  );

  return {
    render(width: number) {
      return container.render(width);
    },
    invalidate() {
      container.invalidate();
    },
  };
}
