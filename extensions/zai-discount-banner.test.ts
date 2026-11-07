import { describe, it, expect, vi, type Mock } from "vitest";
import {
  wire,
  sgtParts,
  isCampaignActive,
  isOffPeak,
  bannerLines,
  hasFlashModel,
  resolveBanner,
  CAMPAIGN_WINDOWS,
  WIDGET_KEY,
} from "./zai-discount-banner.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/** A UTC instant for the given Singapore wall-clock time (SGT = UTC+8, no DST). */
function sgt(year: number, month: number, day: number, hour: number, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute));
}

interface AvailableModel {
  provider: string;
  id: string;
}
type SetWidget = (
  key: string,
  lines: string[] | undefined,
  options?: { placement: "aboveEditor" | "belowEditor" },
) => void;
type SetManagedInterval = (fn: () => void, ms?: number) => number;

interface MockBannerContext {
  hasUI: boolean;
  ui: { setWidget: Mock<SetWidget> };
  modelRegistry: unknown;
  setInterval?: Mock<SetManagedInterval>;
}

const FLASH_MODELS: AvailableModel[] = [{ provider: "zai", id: "glm-5.3-flash" }];

function mockRegistry(models: AvailableModel[] = FLASH_MODELS) {
  return { getAvailable: vi.fn(() => models) };
}

function createMockPi() {
  const handlers = new Map<string, Array<(event: unknown, ctx: unknown) => Promise<void> | void>>();
  const pi = {
    on: vi.fn((event: string, handler: (event: unknown, ctx: unknown) => Promise<void> | void) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    }),
  } as unknown as ExtensionAPI;
  return { pi, handlers };
}

function createMockCtx(
  opts: {
    hasUI?: boolean;
    registry?: unknown;
    managedInterval?: boolean;
    intervalThrows?: boolean;
  } = {},
) {
  let intervalFn: (() => void) | null = null;
  const setWidget = vi.fn<SetWidget>();
  const setInterval = vi.fn<SetManagedInterval>((fn: () => void) => {
    if (opts.intervalThrows) throw new Error("timer unavailable");
    intervalFn = fn;
    return 1;
  });
  const ctx: MockBannerContext = {
    hasUI: opts.hasUI ?? true,
    ui: { setWidget },
    modelRegistry: opts.registry ?? mockRegistry(),
  };
  if (opts.managedInterval !== false) ctx.setInterval = setInterval;
  return {
    ctx,
    setWidget,
    setInterval,
    fireInterval: () => intervalFn?.(),
  };
}

async function fire(handlers: Map<string, Array<(event: unknown, ctx: unknown) => Promise<void> | void>>, event: string, ctx: unknown) {
  for (const handler of handlers.get(event) ?? []) {
    await handler({ type: event }, ctx);
  }
}

describe("CAMPAIGN_WINDOWS data table", () => {
  it("pins the GLM-5.3-Flash campaign from the official z.ai notice", () => {
    expect(CAMPAIGN_WINDOWS).toHaveLength(1);
    expect(CAMPAIGN_WINDOWS[0]).toMatchObject({
      model: "GLM-5.3-Flash",
      startDate: "2026-09-03",
      endDate: "2026-09-20",
      startHour: 23,
      endHour: 9,
    });
  });
});

describe("sgtParts", () => {
  it("converts a UTC instant to the Singapore wall clock", () => {
    expect(sgtParts(sgt(2026, 9, 10, 1))).toEqual({ date: "2026-09-10", hour: 1, weekday: 4 });
    expect(sgtParts(sgt(2026, 9, 9, 23, 59))).toEqual({ date: "2026-09-09", hour: 23, weekday: 3 });
  });

  it("crosses the date line at SGT midnight", () => {
    expect(sgtParts(sgt(2026, 9, 9, 23))).toEqual({ date: "2026-09-09", hour: 23, weekday: 3 });
    expect(sgtParts(new Date(Date.UTC(2026, 8, 9, 16, 0)))).toEqual({ date: "2026-09-10", hour: 0, weekday: 4 });
  });
});

describe("isCampaignActive", () => {
  const campaign = CAMPAIGN_WINDOWS[0];

  it("is active inside the daily 23:00–09:00 window", () => {
    expect(isCampaignActive(sgt(2026, 9, 9, 23), campaign)).toBe(true);
    expect(isCampaignActive(sgt(2026, 9, 10, 8, 59), campaign)).toBe(true);
    expect(isCampaignActive(sgt(2026, 9, 10, 1), campaign)).toBe(true);
  });

  it("is inactive outside the daily window", () => {
    expect(isCampaignActive(sgt(2026, 9, 9, 22, 59), campaign)).toBe(false);
    expect(isCampaignActive(sgt(2026, 9, 10, 9), campaign)).toBe(false);
    expect(isCampaignActive(sgt(2026, 9, 10, 12), campaign)).toBe(false);
  });

  it("uses each wrapping occurrence's start date for inclusive campaign bounds", () => {
    expect(isCampaignActive(sgt(2026, 9, 3, 23), campaign)).toBe(true);
    expect(isCampaignActive(sgt(2026, 9, 20, 23, 30), campaign)).toBe(true);
    expect(isCampaignActive(sgt(2026, 9, 21, 8, 59), campaign)).toBe(true);
  });

  it("is inactive before the first occurrence and after the final occurrence", () => {
    expect(isCampaignActive(sgt(2026, 9, 2, 23, 30), campaign)).toBe(false);
    expect(isCampaignActive(sgt(2026, 9, 3, 1), campaign)).toBe(false);
    expect(isCampaignActive(sgt(2026, 9, 21, 9), campaign)).toBe(false);
  });
});

describe("isOffPeak", () => {
  it("is off-peak outside Mon–Fri 14:00–18:00 SGT", () => {
    expect(isOffPeak(sgt(2026, 9, 9, 13, 59))).toBe(true);
    expect(isOffPeak(sgt(2026, 9, 9, 18))).toBe(true);
    expect(isOffPeak(sgt(2026, 9, 9, 2))).toBe(true);
  });

  it("is peak during weekday afternoons", () => {
    expect(isOffPeak(sgt(2026, 9, 9, 14))).toBe(false);
    expect(isOffPeak(sgt(2026, 9, 9, 17, 59))).toBe(false);
    expect(isOffPeak(sgt(2026, 9, 11, 15))).toBe(false);
  });

  it("is always off-peak on weekends", () => {
    expect(isOffPeak(sgt(2026, 9, 12, 15))).toBe(true);
    expect(isOffPeak(sgt(2026, 9, 13, 15))).toBe(true);
  });
});

describe("bannerLines", () => {
  it("shows the model, benefit, schedule, and self-expiring end date", () => {
    const lines = bannerLines(CAMPAIGN_WINDOWS[0]);
    expect(lines.length).toBeLessThanOrEqual(10);
    const joined = lines.join("\n");
    expect(joined).toContain("GLM-5.3-Flash");
    expect(joined).toContain("2026-09-20");
    expect(joined).toContain("SGT");
  });
});

describe("hasFlashModel", () => {
  it("matches the exact Flash model on both supported z.ai providers", () => {
    expect(hasFlashModel(mockRegistry([{ provider: "zai", id: "glm-5.3-flash" }]))).toBe(true);
    expect(hasFlashModel(mockRegistry([{ provider: "zai-coding-plan", id: "GLM-5.3-Flash" }]))).toBe(true);
  });

  it("rejects the standard model, other model families, and other providers", () => {
    expect(hasFlashModel(mockRegistry([{ provider: "zai", id: "glm-5.3" }]))).toBe(false);
    expect(hasFlashModel(mockRegistry([{ provider: "zai", id: "glm-4.7-flash" }]))).toBe(false);
    expect(hasFlashModel(mockRegistry([{ provider: "zai-proxy", id: "glm-5.3-flash" }]))).toBe(false);
    expect(hasFlashModel(mockRegistry([{ provider: "anthropic", id: "glm-5.3-flash" }]))).toBe(false);
    expect(hasFlashModel(mockRegistry([]))).toBe(false);
  });

  it("returns false on shape drift instead of throwing", () => {
    expect(hasFlashModel(undefined)).toBe(false);
    expect(hasFlashModel({})).toBe(false);
    expect(hasFlashModel({ getAvailable: () => { throw new Error("boom"); } })).toBe(false);
  });
});

describe("resolveBanner", () => {
  it("uses OMP-shaped authenticated model availability without a provider-status method", () => {
    const lines = resolveBanner(sgt(2026, 9, 10, 1), mockRegistry());
    expect(lines).not.toBeNull();
    expect(lines!.join("\n")).toContain("GLM-5.3-Flash");
  });

  it("returns null outside the campaign window", () => {
    expect(resolveBanner(sgt(2026, 9, 10, 12), mockRegistry())).toBeNull();
    expect(resolveBanner(sgt(2026, 9, 21, 9), mockRegistry())).toBeNull();
  });

  it("returns null without an authenticated exact Flash model", () => {
    expect(resolveBanner(sgt(2026, 9, 10, 1), mockRegistry([]))).toBeNull();
    expect(resolveBanner(sgt(2026, 9, 10, 1), mockRegistry([{ provider: "zai", id: "glm-5.3" }]))).toBeNull();
  });
});

describe("wire", () => {
  const ACTIVE = sgt(2026, 9, 10, 1);
  const AFTER_END = sgt(2026, 9, 21, 9);

  it("shows the banner above the editor on session_start when conditions hold", async () => {
    const { pi, handlers } = createMockPi();
    const { ctx, setWidget } = createMockCtx();
    wire(pi, { now: () => ACTIVE });
    await fire(handlers, "session_start", ctx);
    expect(setWidget).toHaveBeenCalledTimes(1);
    const [key, lines, opts] = setWidget.mock.calls[0];
    expect(key).toBe(WIDGET_KEY);
    expect(lines?.join("\n")).toContain("2026-09-20");
    expect(opts).toEqual({ placement: "aboveEditor" });
  });

  it("clears the widget when the window is inactive", async () => {
    const { pi, handlers } = createMockPi();
    const { ctx, setWidget } = createMockCtx();
    wire(pi, { now: () => AFTER_END });
    await fire(handlers, "session_start", ctx);
    expect(setWidget).toHaveBeenCalledWith(WIDGET_KEY, undefined);
  });

  it("clears the widget when no authenticated Flash model is available", async () => {
    const { pi, handlers } = createMockPi();
    const { ctx, setWidget } = createMockCtx({ registry: mockRegistry([]) });
    wire(pi, { now: () => ACTIVE });
    await fire(handlers, "session_start", ctx);
    expect(setWidget).toHaveBeenCalledWith(WIDGET_KEY, undefined);
  });

  it("does not touch the widget without a UI", async () => {
    const { pi, handlers } = createMockPi();
    const { ctx, setWidget } = createMockCtx({ hasUI: false });
    wire(pi, { now: () => ACTIVE });
    await fire(handlers, "session_start", ctx);
    expect(setWidget).not.toHaveBeenCalled();
  });

  it("re-evaluates every 60s via the managed interval and clears after the end date", async () => {
    let current = ACTIVE;
    const { pi, handlers } = createMockPi();
    const { ctx, setWidget, setInterval, fireInterval } = createMockCtx();
    wire(pi, { now: () => current });
    await fire(handlers, "session_start", ctx);
    expect(setInterval).toHaveBeenCalledTimes(1);
    expect(setInterval.mock.calls[0][1]).toBe(60_000);

    current = AFTER_END;
    fireInterval();
    expect(setWidget).toHaveBeenLastCalledWith(WIDGET_KEY, undefined);
  });

  it("falls back to turn_end refresh when ctx.setInterval is absent", async () => {
    let current = ACTIVE;
    const { pi, handlers } = createMockPi();
    const { ctx, setWidget } = createMockCtx({ managedInterval: false });
    wire(pi, { now: () => current });
    await fire(handlers, "session_start", ctx);
    expect(handlers.has("turn_end")).toBe(true);

    current = AFTER_END;
    await fire(handlers, "turn_end", ctx);
    expect(setWidget).toHaveBeenCalledTimes(2);
    expect(setWidget).toHaveBeenLastCalledWith(WIDGET_KEY, undefined);
  });

  it("falls back to turn_end refresh when managed timer registration throws", async () => {
    let current = ACTIVE;
    const { pi, handlers } = createMockPi();
    const { ctx, setWidget } = createMockCtx({ intervalThrows: true });
    wire(pi, { now: () => current });
    await fire(handlers, "session_start", ctx);
    expect(handlers.has("turn_end")).toBe(true);

    current = AFTER_END;
    await fire(handlers, "turn_end", ctx);
    expect(setWidget).toHaveBeenCalledTimes(2);
    expect(setWidget).toHaveBeenLastCalledWith(WIDGET_KEY, undefined);
  });

  it("renders on before_agent_start without a prior session_start (mid-session reload)", async () => {
    const { pi, handlers } = createMockPi();
    const { ctx, setWidget } = createMockCtx();
    wire(pi, { now: () => ACTIVE });
    await fire(handlers, "before_agent_start", ctx);
    expect(setWidget).toHaveBeenCalledTimes(1);
    expect(setWidget.mock.calls[0]?.[1]?.join("\n")).toContain("2026-09-20");
  });

  it("skips redundant setWidget calls while the rendered state is unchanged", async () => {
    const { pi, handlers } = createMockPi();
    const { ctx, setWidget } = createMockCtx();
    wire(pi, { now: () => ACTIVE });
    await fire(handlers, "before_agent_start", ctx);
    await fire(handlers, "before_agent_start", ctx);
    expect(setWidget).toHaveBeenCalledTimes(1);
  });

  it("redraws on the next turn when the window closes mid-session", async () => {
    let current = ACTIVE;
    const { pi, handlers } = createMockPi();
    const { ctx, setWidget } = createMockCtx();
    wire(pi, { now: () => current });
    await fire(handlers, "before_agent_start", ctx);
    current = AFTER_END;
    await fire(handlers, "before_agent_start", ctx);
    expect(setWidget).toHaveBeenCalledTimes(2);
    expect(setWidget).toHaveBeenLastCalledWith(WIDGET_KEY, undefined);
  });

  it("does not register turn_end when the managed interval exists", async () => {
    const { pi, handlers } = createMockPi();
    const { ctx } = createMockCtx();
    wire(pi, { now: () => ACTIVE });
    await fire(handlers, "session_start", ctx);
    expect(handlers.has("turn_end")).toBe(false);
  });

  it("swallows UI errors without breaking the session", async () => {
    const { pi, handlers } = createMockPi();
    const { ctx, setWidget } = createMockCtx();
    setWidget.mockImplementation(() => { throw new Error("no tty"); });
    wire(pi, { now: () => ACTIVE });
    await expect(fire(handlers, "session_start", ctx)).resolves.toBeUndefined();
  });

  it("treats registry shape drift as not-authenticated and stays quiet", async () => {
    const { pi, handlers } = createMockPi();
    const { ctx, setWidget } = createMockCtx({ registry: {} });
    wire(pi, { now: () => ACTIVE });
    await fire(handlers, "session_start", ctx);
    expect(setWidget).toHaveBeenCalledWith(WIDGET_KEY, undefined);
  });
});
