import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createActor } from "xstate";
import { createBuckMachine } from "./machine.js";
import { readProjection, readSnapshot, writeProjection, writeSnapshot } from "./persistence.js";
import type { BuckActor } from "./machine.js";
import { confirmTransition, isRiskyState } from "./ui.js";
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

  function persistActor(current: BuckActor): void {
    try {
      const snapshot = current.getSnapshot();
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
          const mode = getMode();
          // In guided mode, ask for confirmation before running
          if (!autonomous && mode.mode === "guided") {
            const machine = ensureActor();
            const currentState = machine.getSnapshot().value as string;
            if (isRiskyState(currentState as any)) {
              const confirmed = await ctx.ui.confirm(
                "b-flow run",
                `b-flow is currently in **${currentState}** state.\n\n` +
                  "Running will execute queued chunks automatically.\n\n" +
                  "Continue?",
              );
              if (!confirmed) {
                ctx.ui.notify("⏹️ b-flow run cancelled", "info");
                break;
              }
            }
          }
          if (autonomous) {
            setMode({ mode: "autonomous", skipSafeTransitions: true });
            ctx.ui.notify("🤖 b-flow autonomous mode enabled", "info");
          }
          ensureActor().send({ type: "RESUME" });
          ensureActor().send({ type: "CONTINUE" });
          ctx.ui.notify("▶️ b-flow running", "info");
          break;
        }
        case "continue": {
          const machine = ensureActor();
          const currentState = machine.getSnapshot().value as string;
          const mode = getMode();
          // In guided mode, ask for confirmation if in a risky state
          if (mode.mode === "guided" && isRiskyState(currentState as any)) {
            const confirmed = await ctx.ui.confirm(
              "b-flow confirmation",
              `b-flow is currently in **${currentState}** state.\n\n` +
                "This state may involve executing workers or making changes.\n\n" +
                "Continue?",
            );
            if (!confirmed) {
              ctx.ui.notify("⏹️ b-flow continue cancelled", "info");
              break;
            }
          }
          machine.send({ type: "RESUME" });
          machine.send({ type: "CONTINUE" });
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
          ctx.ui.notify(
            `b-flow: ${projection.currentState} | ` +
              `Goal: ${projection.goal} | ` +
              `Queue: ${completed}/${projection.queue.length}`,
            "info",
          );
          break;
        }
        case "pause": {
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
          const current = ensureActor();
          current.send({ type: "STOP" });
          persistActor(current);
          clearActor();
          ctx.ui.notify("🛑 b-flow stopped", "info");
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

    return {
      message: {
        customType: "b-workflow-next",
        content: [
          `# Next Work — ${projection.subject ?? "(no subject)"}`,`Goal: ${projection.goal}`,
          `State: ${projection.currentState} | Queue: ${completed}/${total} done`,
          `**Next: \`${basename(nextItem.path)}\` at \`${nextItem.path}\`**`,
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

      ctx.ui.notify(
        `▶️ Next: [${current.type}] ${current.id}\n` +
        `Subject: ${projection.subject ?? "(none)"}\n` +
        `Path: ${current.path}\n` +
        `Queue: ${completed}/${total} done | State: ${projection.currentState}`,
        "info",
      );
    },
  });

  // --- Compaction hook ---

  api.on("session_before_compact", async (event) => {
    const projection = readProjection(projectRoot);
    if (!projection) return;

    const completed = projection.queue.filter((q) => q.status === "completed").length;
    const summary =
      `## b-flow State Summary\n` +
      `- Goal: ${projection.goal}\n` +
      `- State: ${projection.currentState}\n` +
      `- Subject: ${projection.subject ?? "none"}\n` +
      `- Queue: ${completed}/${projection.queue.length} completed\n` +
      `- Last transition: ${projection.history.at(-1)?.to ?? "none"}\n` +
      `- Projection: .context/workflow/orchestration.json`;

    return {
      compaction: {
        summary,
        firstKeptEntryId: event.preparation.firstKeptEntryId,
        tokensBefore: event.preparation.tokensBefore,
      },
    };
  });
}
