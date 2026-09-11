# Sources — z.ai Discount Windows

## 1. GLM-5.3-Flash Usage Campaign

- URL: https://docs.z.ai/devpack/notice/event-glm-5.3-flash
- Type: official vendor docs (primary)
- Accessed: 2026-09-09
- Key quotes:
  - "Campaign period: September 3, 2026 to September 20, 2026."
  - "every day from 23:00 to 09:00 the following day … All times are based on Singapore Time" (UTC+8, applies weekends/holidays).
  - "This campaign applies only to GLM-5.3-Flash. If GLM-5.3 is selected, quota will still be consumed according to the standard rules."
  - Via ZCode: zero quota consumption; "via other supported Agents: Available quota is doubled." (OMP counts as another agent.)
  - "takes effect automatically … no manual activation required"; paid plan users only.

## 2. GLM Coding Plan Overview (off-peak discount)

- URL: https://docs.z.ai/devpack/overview
- Type: official vendor docs (primary)
- Accessed: 2026-09-09
- Key quotes:
  - "During off-peak hours, model usage is charged at 50% of the standard credit rate."
  - "Peak hours: Monday to Friday, 14:00–18:00 Singapore Standard Time (UTC+8)." (Off-peak = the complement.)
  - "By fully utilizing the off-peak discounts, you can save up to 92% compared with pay-as-you-go calls to the GLM-5.3 standard API."
  - Off-peak applies to model usage generally (both GLM-5.3 and GLM-5.3-Flash), per the credit-multiplier table context.
  - Docs index available at https://docs.z.ai/llms.txt (machine-readable; useful for future re-verification of event pages).

## 3. OMP extension runtime (harness docs)

- Source: `omp://extensions.md`, `omp://auth-broker-gateway.md` (OMP 18.1.16 installed)
- Accessed: 2026-09-09
- Key facts:
  - `session_start` event fires with `ctx` (`ExtensionContext`); banner re-evaluation via `ctx.setInterval` (managed timers, contained throws, auto-cleared on `session_shutdown`).
  - `ctx.ui.setWidget(key, string[] | undefined, { placement: "aboveEditor" | "belowEditor" })` — persistent banner; string arrays capped at 10 lines; `undefined` clears. Fire-and-forget in RPC mode; no-op when `ctx.hasUI` is false.
  - `ctx.ui.setStatus(key, text | undefined)` — footer status chip (used by repo's `extensions/tps-tracker.ts`).
  - `ctx.ui.notify(message, "info" | "warning" | "error")` — transient toast; guard with `ctx.hasUI` (repo precedent: `extensions/plan-artifact.ts:249-251`).

## 4. OMP credential storage (local verification)

- Source: `~/.omp/agent/agent.db` (SQLite, read-only), `~/.omp/agent/config.yml`
- Accessed: 2026-09-09
- Key facts:
  - `auth_credentials(provider, credential_type, data, disabled_cause, …)` — this machine has provider `zai`, type `api_key`, `source: "login"`, not disabled.
  - `ModelRegistry.getAvailable()` is the supported cross-runtime detection path and returns models with configured authentication. Upstream Pi also has `getProviderAuthStatus(provider)`, but OMP 18.1.16 does not; the extension must not require it.
  - OAuth coding-plan provider id is `zai-coding-plan` (built-in callback port 9999); API-key provider id is `zai`.
  - Installed npm types (`@mariozechner/pi-coding-agent`) predate the omp runtime: `ExtensionContext` in npm types lacks `ctx.setInterval`/`ctx.models` though omp 18.x docs specify them → feature-detect + cast, warn on drift (repo precedent: plan-artifact's defensive shape scanning).
