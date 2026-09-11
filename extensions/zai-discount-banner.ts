/**
 * z.ai Discount Banner Extension
 *
 * Shows an above-editor banner while a z.ai GLM-5.3-Flash discount campaign
 * window is active (SGT) and the user can actually use a Flash model.
 * Window dates are hand-maintained below — there is no promo API; the banner
 * self-expires via the end date. Off-peak 50% hours (all times outside
 * Mon–Fri 14:00–18:00 SGT) are computed but intentionally render no UI.
 *
 * Sources: docs.z.ai/devpack/notice/event-glm-5.3-flash (2026-09-03 → 2026-09-20,
 * daily 23:00–09:00 SGT, Flash only), docs.z.ai/devpack/overview (off-peak).
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export const WIDGET_KEY = "zai-discount-banner";

export interface CampaignWindow {
  /** Display name, e.g. "Flash campaign". */
  name: string;
  /** Model the campaign applies to, e.g. "GLM-5.3-Flash". */
  model: string;
  /** Inclusive SGT dates on which daily campaign windows begin. */
  startDate: string;
  endDate: string;
  /** Daily window in SGT hours; endHour < startHour wraps midnight. */
  startHour: number;
  endHour: number;
}

export const CAMPAIGN_WINDOWS: CampaignWindow[] = [
  {
    name: "Flash campaign",
    model: "GLM-5.3-Flash",
    startDate: "2026-09-03",
    endDate: "2026-09-20",
    startHour: 23,
    endHour: 9,
  },
];

/** Off-peak 50% credit rate applies to everything outside this recurring peak block. */
export const PEAK_HOURS = { weekdayFrom: 1, weekdayTo: 5, startHour: 14, endHour: 18 };

export interface SgtParts {
  /** SGT calendar date, ISO YYYY-MM-DD. */
  date: string;
  /** SGT hour, 0–23. */
  hour: number;
  /** SGT day of week, 0 = Sunday. */
  weekday: number;
}
const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Convert a UTC instant to the Singapore wall clock (UTC+8, no DST). */
export function sgtParts(now: Date): SgtParts {
  const sgt = new Date(now.getTime() + SGT_OFFSET_MS);
  const date = [
    String(sgt.getUTCFullYear()).padStart(4, "0"),
    String(sgt.getUTCMonth() + 1).padStart(2, "0"),
    String(sgt.getUTCDate()).padStart(2, "0"),
  ].join("-");
  return { date, hour: sgt.getUTCHours(), weekday: sgt.getUTCDay() };
}

export function isCampaignActive(now: Date, window: CampaignWindow): boolean {
  const { date, hour } = sgtParts(now);
  let occurrenceDate = date;

  if (window.startHour > window.endHour) {
    if (hour < window.endHour) {
      occurrenceDate = sgtParts(new Date(now.getTime() - DAY_MS)).date;
    } else if (hour < window.startHour) {
      return false;
    }
  } else if (hour < window.startHour || hour >= window.endHour) {
    return false;
  }

  return occurrenceDate >= window.startDate && occurrenceDate <= window.endDate;
}

export function isOffPeak(now: Date): boolean {
  const { hour, weekday } = sgtParts(now);
  const inPeakBlock =
    weekday >= PEAK_HOURS.weekdayFrom &&
    weekday <= PEAK_HOURS.weekdayTo &&
    hour >= PEAK_HOURS.startHour &&
    hour < PEAK_HOURS.endHour;
  return !inPeakBlock;
}

export function bannerLines(window: CampaignWindow): string[] {
  const hh = (h: number) => String(h).padStart(2, "0");
  return [
    `⚡ z.ai ${window.name}: ${window.model} — 2× quota here, 0 via ZCode`,
    `   Daily ${hh(window.startHour)}:00–${hh(window.endHour)}:00 SGT · final window starts ${window.endDate}`,
  ];
}

/** Minimal shape shared by Pi and OMP. getAvailable() returns authenticated models. */
interface RegistryLike {
  getAvailable?: () => Array<{ provider?: string; id?: string }>;
}

const FLASH_MODEL_ID = /^glm-5\.3-flash$/i;

function isZaiProvider(provider: unknown): provider is string {
  return provider === "zai" || provider === "zai-coding-plan";
}

export function hasFlashModel(modelRegistry: unknown): boolean {
  const registry = modelRegistry as RegistryLike | undefined;
  if (!registry || typeof registry.getAvailable !== "function") return false;
  try {
    return (registry.getAvailable() ?? []).some(
      (model) =>
        typeof model?.id === "string" &&
        FLASH_MODEL_ID.test(model.id) &&
        isZaiProvider(model.provider),
    );
  } catch {
    return false;
  }
}

/** Banner lines when an authenticated campaign model is available; otherwise clear. */
export function resolveBanner(now: Date, modelRegistry: unknown): string[] | null {
  const window = CAMPAIGN_WINDOWS.find((candidate) => isCampaignActive(now, candidate));
  if (!window || !hasFlashModel(modelRegistry)) return null;
  return bannerLines(window);
}

interface BannerContext {
  hasUI?: boolean;
  ui?: { setWidget?: (key: string, lines: string[] | undefined, opts?: { placement: "aboveEditor" | "belowEditor" }) => unknown };
  modelRegistry?: unknown;
  setInterval?: (fn: () => void, ms: number) => unknown;
}

export function wire(pi: ExtensionAPI, deps?: { now?: () => Date }): void {
  const now = deps?.now ?? (() => new Date());
  // Last rendered state (joined lines, or null for cleared) — skip redundant redraws.
  let lastRendered: string | null | undefined;

  const evaluate = (ctx: BannerContext): void => {
    try {
      if (!ctx.hasUI) return;
      const lines = resolveBanner(now(), ctx.modelRegistry);
      const state = lines ? lines.join("\n") : null;
      if (state === lastRendered) return;
      try {
        if (lines) {
          ctx.ui?.setWidget?.(WIDGET_KEY, lines, { placement: "aboveEditor" });
        } else {
          ctx.ui?.setWidget?.(WIDGET_KEY, undefined);
        }
        lastRendered = state;
      } catch {
        // UI is best-effort; retry on the next evaluation tick
      }
    } catch {
      // defensive: resolveBanner already guards, but keep the session safe
    }
  };
  let fallbackRegistered = false;
  const registerEventFallback = (): void => {
    if (fallbackRegistered) return;
    fallbackRegistered = true;
    pi.on("turn_end", async (_turnEvent, turnCtx) => {
      evaluate(turnCtx as BannerContext);
    });
  };

  pi.on("session_start", async (_event, ctx) => {
    evaluate(ctx as BannerContext);
    const managed = ctx as BannerContext;
    if (typeof managed.setInterval !== "function") {
      registerEventFallback();
      return;
    }
    // Note: the interval deliberately captures the session_start ctx; turn_end
    // and before_agent_start re-evaluate with their fresh per-event ctx, which
    // masks a stale session_start ctx during active sessions.
    try {
      managed.setInterval(() => evaluate(ctx as BannerContext), 60_000);
    } catch {
      registerEventFallback();
    }
  });

  // session_start only fires on initial session load — /reload-plugins re-wires
  // extensions mid-session without re-emitting it, so re-evaluate every turn.
  pi.on("before_agent_start", async (_event, ctx) => {
    evaluate(ctx as BannerContext);
  });
}

export default wire;
