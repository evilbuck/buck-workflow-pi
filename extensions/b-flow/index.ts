import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createActor } from "xstate";
import { createBuckMachine } from "./machine.js";
import { readProjection } from "./persistence.js";
import type { BuckActor } from "./machine.js";
import { confirmTransition } from "./ui.js";

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
  let projectRoot = "";

  function ensureActor(): BuckActor {
    if (!actor) {
      actor = createActor(createBuckMachine(projectRoot));
      actor.start();
    }
    return actor;
  }

  // --- Commands ---

  api.registerCommand("b-flow", {
    description: "Buck workflow orchestration — /b-flow <subcommand>",
    handler: async (args: string, ctx) => {
      projectRoot = ctx.cwd;
      const parts = args.trim().split(/\s+/).filter(Boolean);
      const subcommand = parts[0] ?? "status";

      switch (subcommand) {
        case "start": {
          const goal = parts.slice(1).join(" ") || "Untitled goal";
          ensureActor().send({ type: "START", goal });
          ctx.ui.notify(`🚀 b-flow started: "${goal}"`, "info");
          break;
        }
        case "run": {
          const autonomous = parts.includes("--autonomous");
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
          ensureActor().send({ type: "RESUME" });
          ensureActor().send({ type: "CONTINUE" });
          ctx.ui.notify("▶️ b-flow continuing", "info");
          break;
        }
        case "status": {
          const projection = readProjection(projectRoot);
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
          ensureActor().send({ type: "STOP" });
          actor = null;
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

  // --- Lifecycle: restore on session start if snapshot exists ---

  api.on("session_start", async (_event, ctx) => {
    projectRoot = ctx.cwd;

    // Auto-restore non-terminal sessions
    const projection = readProjection(projectRoot);
    if (projection && projection.currentState !== "idle" && projection.currentState !== "done" && projection.currentState !== "aborted") {
      actor = createActor(createBuckMachine(projectRoot));
      actor.start();
    }
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
