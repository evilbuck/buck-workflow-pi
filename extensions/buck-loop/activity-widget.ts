import { Loader, type TUI } from "@mariozechner/pi-tui";
import type { ContextUsage, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { ActivityEvent } from "../extension-activity.js";
import type { Snapshot } from "./types.js";
import { renderActivityView, type ActivityView, type Profile, type Visit } from "./activity-view.js";
import { addUsage, projectActivitySnapshot, reportedUsage } from "./activity-snapshot.js";
import { rankChoices } from "./choice-ranking.js";

const KEY = "buck-loop:activity-window";
export type ActivityCardUI = Partial<Pick<ExtensionContext["ui"], "setWidget">> & Pick<ExtensionContext["ui"], "notify">;
export interface ActivityCard {
  setProfile(profile: Profile): void;
  snapshot(snapshot: Snapshot): void;
  session(event: unknown, model: string): void;
  context(usage: ContextUsage | undefined): void;
  ingest(event: ActivityEvent): void;
  decision(snapshot: Snapshot): Promise<void>;
  phase(label: string): void;
  succeed(label: string): void;
  fail(label: string): void;
  dispose(): void;
}

function sessionMetadata(event: unknown): { type?: unknown; skill?: unknown } {
  return typeof event === "object" && event !== null ? event : {};
}

export function createActivityCard(ui: ActivityCardUI, profile: Profile): ActivityCard {
  const visits: Visit[] = [];
  const activity: string[] = [];
  let view: ActivityView = { state: "resolving", attempt: 1, iteration: 0, visits, activity, choices: [] };
  let disposed = false;
  let repaint = (): void => {};
  let stopLoader = (): void => {};
  ui.setWidget?.(KEY, (tui: TUI) => {
    const loader = new Loader(tui, text => text, text => text, "", { intervalMs: 80 });
    tui.addChild(loader);
    loader.start();
    let stopped = false;
    stopLoader = () => {
      if (stopped) return;
      stopped = true;
      loader.stop();
      tui.removeChild(loader);
    };
    repaint = () => { if (!disposed) tui.requestRender(); };
    if (disposed) stopLoader();
    return {
      invalidate() {},
      render(width: number) { return disposed ? [] : renderActivityView(view, profile, width, loader.render(4)[1]?.trim() ?? ""); },
      dispose() { disposed = true; stopLoader(); },
    };
  }, { placement: "aboveEditor" });

  let textOpen = false;
  return {
    setProfile(next: Profile) { profile = next; repaint(); },
    snapshot(snapshot: Snapshot) {
      if (disposed) return;
      if (view.state !== snapshot.state) {
        visits.push({ state: view.state, model: view.model, models: view.models, usage: view.usage });
        view = { ...view, skill: undefined, model: undefined, models: undefined, usage: undefined, context: undefined, rankingError: undefined };
      }
      view = projectActivitySnapshot(snapshot, { ...view, visits, previous: visits.at(-1), activity });
      repaint();
    },
    session(event: unknown, model: string) {
      if (disposed) return;
      view.model = model;
      const metadata = sessionMetadata(event);
      if (metadata.type === "session_start") view.context = undefined;
      if (typeof metadata.skill === "string") view.skill = metadata.skill;
      if (!view.models?.includes(model)) view.models = [...(view.models ?? []), model];
      const usage = reportedUsage(event);
      if (usage) addUsage(view, usage);
      repaint();
    },
    context(usage: ContextUsage | undefined) {
      if (disposed) return;
      view.context = usage ? { usedTokens: usage.tokens, contextWindow: usage.contextWindow, percent: usage.percent } : undefined;
      repaint();
    },
    ingest(event: ActivityEvent) {
      if (disposed) return;
      switch (event.kind) {
        case "text":
          if (textOpen) activity[activity.length - 1] += event.delta;
          else activity.push(event.delta);
          textOpen = true;
          break;
        case "toolStart": activity.push(`▸ ${event.tool}${event.target ? ` → ${event.target}` : ""}`); textOpen = false; break;
        case "toolEnd": activity.push(`${event.ok ? "✓" : "✗"} ${event.tool}${event.message ? `: ${event.message}` : ""}`); textOpen = false; break;
        case "retry": activity.push(`↻ retry: ${event.message}`); textOpen = false; break;
        case "complete": activity.push(`${event.ok ? "✓" : "✗"} buck-loop${event.message ? `: ${event.message}` : ""}`); textOpen = false; break;
      }
      repaint();
    },
    async decision(snapshot: Snapshot) {
      if (disposed) return;
      const projection = projectActivitySnapshot(snapshot);
      const ranked = await rankChoices(projection.choices, JSON.stringify(snapshot));
      if (disposed) return;
      view.choices = ranked.choices;
      view.rankingError = ranked.error;
      activity.push(`Jev display ranking: ${Math.round(ranked.durationMs)}ms${ranked.error ? ` · ${ranked.error}` : ""}`);
      textOpen = false;
      repaint();
    },
    phase(label: string) { if (!disposed) { activity.push(label); textOpen = false; repaint(); } },
    succeed(label: string) { ui.notify(`buck-loop: ${label}`, "info"); },
    fail(label: string) { ui.notify(`buck-loop: ${label}`, "warning"); },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopLoader();
      ui.setWidget?.(KEY, undefined, { placement: "aboveEditor" });
    },
  };
}
