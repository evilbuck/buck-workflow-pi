import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createActor } from "xstate";
import { createBuckMachine } from "./machine.js";
import { readProjection, readSnapshot, writeProjection, writeSnapshot } from "./persistence.js";
import type { BuckActor } from "./machine.js";
import { confirmTransition } from "./ui.js";
import { killWorkerPid } from "./worker.js";
import { createCheckpointCommit } from "./checkpoint.js";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";

const UI_MODE_KEY = "b-flow:ui-mode";

function getMode(): { mode: "guided" | "autonomous"; skipSafeTransitions: boolean } {
  try {
    const raw = globalThis.localStorage?.getItem(UI_MODE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { mode: "guided", skipSafeTransitions: false };
}

function setMode(mode: { mode: "guided" | "autonomous"; skipSafeTransitions: boolean }): void {
  try {
    globalThis.localStorage?.setItem(UI_MODE_KEY, JSON.stringify(mode));
  } catch { /* ignore */ }
}

export function wire(api: ExtensionAPI): void {
  let actor: BuckActor | null = null;
  let actorSubscription: { unsubscribe: () => void } | null = null;
  let projectRoot = "";
  let prevState = "idle";

  function persistActor(current: BuckActor): void {
    try {
      const snapshot = current.getSnapshot();
      const currentState = snapshot.context.projection.currentState;

      // Fire checkpoint on reviewing → saving transition (review passed, about to save)
      if (prevState === "reviewing" && currentState === "saving") {
        const result = createCheckpointCommit({
          projectRoot,
          subject: snapshot.context.subject,
        });
        if (result.success) {
          console.log(`[b-flow] Checkpoint committed: ${result.commitHash}`);
        } else if (!result.skipped) {
          console.error(`[b-flow] Checkpoint failed: ${result.error}`);
        }
      }
      prevState = currentState;

      writeProjection(projectRoot, snapshot.context.projection);
      writeSnapshot(projectRoot, current.getPersistedSnapshot());
    } catch (err) {
      console.error("[b-flow] Failed to persist actor snapshot:", err);
    }
  }

  function clearActor(): void {
    actorSubscription?.unsubscribe();
    actorSubscription = null;
    actor = null;
  }

  function ensureActor(): BuckActor {
    if (!actor) {
      const persistedSnapshot = readSnapshot(projectRoot);
      actor = persistedSnapshot
        ? createActor(createBuckMachine(projectRoot), { snapshot: persistedSnapshot as any })
        : createActor(createBuckMachine(projectRoot));
      actorSubscription = actor.subscribe(() => persistActor(actor!));
      actor.start();
      persistActor(actor);
    }
    return actor;
  }

  // --- Commands ---

  api.registerCommand("b-flow", {
    description: "Buck workflow orchestration — /b-flow <subcommand>",
    handler: async (args: string, ctx) => {
      projectRoot = ctx.cwd;
      const parts = (args ?? "").trim().split(/\s+/).filter(Boolean);
      const subcommand = parts[0] ?? "status";

      switch (subcommand) {
        case "start": {
          const goal = parts.slice(1).join(" ") || "Untitled goal";
          const current = ensureActor();
          current.send({ type: "START", goal });
          persistActor(current);
          ctx.ui.notify(`🚀 b-flow started: "${goal}". Run /b-flow run to execute queued chunks.`, "info");
          break;
        }
        case "run": {
          const autonomous = parts.includes("--autonomous");
          if (autonomous) {
            setMode({ mode: "autonomous", skipSafeTransitions: true });
          } else {
            setMode({ mode: "guided", skipSafeTransitions: false });
          }
          const modeInfo = getMode();
          ensureActor().send({ type: "RESUME" });
          ensureActor().send({ type: "CONTINUE" });
          ctx.ui.notify(
            autonomous
              ? "🤖 b-flow running in autonomous mode (guardrails still block)"
              : "▶️ b-flow running in guided mode (confirmations required for transitions)",
            "info",
          );
          break;
        }
        case "continue": {
          ensureActor().send({ type: "RESUME" });
          ensureActor().send({ type: "CONTINUE" });
          ctx.ui.notify("▶️ b-flow continuing", "info");
          break;
        }
        case "status": {
          const projection = actor?.getSnapshot().context.projection ?? readProjection(projectRoot);
          if (!projection) {
            ctx.ui.notify("No active b-flow session. Run /b-flow start <goal>", "info");
            return;
          }
          const completed = projection.queue.filter((q) => q.status === "completed").length;
          const total = projection.queue.length;
          const mode = getMode();
          const lines: string[] = [
            `**State:** ${projection.currentState}`,
            `**Goal:** ${projection.goal}`,
            `**Mode:** ${mode.mode}`,
            `**Queue:** ${completed}/${total} completed`,
          ];

          // Active chunk details
          if (projection.active) {
            const active = projection.active;
            const activeChunk = projection.queue.find((q) => q.id === active.chunkId);
            lines.push(
              `**Active chunk:** ${activeChunk ? `[${activeChunk.type}] ${activeChunk.id}` : active.chunkId}`,
              `**Active step:** ${active.step}`,
              `**Iteration:** ${active.iteration}/${active.maxIterations}`,
            );
            if (active.phasePath) {
              lines.push(`**Phase:** ${active.phasePath}`);
            }
            if (active.lastResultFile) {
              lines.push(`**Last result:** ${active.lastResultFile}`);
            }
            if (active.workerPid) {
              lines.push(`**Worker PID:** ${active.workerPid}`);
            }
          }

          // Blocked reason — find first blocked chunk or top-level route action
          const blockedChunk = projection.queue.find((q) => q.status === "blocked");
          if (projection.currentState === "blocked") {
            const reason = blockedChunk?.blockReasonHistory?.at(-1) ?? "Unknown block reason";
            lines.push(`**Blocked:** ${reason}`);
          }

          ctx.ui.notify(lines.join("\n"), "info");
          break;
        }
        case "pause": {
          const projection = actor?.getSnapshot().context.projection ?? readProjection(projectRoot);
          if (projection?.currentState === "executingChunks" && projection.active?.workerPid) {
            ctx.ui.notify(
              "⏸️ b-flow pause is blocked while a worker is active. Wait for the current worker to finish, then pause.",
              "warning",
            );
            break;
          }
          ensureActor().send({ type: "PAUSE" });
          ctx.ui.notify("⏸️ b-flow paused", "info");
          break;
        }
        case "resume": {
          ensureActor().send({ type: "RESUME" });
          ctx.ui.notify("▶️ b-flow resumed", "info");
          break;
        }
        case "jump": {
          const state = parts[1];
          if (!state) {
            ctx.ui.notify("Usage: /b-flow jump <state>", "warning");
            return;
          }
          ctx.ui.notify(`⏭️ b-flow jump to ${state} (not yet implemented)`, "warning");
          break;
        }
        case "stop": {
          const projection = actor?.getSnapshot().context.projection ?? readProjection(projectRoot);
          const killedWorker = killWorkerPid(projection?.active?.workerPid);
          const current = ensureActor();
          current.send({ type: "STOP" });
          persistActor(current);
          clearActor();
          ctx.ui.notify(
            killedWorker
              ? "🛑 b-flow stopped and the active worker was terminated"
              : projection?.active?.workerPid
                ? "🛑 b-flow stopped; active worker could not be terminated, recovery state was preserved"
                : "🛑 b-flow stopped",
            "info",
          );
          break;
        }
        case "mode": {
          const modeArg = parts[1];
          if (modeArg === "guided") {
            setMode({ mode: "guided", skipSafeTransitions: false });
            ctx.ui.notify("📝 b-flow guided mode", "info");
          } else if (modeArg === "autonomous") {
            setMode({ mode: "autonomous", skipSafeTransitions: true });
            ctx.ui.notify("🤖 b-flow autonomous mode", "info");
          } else {
            const m = getMode();
            ctx.ui.notify(`Current mode: ${m.mode}`, "info");
          }
          break;
        }
        default: {
          ctx.ui.notify(
            `Unknown subcommand: ${subcommand}. ` +
              "Try: start, run, continue, status, pause, resume, jump, stop, mode",
            "warning",
          );
        }
      }
    },
  });

  // --- Lifecycle: note active session on startup ---
  // We intentionally do NOT call ensureActor() here because restoring from
  // a persisted snapshot and calling .start() re-invokes the state's invoke
  // actors (e.g. scanContext in "recovering"), which spawns git child
  // processes and can hang. The actor is lazily created on first command.

  api.on("session_start", async (_event, ctx) => {
    projectRoot = ctx.cwd;
  });

  // --- Inject next work item before agent starts (saves discovery tokens) ---

  api.on("before_agent_start", async (event, ctx) => {
    const projection = readProjection(projectRoot);
    if (!projection || projection.currentState === "idle") return;

    // Find next pending or in-progress item
    const nextItem = projection.queue.find(
      (q) => q.status === "in-progress" || q.status === "pending",
    );
    if (!nextItem || !existsSync(nextItem.path)) return;

    // Read just enough to orient the agent
    let snippet: string;
    try {
      const raw = readFileSync(nextItem.path, "utf-8");
      snippet = raw.slice(0, 4000);
    } catch {
      return;
    }

    const completed = projection.queue.filter((q) => q.status === "completed").length;
    const total = projection.queue.length;
    const statusBlock = projection.queue
      .map((q) => {
        const label = q.status === "completed" ? "✓" : q.status === "in-progress" ? "▶" : q.status === "blocked" ? "⚠" : "○";
        return `${label} [${q.type}] ${q.id}`;
      })
      .join("\n");

    const headerLines: string[] = [
      `# Next Work — ${projection.subject ?? "(no subject)"}`,
      `Goal: ${projection.goal}`,
      `State: ${projection.currentState} | Queue: ${completed}/${total} done`,
    ];

    // Active lifecycle details
    if (projection.active) {
      const active = projection.active;
      headerLines.push(
        `Active step: ${active.step} | Iteration: ${active.iteration}/${active.maxIterations}`,
      );
      if (active.phasePath) {
        headerLines.push(`Phase file: ${active.phasePath}`);
      }
      if (active.lastResultFile) {
        headerLines.push(`Last result: ${active.lastResultFile}`);
      }
      const activeChunk = projection.queue.find((q) => q.id === active.chunkId);
      if (activeChunk?.iterations?.length) {
        const lastIter = activeChunk.iterations[activeChunk.iterations.length - 1];
        headerLines.push(`Last iterate: iter ${lastIter.iteration} (${lastIter.status})${lastIter.resultFile ? ` — ${lastIter.resultFile}` : ""}`);
      }
    }

    headerLines.push(
      ``,
      `**Next: \`${basename(nextItem.path)}\` at \`${nextItem.path}\`**`,
    );

    return {
      message: {
        customType: "b-workflow-next",
        content: [
          ...headerLines,
          "",
          "## Queue",
          statusBlock,
          "",
          "## Content",
          snippet,
        ].join("\n"),
        display: false,
      },
    };
  });

  // --- /b-next command (no LLM needed) ---

  api.registerCommand("b-next", {
    description: "Show next work item from b-flow queue",
    handler: async (_args, ctx) => {
      projectRoot = ctx.cwd;
      const projection = actor?.getSnapshot().context.projection ?? readProjection(projectRoot);
      if (!projection || projection.currentState === "idle") {
        ctx.ui.notify("No active b-flow session. Run /b-flow start <goal>", "info");
        return;
      }

      const nextItem = projection.queue.find((q) => q.status === "pending");
      const inProgress = projection.queue.find((q) => q.status === "in-progress");
      const current = inProgress ?? nextItem;

      if (!current) {
        const completed = projection.queue.filter((q) => q.status === "completed").length;
        ctx.ui.notify(`Queue exhausted. ${completed}/${projection.queue.length} done.`, "info");
        return;
      }

      const completed = projection.queue.filter((q) => q.status === "completed").length;
      const total = projection.queue.length;
      const mode = getMode();

      const lines: string[] = [
        `▶️ Next: [${current.type}] ${current.id}`,
        `Subject: ${projection.subject ?? "(none)"}`,
        `Path: ${current.path}`,
        `Queue: ${completed}/${total} done | State: ${projection.currentState} | Mode: ${mode.mode}`,
      ];

      if (projection.active) {
        lines.push(
          `Step: ${projection.active.step} | Iteration: ${projection.active.iteration}/${projection.active.maxIterations}`,
        );
        if (projection.active.lastResultFile) {
          lines.push(`Last result: ${projection.active.lastResultFile}`);
        }
      }

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // --- Compaction hook ---

  api.on("session_before_compact", async (event) => {
    const projection = readProjection(projectRoot);
    if (!projection) return;

    const completed = projection.queue.filter((q) => q.status === "completed").length;
    const blockedChunks = projection.queue.filter((q) => q.status === "blocked");
    let summary =
      `## b-flow State Summary\n` +
      `- Goal: ${projection.goal}\n` +
      `- State: ${projection.currentState}\n` +
      `- Subject: ${projection.subject ?? "none"}\n` +
      `- Queue: ${completed}/${projection.queue.length} completed\n`;

    // Active lifecycle progress
    if (projection.active) {
      const active = projection.active;
      const activeChunk = projection.queue.find((q) => q.id === active.chunkId);
      summary += `\n### Active Lifecycle\n`;
      summary += `- Chunk: ${activeChunk ? `[${activeChunk.type}] ${activeChunk.id}` : active.chunkId}\n`;
      summary += `- Step: ${active.step}\n`;
      summary += `- Iteration: ${active.iteration}/${active.maxIterations}\n`;
      if (active.phasePath) {
        summary += `- Phase file: ${active.phasePath}\n`;
      }
      if (active.lastResultFile) {
        summary += `- Last result: ${active.lastResultFile}\n`;
      }
      if (active.issueFingerprint) {
        summary += `- Issue fingerprint: ${active.issueFingerprint}\n`;
      }
      if (activeChunk?.iterations?.length) {
        const lastIter = activeChunk.iterations[activeChunk.iterations.length - 1];
        summary += `- Last iterate: iter ${lastIter.iteration} (${lastIter.status})${lastIter.resultFile ? ` — ${lastIter.resultFile}` : ""}\n`;
      }
    }

    // Blocked chunks
    if (blockedChunks.length > 0) {
      summary += `\n### Blocked Chunks\n`;
      for (const chunk of blockedChunks) {
        const lastReason = chunk.blockReasonHistory?.at(-1) ?? "Unknown";
        summary += `- [${chunk.type}] ${chunk.id}: ${lastReason}\n`;
      }
    }

    summary += `\n- Last transition: ${projection.history.at(-1)?.to ?? "none"}\n`;
    summary += `- Projection: .context/workflow/orchestration.json`;

    return {
      compaction: {
        summary,
        firstKeptEntryId: event.preparation.firstKeptEntryId,
        tokensBefore: event.preparation.tokensBefore,
      },
    };
  });
}
