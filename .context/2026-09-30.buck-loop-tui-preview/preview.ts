/** Throwaway native OMP styling gallery. No model calls and no live loop connection. */
import { matchesKey, Key, wrapTextWithAnsi } from "@mariozechner/pi-tui";
import { fixtures, layoutNames, renderPreview, type PreviewTheme } from "./render.js";

type Component = { render(width: number): string[]; invalidate(): void; handleInput?(data: string): void };
type Tui = { requestRender(): void };
type PreviewContext = {
  ui: {
    setWidget(key: string, component: ((tui: Tui, theme: PreviewTheme) => Component) | undefined, options?: { placement: "aboveEditor" }): void;
    custom(factory: (tui: Tui, theme: PreviewTheme, keybindings: unknown, done: () => void) => Component): Promise<void>;
  };
};

async function showPreview(ctx: PreviewContext): Promise<void> {
  let fixture = 0;
  let layout = 0;
  let narrow = false;
  let replay: number | undefined;
  let repaint = (): void => {};
  const key = "buck-loop-styling-preview";
  const stopReplay = (): void => {
    clearInterval(replay);
    replay = undefined;
  };
  ctx.ui.setWidget(key, (_tui, theme) => ({
    invalidate() {},
    render(width) {
      return renderPreview(fixtures[fixture]!, layout, theme, narrow ? Math.min(44, width) : width);
    },
  }), { placement: "aboveEditor" });
  try {
    await ctx.ui.custom((tui, theme, _keybindings, done) => {
      repaint = () => tui.requestRender();
      return {
        invalidate() {},
        render(width) {
          return [
            "",
            ...wrapTextWithAnsi(theme.fg("accent", theme.bold(`STYLING PREVIEW  ${layout + 1} / 3 · ${layoutNames[layout]}  |  ${fixture + 1} / ${fixtures.length} · ${fixtures[fixture]!.name}`)), width),
            ...wrapTextWithAnsi(theme.fg("muted", "1–3 layout · n/b scenario · p replay · w narrow · q close"), width),
            ...wrapTextWithAnsi(theme.fg("muted", `${replay ? "Replay ON" : "Replay paused"} · ${narrow ? "44-column sample" : "terminal width"} · no models or real work`), width),
          ];
        },
        handleInput(data) {
          if (data === "q" || matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
            stopReplay();
            done();
            return;
          }
          if (data === "n" || matchesKey(data, Key.right)) {
            stopReplay();
            fixture = (fixture + 1) % fixtures.length;
          } else if (data === "b" || matchesKey(data, Key.left)) {
            stopReplay();
            fixture = (fixture + fixtures.length - 1) % fixtures.length;
          } else if (["1", "2", "3"].includes(data)) {
            layout = Number(data) - 1;
          } else if (data === "w") {
            narrow = !narrow;
          } else if (data === "p") {
            if (replay !== undefined) stopReplay();
            else replay = setInterval(() => {
              fixture = (fixture + 1) % fixtures.length;
              repaint();
            }, 2400);
          }
          repaint();
        },
      };
    });
  } finally {
    stopReplay();
    ctx.ui.setWidget(key, undefined);
  }
}

export default function previewExtension(pi: {
  registerCommand(name: string, command: { description: string; handler(args: string, ctx: PreviewContext): Promise<void> }): void;
  on(event: "session_start", handler: (event: unknown, ctx: PreviewContext) => void): void;
}): void {
  pi.registerCommand("buck-loop-preview", {
    description: "Fixture-only Buck-loop styling gallery; no live events or model calls",
    handler: async (_args, ctx) => showPreview(ctx),
  });
  pi.on("session_start", (_event, ctx) => {
    // Open after the host finishes its startup event dispatch.
    setTimeout(() => void showPreview(ctx), 0);
  });
}
