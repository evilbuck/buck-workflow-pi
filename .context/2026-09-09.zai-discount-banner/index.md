---
status: completed
date: 2026-09-09
subject: 2026-09-09.zai-discount-banner
---

# z.ai Discount Banner — Subject Index

Research for an OMP extension that shows a banner when the authenticated z.ai provider has an active GLM-5.3 / GLM-5.3-Flash discount window.

## Artifacts

- [plan-zai-discount-banner.md](plan-zai-discount-banner.md) — `completed` — implementation plan (banner-only v1; no off-peak UI, no toasts)
- [iterate-zai-discount-banner.md](iterate-zai-discount-banner.md) — `completed` — review fixes for OMP auth compatibility, occurrence bounds, exact model gating, timer fallback, and typed tests
- [../memory/zai-discount-banner-2026-09-09.md](../memory/zai-discount-banner-2026-09-09.md) — `completed` — second review passed via PR #22 (2026-09-11)
- [research-zai-discount-banner.md](research-zai-discount-banner.md) — `completed` — canonical summary: windows, detection, rendering, recommendations
- [research/notes-zai-discount-windows.md](research/notes-zai-discount-windows.md) — rolling notes (z.ai sources)
- [research/sources-zai-discount-windows.md](research/sources-zai-discount-windows.md) — source captures incl. OMP runtime APIs

## Key numbers

- Flash campaign: occurrence start dates 2026-09-03 → 2026-09-20, daily 23:00–09:00 the following day SGT (Flash only)
- Off-peak 50%: everything outside Mon–Fri 14:00–18:00 SGT (both models)
- Detection: authenticated exact `zai`/`zai-coding-plan` + `glm-5.3-flash` from `ctx.modelRegistry.getAvailable()`; rendering: `ctx.ui.setWidget`
