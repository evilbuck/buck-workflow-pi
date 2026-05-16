/**
 * TPS Tracker Extension
 *
 * Tracks tokens per second during model generation and reports
 * final TPS statistics at the end of each agent run.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export function wire(pi: ExtensionAPI): void {
  /** Timestamp of the first streamed output delta for the current assistant message. */
  let streamStart: number | null = null;
  /** Estimated streamed output tokens for live display before providers report final usage. */
  let estimatedStreamedTokens = 0;
  /** Cumulative official output tokens across all assistant messages in this agent run. */
  let totalOutputTokens = 0;
  /** Cumulative time (ms) spent actually streaming output deltas (excludes tool execution and first-token latency). */
  let totalStreamMs = 0;

  pi.on("agent_start", async (_event, ctx) => {
    totalOutputTokens = 0;
    totalStreamMs = 0;
    streamStart = null;
    estimatedStreamedTokens = 0;
    if (ctx.hasUI) {
      ctx.ui.setStatus("tps", ctx.ui.theme.fg("dim", "⏱ generating..."));
    }
  });

  pi.on("message_start", async (event) => {
    if (event.message.role !== "assistant") return;
    streamStart = null;
    estimatedStreamedTokens = 0;
  });

  pi.on("message_update", async (event, ctx) => {
    if (event.message.role !== "assistant") return;

    const streamEvent = event.assistantMessageEvent;
    const isOutputDelta =
      streamEvent.type === "text_delta" ||
      streamEvent.type === "thinking_delta" ||
      streamEvent.type === "toolcall_delta";

    if (!isOutputDelta) return;

    const now = Date.now();
    streamStart ??= now;
    estimatedStreamedTokens += Math.max(0, streamEvent.delta.length / 4);

    const elapsed = (now - streamStart) / 1000;
    const officialTokens = event.message.usage.output;
    const currentTokens =
      officialTokens > 0 ? officialTokens : estimatedStreamedTokens;

    if (elapsed > 0 && currentTokens > 0 && ctx.hasUI) {
      const tps = Math.round(currentTokens / elapsed);
      const tokenLabel =
        officialTokens > 0
          ? `${officialTokens} tok`
          : `~${Math.round(estimatedStreamedTokens)} tok`;
      ctx.ui.setStatus(
        "tps",
        `${ctx.ui.theme.fg("accent", `${tps} tok/s`)} ${ctx.ui.theme.fg("dim", `(${tokenLabel} / ${elapsed.toFixed(1)}s)`)}`,
      );
    }
  });

  pi.on("message_end", async (event) => {
    if (event.message.role !== "assistant") return;

    const messageTokens = event.message.usage.output;
    // Only accumulate streaming messages (those that had at least one output delta).
    // Non-streaming/final-only messages have no meaningful streaming duration.
    if (!streamStart || messageTokens <= 0) {
      streamStart = null;
      estimatedStreamedTokens = 0;
      return;
    }

    totalOutputTokens += messageTokens;
    totalStreamMs += Math.max(0, Date.now() - streamStart);

    streamStart = null;
    estimatedStreamedTokens = 0;
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    const elapsed = totalStreamMs / 1000;
    const tps =
      totalOutputTokens > 0 && elapsed > 0
        ? Math.round(totalOutputTokens / elapsed)
        : 0;

    const theme = ctx.ui.theme;
    const icon = theme.fg("success", "✓");
    const tpsLabel =
      tps > 0 ? theme.fg("accent", `${tps} tok/s`) : theme.fg("dim", "N/A");
    const detail = theme.fg(
      "dim",
      `${totalOutputTokens} tokens in ${elapsed.toFixed(1)}s streaming`,
    );

    ctx.ui.notify(`${icon} ${tpsLabel}  ${detail}`, "info");
    ctx.ui.setStatus("tps", theme.fg("dim", `done — ${tpsLabel}`));
  });
}

export default wire;
