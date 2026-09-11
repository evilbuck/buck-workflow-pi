---
status: active
date: 2026-09-09
subject: 2026-09-09.zai-discount-banner
topics: [zai, glm-5.3-flash, discount-banner, omp-extension, off-peak, campaign]
informs: [plan-zai-discount-banner.md]
---

# Research — z.ai Discount Banner for OMP

**Goal:** Show a banner in OMP when the user has an authenticated z.ai provider and a GLM-5.3 / GLM-5.3-Flash discount window is active.

## Findings

### 1. Two distinct discount conditions (official z.ai docs)

| Condition | Models | Schedule (all SGT, UTC+8) | Bounds |
|---|---|---|---|
| **Flash campaign** | GLM-5.3-Flash only | daily 23:00 → 09:00 next day | **2026-09-03 → 2026-09-20**, then gone |
| **Off-peak 50% credits** | both GLM-5.3 + Flash | all times **except** Mon–Fri 14:00–18:00 | recurring, indefinite |

- Campaign: zero quota via ZCode, doubled quota via other agents (OMP qualifies). Automatic for paid plans.
- Off-peak: 50% credit rate; the campaign window is a strict subset of off-peak.
- **Design tension:** off-peak is active ~most of the week — a persistent "off-peak" banner would be near-permanent noise. A subtle footer status chip or nothing is more plausible for off-peak; a banner fits the bounded campaign.

### 2. Detection — "user has authenticated a z.ai provider"

- Credentials live in `~/.omp/agent/agent.db` `auth_credentials(provider, …)`; this machine has provider **`zai`** (api_key, `source: "login"`). OAuth coding-plan provider id would be **`zai-coding-plan`**.
- Supported cross-runtime check: `ctx.modelRegistry.getAvailable()` returns authenticated models; match exact provider `zai`/`zai-coding-plan` and exact id `glm-5.3-flash`. Review correction: upstream Pi exposes `getProviderAuthStatus()`, but OMP 18.1.16 does not.
- Do it in `session_start`; re-check cheaply on re-evaluation ticks.

### 3. Rendering the banner (OMP 18.1.16 runtime)

- `ctx.ui.setWidget(key, string[], { placement: "aboveEditor" })` — persistent banner above the editor; ≤10 lines; `setWidget(key, undefined)` clears. Best fit for "banner".
- `ctx.ui.setStatus(key, styledText)` — footer chip; repo precedent (`extensions/tps-tracker.ts`). Good for off-peak.
- `ctx.ui.notify(...)` guarded by `ctx.hasUI` — repo precedent (`extensions/plan-artifact.ts:249`); good for window-open/close transitions.
- Re-evaluation: `ctx.setInterval` (managed timers per omp docs; contained throws; auto-cleared on shutdown) at 60s cadence. **npm typecheck gap:** installed `@mariozechner/pi-coding-agent` `ExtensionContext` lacks `setInterval`/`models` that the omp 18.x runtime documents → feature-detect `(ctx as { setInterval?: … }).setInterval`, fall back to event-only refresh (`session_start`, `turn_end`), and log/notify on shape drift (plan-artifact manifest precedent).

### 4. Time math

- SGT is fixed UTC+8, no DST: convert with `Intl.DateTimeFormat` `timeZone: "Asia/Singapore"` (or UTC + 8h).
- Campaign active ⇔ the daily occurrence's SGT **start date** is within [2026-09-03, 2026-09-20] AND the current time is in 23:00→09:00. The early-morning half belongs to the previous date, so the final occurrence ends 2026-09-21 at 09:00 SGT.
- Off-peak active ⇔ NOT (Mon–Fri AND 14:00 ≤ hour < 18:00).
- Structure windows as a **data table** (name, model, daily window, occurrence start-date range) — the next campaign can use different dates, and the final start date makes the banner disappear after its following-morning close.

### 5. Data currency (risk)

- No public API for z.ai promotions found; the docs pages are the source of truth. Event dates will go stale. Boring option: hand-maintained event table + expiry; optionally a manual refresh command. Do not scrape docs from the extension.

## Recommendations

1. New small extension (e.g. `extensions/zai-discount-banner.ts` + test), wired in `extensions/index.ts`, following repo conventions (`pi.on("session_start")`, guarded UI calls, defensive runtime-shape handling).
2. Banner (`setWidget`, aboveEditor) only for the **campaign** window, Flash only, and only when `getAvailable()` contains authenticated exact provider `zai`/`zai-coding-plan` + exact model `glm-5.3-flash`; include the last occurrence start date so expiry is explicit.
3. **Off-peak**: footer `setStatus` chip (subtle) rather than a banner — or skip entirely; confirm with user.
4. Optional transition notify at window open/close (single fire per boundary; dedupe via `pi.appendEntry` marker like plan-artifact).
5. 60s managed-interval re-evaluation with feature-detect fallback; all registry/UI calls guarded — never break the session.

## Open questions

1. Should off-peak 50% produce any UI at all (footer chip vs nothing)? Near-permanent otherwise.
2. Is a transition toast ("z.ai campaign window opens in 30 min") wanted, or banner-only?
3. **Resolved in plan:** authenticated availability requires the exact Flash model from `getAvailable()`; a provider credential without that model stays silent.

## Sources

- https://docs.z.ai/devpack/notice/event-glm-5.3-flash (primary, 2026-09-09)
- https://docs.z.ai/devpack/overview (primary, 2026-09-09)
- `omp://extensions.md`, `omp://auth-broker-gateway.md` (OMP 18.1.16)
- Local: `~/.omp/agent/agent.db`, `~/.omp/agent/config.yml`, npm type defs, `extensions/plan-artifact.ts`, `extensions/tps-tracker.ts`

Confidence: high on windows/dates (official docs); high on detection and rendering APIs (verified against installed runtime 18.1.16 and local types); medium on long-term event data currency (no API — hand-maintained table).
