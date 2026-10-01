---
date: 2026-09-30
domains: [frontend, guides]
topics: [theme-switcher, htmx, tailwindcss, site, state-machine-guide, dark-mode]
related: [state-machine-user-guide-2026-09-30.md, state-machine-api-guide-2026-09-30.md]
priority: medium
status: completed
subject: 2026-09-30.state-machine-user-guide
artifacts: [site/guides/state-machine.html, site/guides/partials/toggle-to-light.html, site/guides/partials/toggle-to-dark.html]
---

# Guide theme switcher (htmx + Tailwind)

Added a light/dark switcher to `site/guides/state-machine.html` using htmx 2.0.4 and the Tailwind v4 browser runtime (`@tailwindcss/browser@4.2.4`, pinned per the tailwind skill).

## What changed

- All previously hard-coded colors in the page CSS became variables with dark defaults in `:root` plus a `:root[data-theme="light"]` override block; dark rendering is byte-identical (same values, now variables).
- Theme init is an inline `<head>` script: stored `guide-theme` from localStorage wins, else `prefers-color-scheme: light`, else dark. It sets `data-theme` before first paint (no FOUC).
- The topbar toggle is a `<button id="theme-toggle">` styled with Tailwind utilities (var-driven arbitrary values like `bg-[var(--copy-bg)]`; `text-xs!`/`font-medium!` need the `!` modifier because unlayered `button { font: inherit }` beats layered utilities otherwise).
- Clicking fetches a static fragment (`partials/toggle-to-light.html` / `toggle-to-dark.html`) with `hx-swap="outerHTML"`; the fragment is the opposite-state button (correct label/icon/next-target).
- A delegated `htmx:afterRequest` listener on `document.body` reads `data-apply-theme` from `evt.detail.requestConfig.elt` and calls `window.__applyTheme(theme)` (sets `data-theme` + persists). On load, if the theme is light, `htmx.ajax` syncs the button to the dark-variant fragment.

## Gotchas learned

- **`hx-on` on a swapped-out element never fires.** htmx cleans up the triggering element's listeners when `outerHTML` swaps it, so `hx-on::after-request` on the button is dead. A delegated `htmx:afterRequest` listener reading `requestConfig.elt`'s dataset is the reliable pattern.
- **Tailwind v4 layers:** preflight lives in `@layer base`, so the page's unlayered CSS wins everywhere EXCEPT properties the page never set and relied on UA defaults for. Two compensations were needed: `a { text-decoration: underline }` and explicit `article ul { list-style: disc }` / `article ol { list-style: decimal }`.
- htmx/Tailwind are CDN scripts; if unreachable the toggle is inert but the page stays fully readable (no-JS contract preserved).

## Verification

Chrome DevTools against `site:serve` (port 4321), isolated context: prefers-light init; click → dark+persist; click → light+persist; stored-light reload syncs button via `htmx.ajax`; computed styles prove Tailwind applied (12px/500 on button, var backgrounds); list markers + link underline intact; zero console messages; dark/light/code-block/mobile-390px screenshots all correct. Final `npm run guardrails:check`: pass (durable contract v2; lint/functional disabled by contract).
