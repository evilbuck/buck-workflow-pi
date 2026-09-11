---
status: active
date: 2026-09-09
subject: 2026-09-09.zai-discount-banner
topics: [zai, glm-5.3-flash, discount-banner, omp-extension, campaign, setWidget]
research: [research-zai-discount-banner.md]
iterations: [iterate-zai-discount-banner.md]
memory: [zai-discount-banner-2026-09-09.md]
---

# Plan: z.ai Discount Banner OMP Extension

## User Goal

As a z.ai GLM coding-plan subscriber running OMP, I want the session to surface when a discounted usage window is active (free GLM-5.3-Flash campaign hours; recurring off-peak 50% credits), so I can schedule heavy work when quota is cheapest. *(Confirmed by user 2026-09-09.)*

## Goal

A small Pi/OMP extension, `extensions/zai-discount-banner.ts`, that renders an above-editor banner via `ctx.ui.setWidget` while a GLM-5.3-Flash campaign occurrence (start dates 2026-09-03 → 2026-09-20, daily 23:00–09:00 the following day SGT) is active and the authenticated model registry contains the exact Flash model — and clears it otherwise. Off-peak is computed and tested but renders **no UI** (user decision).

## Context used / assumptions

- **User decisions (this session):** user goal confirmed as drafted; off-peak gets no UI in v1; banner only, no transition toasts.
- **Auth gating (corrected by review iteration):** `modelRegistry.getAvailable()` is the shared Pi/OMP surface and already returns models with configured authentication. Show the banner only when it contains exact provider `zai` or `zai-coding-plan` plus exact model id `glm-5.3-flash`; OMP 18.1.16 does not implement upstream Pi's `getProviderAuthStatus()`.
- **Artifacts:** `research-zai-discount-banner.md` + `research/notes-zai-discount-windows.md` + `research/sources-zai-discount-windows.md` (official z.ai windows; OMP 18.1.16 runtime APIs verified against installed types; detection via `ctx.modelRegistry`; rendering via `setWidget`/`setStatus`/`notify`).
- **Code precedents:** wiring via `wire(pi)` called from `extensions/index.ts` (extensions/index.ts:318-328); `ctx.hasUI` guards + `ctx.ui.setStatus` with theme (extensions/tps-tracker.ts:25-27); defensive runtime-shape feature-detection (plan-artifact manifest precedent, research §3).
- **Time math:** SGT is fixed UTC+8. For the wrapping 23:00–09:00 window, the occurrence start date must be within [2026-09-03, 2026-09-20] inclusive; the early-morning half belongs to the previous SGT date. The final occurrence therefore ends at 09:00 SGT on 2026-09-21. Off-peak ⇔ NOT (Mon–Fri AND 14:00 ≤ hour < 18:00), SGT.
- **npm type gap:** installed `@mariozechner/pi-coding-agent` types lack `ctx.setInterval` — feature-detect and fall back to event-only refresh.
- **Assumption:** extension runs under both Pi and OMP (shared `extensions/index.ts`); on runtimes without `modelRegistry.getAvailable()` it stays silent rather than guessing.

## Scope

- New `extensions/zai-discount-banner.ts`: window data table (campaign entry + off-peak schedule constant), pure SGT/window helpers, detection helpers, widget-line builder, `wire(pi)` lifecycle.
- Re-evaluation: immediately on `session_start`; every 60s via feature-detected managed `ctx.setInterval`; fallback to `session_start` + `turn_end` refresh when `setInterval` is absent or registration throws.
- Banner widget: 2–3 lines, `placement: "aboveEditor"`, includes the last campaign-window start date so expiry is explicit; `setWidget(key, undefined)` clears when inactive.
- Colocated vitest suite `extensions/zai-discount-banner.test.ts` for all pure logic and gating decisions.
- Wiring: two lines in `extensions/index.ts`.

## Out of scope

- Off-peak UI in any form (footer chip, countdown) — documented schedule only; a `setStatus` chip is a possible follow-up if wanted.
- Open/close transition toasts and 30-min heads-up notifications (user declined).
- Auto-refresh/scraping of z.ai promo data — hand-maintained window table only.
- Pi-native (non-OMP) provider detection beyond defensive feature-detection.
- Changes to the unrelated uncommitted installer work currently in the working tree (see Risks).

## Affected files

- `extensions/zai-discount-banner.ts` — **new**
- `extensions/zai-discount-banner.test.ts` — **new**
- `extensions/index.ts` — import + one `wire` call

## Implementation steps

1. Create `extensions/zai-discount-banner.ts` with:
   - `DiscountWindow` table: `CAMPAIGN_WINDOWS` (Flash campaign: exact model `glm-5.3-flash`, occurrence start dates 2026-09-03..2026-09-20 SGT inclusive, daily 23:00–09:00 wrapping midnight) and `OFF_PEAK` schedule constant (peak = Mon–Fri 14:00–18:00 SGT).
   - Pure helpers taking an explicit `Date`: `sgtParts(now)` → `{ date, hour, weekday }` via UTC+8 offset math; `isCampaignActive(now, window)`; `isOffPeak(now)`; widget-line builder `bannerLines(window)`.
   - Detection helper: `hasFlashModel(modelRegistry)` calls the shared `getAvailable()` surface and matches only authenticated `zai`/`zai-coding-plan` + exact `glm-5.3-flash`; it returns `false` (not throw) on shape drift.
2. Add `wire(pi)`: on `session_start`, `evaluate(ctx)` → if a campaign occurrence is active **and** an authenticated exact Flash model is available and `ctx.hasUI`, call `ctx.ui.setWidget(KEY, bannerLines(...), { placement: "aboveEditor" })` inside try/catch; otherwise clear with `setWidget(KEY, undefined)`. Install the 60s re-evaluation via feature-detected `ctx.setInterval`; when absent or registration throws, register one `turn_end` fallback. Never allow an evaluate error to propagate into the session.
3. Wire into `extensions/index.ts` following the existing `wireX(pi)` pattern.
4. Add `extensions/zai-discount-banner.test.ts` covering:
   - SGT conversion at fixed UTC instants (including the UTC+8 date-line crossing and both midnight-wrap sides of 23:00→09:00).
   - Campaign boundaries: 23:00 active / 08:59 active / 09:00 inactive; first start date Sep 3 at 23:00; final Sep 20 occurrence remains active through Sep 21 08:59; Sep 3 early morning and Sep 21 09:00 inactive.
   - Off-peak: peak-block edges (Mon–Fri 14:00 in-peak, 18:00 off-peak), weekends fully off-peak.
   - Gating: widget shown / cleared across authenticated exact-Flash availability × window-active combinations; standard GLM-5.3 rejected; graceful `false` when `modelRegistry` or `getAvailable()` is missing.
5. Run the suite and the deterministic checks (vitest; guardrails at a coherent point). Optional manual smoke: an OMP session during an active occurrence shows the banner; a scratch-clock smoke confirms clearing at 09:00 SGT after the final occurrence.

## Acceptance criteria

- [ ] Banner renders only when: campaign occurrence active (SGT) AND `getAvailable()` contains exact provider `zai`/`zai-coding-plan` with exact model `glm-5.3-flash`; shows the last occurrence start date.
- [ ] Widget is cleared (not left stale) the moment any condition stops holding, including at 09:00 SGT after the final September 20 occurrence.
- [ ] Off-peak produces no UI; its predicate exists and is unit-tested as the future-chip seam.
- [ ] No transition toasts.
- [ ] Extension never breaks a session: all registry/UI access feature-detected, guarded, and error-contained; missing `ctx.setInterval` degrades to event-driven refresh.
- [ ] `vitest run` passes; patch coverage stays ≥90%; no new complexity-baseline entries.

## Verification

- `npx vitest run extensions/zai-discount-banner.test.ts` for the new suite, then full `npx vitest run`.
- `/b-guardrails-check` at the coherent post-implementation point (durable contract v2 in `guardrails.json`).
- Manual OMP smoke during an active window is time-gated and optional; tests own the boundaries.

## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:
1. Run `/b-build` against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues**, route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this plan. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and review artifacts.
5. Run `/b-commit` to checkpoint durable state — stage **only** this subject's files (see Risks).
6. If interrupted before completion, leave a clear note in memory and resume from this plan next turn.

## Risks

- **Mixed working tree:** branch `feat/zai-sale-flag` carries uncommitted, unrelated installer changes (ZCode harness support in `scripts/install.mjs`, `scripts/install.test.mjs`, `agent-install_instructions.md`). This plan must not touch them; at `/b-commit` time stage only the banner files, or land the installer work as its own commit first.
- **Data staleness:** the table's last occurrence starts 2026-09-20 and self-expires at 09:00 SGT the following day; the next campaign requires a hand edit to `CAMPAIGN_WINDOWS` (accepted; no API exists).
- **Runtime shape drift:** npm types lag the OMP runtime for `setInterval`; `getAvailable()` is shared by both runtimes. Feature-detection degrades gracefully, but a future runtime rename could silence the banner — acceptable for a time-boxed campaign tool; drift logging kept minimal.
- **Time-boxed value:** if the build slips past the final occurrence ending 2026-09-21 at 09:00 SGT, the deliverable reduces to the tested window engine + off-peak seam for the next campaign.
