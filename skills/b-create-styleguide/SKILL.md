---
name: b-create-styleguide
description: Guide an inexperienced user through creating a UX styleguide for their project from scratch, idempotently keep it up-to-date on every re-run, or run an analytical component inventory (--inventory-only). Interviews about colors, format, scope, and reverse-engineering. Produces the styleguide (including type, breakpoints/responsive, and interactions — not only components), writes a managed block into AGENTS.md/CLAUDE.md so all agents reference and extend it on any design-surface change, reconciles design-brief.json by component id on refresh, and deprecates rather than deletes missing components.
---

# b-create-styleguide: Guided Styleguide Creation, Maintenance & Component Inventory

Walk a user — even one who has never heard the word "styleguide" — through creating one for their project, maintaining it over time, or running an analytical component inventory of a site/section. The skill explains what a styleguide is in plain terms, interviews the user through key decisions (colors, format, scope, codebase analysis), generates the artifacts, and wires AGENTS.md or CLAUDE.md so every future agent references and maintains it whenever UI design surfaces change — components, fonts/type, breakpoints/responsive behavior, and interactions. **It is also a living keeper: re-running it idempotently reconciles the styleguide with the codebase, adding new components, updating changed ones, and deprecating missing ones.**

**Three modes in one skill:**
1. **Create mode** — first run. Full interview, full generation, full wiring.
2. **Refresh/update mode** — re-run. Re-scan scope, reconcile by component `id`, update in place via managed blocks, deprecate missing components.
3. **Inventory-only mode (`--inventory-only [section]`)** — non-interactive / analytical component inventory of a site or named section without `AGENTS.md` wiring. Produces the markdown component inventory (`docs/ux-style-guide.md`), visual HTML research guide (`docs/ux-research.html`), and machine-readable `docs/ux-design-brief.json` (or user-specified paths).

Run it whenever you ship UI changes, add a component, change type/breakpoints/interactions, change the palette, or want an analytical UX inventory before refactoring.

## Use when

- The user says "I want a styleguide," "let's build a design system," or "make a component reference"
- The user wants to formalize their project's look and feel before or alongside building
- Someone wants agents to stop inventing UI patterns and follow a documented standard
- A project has grown organically and needs visual consistency or a component inventory (`--inventory-only`) going forward
- The user wants a UI design brief or component taxonomy extracted from existing views, screenshots, or design context

## Do not use when

- The user wants to implement components rather than document them (use `b-plan` → `b-build`)
- The user only wants a deterministic OKLCH color palette from a single brand hex (use `b-design-palette`)
- The project has zero UI (CLI-only, API-only with no frontend)

## What a styleguide is (plain-terms explanation the skill uses)

If the user is unfamiliar, explain it like this:

> A styleguide is your project's visual dictionary. It lists every building block of your UI — buttons, inputs, cards, colors, type, spacing, how layouts adapt to screen size, and how things behave on hover/focus/motion — and shows exactly what each one looks like, when to use it, and when not to. It keeps your app looking consistent as it grows, and it gives every developer (human or AI agent) a single reference so nobody invents their own version of a button, type size, or interaction.

## Component taxonomy (the 12-category organizing frame)

Organize every reverse-engineered or inventoried component into these 12 categories. Omit a category only when the target surface genuinely has nothing in it; never invent entries to fill one. Every entry MUST cite **exact file paths** (and class names where relevant).

1. **Surfaces / layouts / shells** — app shells, page compositions, responsive shells, drawers-as-layout
2. **Navigation** — sidebars, topbars, breadcrumbs, tab bars, back links, brand blocks
3. **Buttons & CTAs** — primary, secondary/ghost, icon-only, CTA cards, segmented/filter buttons
4. **Forms & inputs** — every input *type* (text, email, tel, url, color, date, select, checkbox, textarea, file, search), plus form layouts and inline-edit affordances
5. **Cards & panels** — hero cards, KPI/stat cards, content cards, instructional cards, callouts
6. **Tables / lists / data views** — sortable tables, list rows, activity tables, breakdown bars, pagination
7. **Badges / pills / chips / status indicators** — status badges, plan badges, filter pills, swatches, toasts
8. **Feedback states** — loading, empty, error, success, warning/destructive banners, inline no-data
9. **Dialogs / drawers / tabs / disclosure** — modals, off-canvas drawers, tab panels, accordions, dropdowns
10. **Charts / data viz** — chart canvases, bar breakdowns, sparklines, stat visualizations
11. **Responsive / mobile behavior** — breakpoints, column collapses, drawer toggles, hidden-column rules
12. **Duplication & DRY hotspots** — the same component family implemented multiple ways; dead/legacy components

## Procedure

### Phase 0 — Idempotency check, maintenance mode & inventory-only routing

Before asking questions, check the invocation mode and whether a styleguide already exists.

0. **Check for `--inventory-only` (or an analytical inventory-only request)**:
   - If the user passed `--inventory-only [section]` or explicitly asked for an analytical UX inventory / research guide without `AGENTS.md` wiring, jump directly to **Inventory-Only Mode** below.
1. **Detect existing styleguide**: look for the agreed/default paths (`docs/styleguide.html`, `views/styleguide/index.ejs`, `docs/styleguide.md`, `docs/styleguide-design-brief.json`). If any exist, the styleguide has already been created.
2. **Detect existing agent wiring**: search `AGENTS.md` / `CLAUDE.md` for a `<!-- BEGIN b-create-styleguide -->` block. Managed blocks are how the skill keeps its wiring idempotent — see "Managed blocks" below.
3. **Choose mode**:
   - **Create mode** — neither the styleguide files nor the AGENTS managed block exist. Full interview, full generation, full wiring.
   - **Refresh/update mode** — the styleguide and/or the AGENTS block already exist. The user wants maintenance, not recreation. Re-scan scope, reconcile, and update in place.
4. **If only the styleguide files exist but AGENTS wiring is missing**: run Phase 5 to add the managed block.
5. **If only AGENTS wiring exists but the styleguide files are gone**: offer to recreate the styleguide from the codebase (and re-insert the files inside the managed block contract).
6. **If neither exists**: create mode.
7. **If inventory-only deliverables are detected** (`docs/ux-style-guide.md`, `docs/ux-research.html`, or `docs/ux-design-brief.json` from a previous `--inventory-only` run): **offer**, do not auto-act. Surface the detected files and ask the user:
   - **(a) Consume as seed inventory** — use `docs/ux-design-brief.json` as the starting `components` + `tokens`, then run the create-mode interview to choose format/palette/wiring. Skip the reverse-engineer scan.
   - **(b) Reverse-engineer fresh** — ignore existing inventory deliverables, scan the codebase as if starting from scratch.
   - **(c) Refresh inventory first** — re-run `--inventory-only` with a fresh scope, then return.
   This is an offer, never a default. The user must choose.

#### Inventory-Only Mode (`--inventory-only [section]`)

When invoked with `--inventory-only` (or when the user wants a non-interactive / section-scoped analytical UX inventory without `AGENTS.md` wiring):

1. **Resolve scope and outputs**:
   - If a section/area argument is present (e.g. `admin`, `/u`, `checkout`, `marketing landers`), scope the entire inventory to that section only and state it in one sentence. Otherwise use active session context (or ask which surface to inventory if ambiguous).
   - Ask where to write the three deliverables, offering defaults:
     1. **Markdown style guide** — `docs/ux-style-guide.md`
     2. **HTML research guide** — `docs/ux-research.html`
     3. **Design brief JSON** — `docs/ux-design-brief.json`
   - Create `.context/YYYY-MM-DD.<surface>-ux-guide/`, invoke lifecycle `initialize` then `activate`, and keep rolling notes as you scan.
2. **Analyze & Organize**:
   - Scan views/templates, partials/components, CSS/token files, and UI tests (fan out read-only explorer subagents for large surfaces).
   - Group every finding into the 12-category **Component taxonomy** above with exact file paths, concrete variants, and duplication merge targets.
3. **Write the three deliverables**:
   - **Markdown style guide (`docs/ux-style-guide.md`)**: Scope, Files inspected, numbered sections for each populated taxonomy category (`- **<component>** — <variants>. \`path/to/file\``), Duplication & DRY hotspots (naming merge targets), Responsive / mobile behavior, Gaps / unknowns, and Recommended next step.
   - **HTML research guide (`docs/ux-research.html`)**: Self-contained, dark-first, scannable single-file HTML (pure HTML + CSS, Mermaid via CDN only, no JS frameworks). Includes Header (title, scope badge, date, one-liner), Component Taxonomy Map (Mermaid `flowchart` of sub-areas → shared families + per-category cards), Inventory Surface Files table, Duplication Patterns with illustrative snippets, Styling split (if any), Key decisions/scope, Risks/DRY debt cards, and Next steps.
   - **Design brief JSON (`docs/ux-design-brief.json`)**: Valid JSON describing the exact same inventory (`meta`, `tokens`, exhaustive `components[]` with `id`, `category`, `name`, `description`, `whenToUse`, `whenNotToUse`, `anatomy`, `variants`, `states`, `options`, `locations`, `duplication`, `responsive`, `accessibility`, `do`, `dont`, plus `duplications[]` and `gaps[]`).
4. **Closeout**: Verify all three deliverables exist, cite real files, and parse cleanly. Do **not** wire `AGENTS.md` / `CLAUDE.md` in `--inventory-only` mode; recommend running `b-create-styleguide` in full mode when ready to make the guide living and agent-wired.

#### Managed blocks (idempotency contract)

The skill uses HTML-comment bounded blocks in every artifact it manages, so re-runs can locate, update, and preserve its content without overwriting user edits or creating duplicates:

- In `AGENTS.md` / `CLAUDE.md`: `<!-- BEGIN b-create-styleguide -->` … `<!-- END b-create-styleguide -->`
- In the visual guide (HTML or EJS): `<!-- BEGIN b-create-styleguide:styleguide -->` … `<!-- END b-create-styleguide:styleguide -->`
- In the markdown reference: `<!-- BEGIN b-create-styleguide:styleguide -->` … `<!-- END b-create-styleguide:styleguide -->`
- In the JSON spec: `{ "_managed": { "managedBy": "b-create-styleguide", "block": "design-brief" }, "meta": {...}, "components": [...], "duplications": [...], "gaps": [...] }`

On re-run, the skill MUST:
1. **Locate** any existing managed block by its markers before writing.
2. **Update in place** — replace only the block's inner content; leave user edits outside the block untouched.
3. **If a component already exists in `design-brief.json` by `id`**: **merge/preserve** — keep the existing entry, add any new `variants`/`states`/`locations` discovered in re-scan, update `locations` if they changed. Do NOT overwrite the existing description, do/don't, or accessibility notes unless the user explicitly asked to.
4. **If a component existed in the previous design-brief but is no longer found in the codebase**: mark it `status: "deprecated"` in the JSON. Do NOT delete. Surface deprecated components in the visual guide with a "Deprecated" badge.
5. **If a new component is found**: add it to the JSON, the visual guide, and the markdown reference.
6. **If the block markers are missing** (user manually deleted them): re-create the block and add a `<!-- BEGIN -->` `<!-- END -->` pair at the bottom of the file (or in the JSON, as a new `_managed` object). Never silently overwrite the whole file.

#### Refresh/update mode workflow

In refresh/update mode (re-run when the styleguide already exists), skip Phase 2's full interview. Ask only:
- What has changed since last time? (new colors, new components, type/font changes, breakpoint or responsive behavior, interactions/motion/state, new scope, new constraints)
- Should I re-scan the codebase for new components / changed files / foundation tokens?
- Any components to deprecate manually?

Then:
1. **Re-scan the scoped surface** (Phase 3) to discover new/changed components.
2. **Reconcile** against `design-brief.json` by stable `component.id`:
   - For each existing `id` still found in the codebase: update `locations`, append new `variants`/`states` discovered, preserve other fields.
   - For each new component discovered: add a fresh entry to the JSON, visual guide, and markdown reference.
   - For each existing `id` not found in the codebase: set `status: "deprecated"`, add a Deprecated badge to the visual guide, and add a "Removed in codebase" note. Do not delete the entry.
3. **Update foundation surfaces** if they changed — document and demo them in the visual guide (and tokens JSON) in the same refresh:
   - **Fonts / type** — families, ramp, weights, stackable type classes
   - **Screen sizes / responsive** — breakpoints used, mobile-first notes, height/viewport rules
   - **Interactions** — hover/active/focus/disabled/ARIA state, motion, gestures, `prefers-reduced-motion`
4. **Update tokens** if the palette or type/spacing scales changed (add new scales, update values, preserve old values as aliases where possible).
5. **Update the AGENTS.md managed block** in place so the design-surface trigger list stays current (components, type, breakpoints, interactions). Paths and UI-work trigger text MUST match the template in Phase 5. Preserve any user-added notes outside the managed markers; inside the block, keep the mandatory trigger contract complete.
6. **Write a session memory entry** recording the refresh — what was added, deprecated, updated (including foundation surfaces).
7. **Report** a "refresh delta" in the closeout: `<N> added, <N> updated, <N> deprecated, <N> unchanged` plus foundation surfaces touched.

The skill is therefore both a **creator** and a **keeper** — running it regularly is the recommended way to keep the styleguide in sync with the codebase.

### Phase 1 — Explain and scope

1. Explain what a styleguide is (use the plain-terms definition above if the user is unsure).
2. **Ask one question at a time** to gather the inputs below. Offer sensible defaults. Let the user skip anything they don't care about yet.

### Phase 2 — Interview (the key decisions)

Ask these questions in order. Each one has a recommended default. The user can accept, modify, or defer.

| # | Question | Recommended default | Why it matters |
|---|----------|--------------------|----------------|
| 1 | **What surface does this styleguide cover?** (e.g. the whole app, just the admin area, just the user dashboard, just marketing pages) | The user's current working surface or the most active UI area | Defines scope. A small first styleguide is better than an incomplete big one. |
| 2 | **Do you have brand colors or a palette in mind?** If yes, accept any format: hex codes, color names, a screenshot, a CSS file, or a description. | None (start with sensible neutral defaults; user can add later) | Colors are the first thing a styleguide needs. If none provided, derive from existing codebase or use a clean neutral base. |
| 3 | **Should the styleguide reverse-engineer the existing codebase?** (Scan views/components/CSS to find what you already have and document it, vs. start from a blank slate with new canonical components) | **Yes** — reverse-engineer first, then propose cleanups | Saves work; documents reality. Starting from scratch risks a styleguide nobody uses. |
| 4 | **What format should the styleguide be?** Options: (a) Static HTML page (single file, open in browser, self-contained), (b) EJS/route-served page (lives in the app, uses asset pipeline), (c) Markdown only (docs, no visual page), (d) HTML research guide + Markdown inventory (`docs/ux-research.html` + `docs/ux-style-guide.md`) | **(a) Static HTML** for a standalone visual reference; **(b) EJS/route** if they want it living inside the app | Determines the artifact shape. Static HTML is simplest and works anywhere. Route-served integrates with the build. |
| 5 | **Where should the styleguide files live?** (File path for the main artifact) | `docs/styleguide.html` for static, `views/styleguide/index.ejs` for route-served, or `docs/styleguide.md` for markdown-only | Keeps files discoverable. Offer the default; accept alternatives. |
| 6 | **Should we also produce a machine-readable JSON spec** (design-brief.json) so agents can implement components programmatically? | **Yes** — `docs/styleguide-design-brief.json` | Enables agent-driven UI implementation. Low cost to include. |
| 7 | **Any other context or constraints?** (e.g. "use Tailwind," "no gradients," "must be accessible," "dark mode only," "mobile-first") | None | Captures project-specific rules. |

**Ask these one at a time.** If the user answers multiple at once, process them together. If the user says "just use defaults," proceed with all recommended defaults without further questions.

### Phase 3 — Analyze (if reverse-engineer = yes)

If the user chose to reverse-engineer:

1. Scan the scoped surface: views/templates, partials/components, CSS/token files, and any browser/UI tests.
2. Inventory every component using the 12-category **Component taxonomy** above (shells, navigation, buttons, forms, cards, tables, badges, states, dialogs, charts, responsive, duplication).
3. Cite exact file paths and class names. Do not invent.
4. Identify duplication hotspots and dead/legacy components.

If the user chose **not** to reverse-engineer, skip analysis. The styleguide will be built from the user's palette, context, and canonical defaults.

### Phase 4 — Generate the styleguide

Produce the deliverable(s) based on the format decision:

#### Format (a): Static HTML styleguide

Write a single self-contained HTML file at the agreed path. Contents:
- **Header** — project name, scope badge, date
- **Color palette** — swatches with hex values, dark/light variants if provided
- **Typography** — font families, sizes, weights, and any stackable type classes (derived from codebase or defaults). Required section even if sparse.
- **Spacing & radii** — spacing scale, border-radius tokens
- **Breakpoints / responsive** — the viewport (and height, if used) breakpoints the project actually uses, with a short note on mobile-first vs desktop-first and any shell behavior that changes by size. Required section; if the codebase has only ad-hoc media queries, list those values rather than inventing a scale.
- **Interactions / state** — canonical state vocabulary (`:hover`, `:active`, `:focus`, disabled, loading, ARIA), motion patterns, and `prefers-reduced-motion` policy. Live demos where cheap (button states); short notes where not. Required section.
- **Components** — each component family rendered as a live visual section:
  - Component name, description, "when to use"
  - Visual examples of every variant (buttons, inputs, cards, badges, etc.)
  - States (default, hover, focus, disabled, loading) where applicable
  - Code snippet showing the HTML/CSS
  - "Do" and "Don't" callouts
- **Duplication notes** (if reverse-engineered) — what to merge, what to deprecate
- **Theme switcher** — if multiple themes or light/dark are defined, a toggle that changes `[data-theme]` and re-skins all components live
- **Footer** — generated date, source files (if reverse-engineered), link to JSON spec

Constraints:
- Self-contained (inline CSS, no build step needed). Mermaid via CDN only if diagrams are used.
- Dark-first aesthetic with light-mode toggle if applicable.
- Responsive. Every component section is scannable.

#### Format (b): EJS/route-served styleguide

Write `views/styleguide/index.ejs` (and `layout.ejs` if needed) with:
- Same sections as static HTML but using the project's asset pipeline (`asset()` helper, shared partials where appropriate)
- Register in `vite.config.mjs` if CSS entries are new
- Register route in `server.js` with a catch-all exclusion
- Gate to dev/admin if appropriate

#### Format (c): Markdown-only styleguide

Write `docs/styleguide.md` with:
- Same sections as above but as markdown (no live visual rendering, no CSS)
- Color swatches as text/hex references
- Code snippets for each component
- Suitable as a reference doc but not a visual gallery

#### Always: machine-readable JSON spec

Write the agreed JSON path (default `docs/styleguide-design-brief.json`) with the 12-category component schema. The JSON MUST carry a `_managed` object so the skill can locate and reconcile it on re-run:

```json
{
  "_managed": {
    "managedBy": "b-create-styleguide",
    "block": "design-brief",
    "version": 1,
    "lastUpdated": "YYYY-MM-DD"
  },
  "tokens": { "color": {...}, "typography": {...}, "spacing": {...}, "radii": {...}, "shadow": {...}, "breakpoints": {...}, "motion": {...} },
  "components": [
    {
      "id": "button-primary",
      "status": "active",
      "category": "Buttons & CTAs",
      "name": "Primary button",
      "description": "...",
      "whenToUse": "...",
      "whenNotToUse": "...",
      "anatomy": ["label", "optional leading icon", "optional spinner"],
      "variants": [{ "name": "default", "description": "...", "selector": ".sg-btn--primary" }],
      "states": ["default", "hover", "active", "focus", "disabled", "loading"],
      "options": [{ "name": "size", "values": ["sm", "md", "lg"], "default": "md" }],
      "locations": ["views/...", "src/assets/css/..."],
      "responsive": "...",
      "accessibility": ["..."],
      "do": ["..."],
      "dont": ["..."]
    }
  ],
  "duplications": [...],
  "gaps": [...]
}
```

Component `status` values: `active` (default), `draft` (being authored), `deprecated` (no longer found in codebase on last refresh — see Phase 0 reconciliation). The skill reconciles by `id`; never reuse a deprecated `id` for a new component — mint a new `id` instead.

### Phase 5 — Wire AGENTS.md / CLAUDE.md

This is the step that makes the styleguide **living** rather than a dead doc (skipped only in `--inventory-only` mode).

1. **Find the project's agent instruction file**: check for `AGENTS.md`, `CLAUDE.md`, or similar at the repo root. If multiple exist, update all of them. If none exist, create `AGENTS.md`.
2. **Add a Styleguide section** (or update the existing one) that tells every agent:
   - Where the styleguide lives (file path + URL if route-served)
   - Where the JSON spec lives
   - That they MUST reference the styleguide before implementing any UI / design-surface change
   - That they MUST update the styleguide **in the same change** when they touch components, fonts/type, breakpoints/responsive behavior, or interactions — not leave it for a later pass
   - That they MUST NOT invent new UI patterns that contradict the styleguide
   - How to add a new component or foundation note to the styleguide (edit the JSON, add/update a section in the HTML/markdown, cite the new files)

**The Styleguide section MUST be wrapped in a managed block** so the skill can locate, update, and preserve it on re-run without overwriting user edits or duplicating. **If the managed block already exists, update only its inner content — do NOT create a duplicate block.** On every create or refresh, rewrite the managed block so it includes the full design-surface trigger contract below (merge project-specific paths/notes; never drop type / breakpoints / interactions from the trigger list).

```markdown
<!-- BEGIN b-create-styleguide -->
## Styleguide

This project has a UX styleguide. **Before implementing any UI or design-surface change, read it.**

<Include only the artifacts that exist — omit lines for formats not generated:>
- Visual styleguide: `<html-or-ejs-path>` (open in browser or visit route)
- Machine-readable spec: `<json-path>`
- Markdown reference: `<md-path>`

**Keep the styleguide current (mandatory on design work).** If a session changes any of the following, update the styleguide artifacts that exist **in the same change** (add or refresh the live demo + short note). Do not leave the styleguide stale for a later pass:
- **Components / surfaces** — new or restyled UI building blocks
- **Fonts / type** — font family, type ramp, heading/body treatments, shared type classes
- **Screen sizes / responsive** — breakpoints, layout that changes by viewport or height, mobile vs desktop shell behavior
- **Interactions** — hover/active/disabled/focus/ARIA state, motion, gestures, `prefers-reduced-motion`, timing patterns

When the change is shared foundation (type, breakpoints, interaction primitives), document it in the shared/foundation area of the styleguide. Audience- or surface-specific motion or layout stays with that surface's section.

**UI work trigger — automatic reference:**
For ANY change that touches views/templates, components, CSS, frontend JS, routes that serve UI, screenshots, UI tests, type tokens, media queries/breakpoints, or interaction/motion patterns:
1. Read the styleguide and JSON spec BEFORE writing any HTML, template, or CSS.
2. Use documented component classes, type, breakpoints, and interaction patterns. Do not invent new button styles, input layouts, card variants, type sizes, breakpoint values, or color usage.
3. If you add or modify a component, variant, state, type treatment, breakpoint, or interaction pattern, update the styleguide artifacts that exist:
   - If a visual guide exists (HTML or EJS): add/update the component or foundation section.
   - If a JSON spec exists: add/update the component entry in `components[]` and/or `tokens` (typography, breakpoints, motion).
   - If a markdown reference exists: add/update the matching section.
4. If you deprecate a component, mark it deprecated in the styleguide and migrate callers.
5. If the styleguide does not cover a component or foundation pattern you need, document it first (add to JSON + visual guide + markdown), then implement.

**Do not invent UI patterns that contradict the styleguide.** When in doubt, read the styleguide first.
<!-- END b-create-styleguide -->
```

The same block-marker contract applies to the visual guide and markdown reference (`<!-- BEGIN b-create-styleguide:styleguide -->` … `<!-- END b-create-styleguide:styleguide -->`), and to the JSON spec (`_managed` object at the top level). See Phase 0 for the full idempotency contract.

3. **Verify the file parses** — no broken markdown, no orphaned headings.
4. **Note the change** in the closeout report.

### Phase 6 — Bookkeeping

1. Create a `.context/YYYY-MM-DD.<surface>-styleguide/` subject folder, invoke lifecycle `initialize` then `activate`, and update only ordinary `index.md` content.
2. Write a session memory file + update `.context/memory/index.md`.
3. If the user wants a commit, prepare it (styleguide files + AGENTS.md/CLAUDE.md change only; no unrelated app code).

## Verification

Before yielding, confirm:

1. The styleguide (or `--inventory-only` deliverables) exists at the agreed path and is the correct format.
2. The JSON spec parses as valid JSON and has at least one component entry.
3. If reverse-engineered or `--inventory-only`: the styleguide cites real file paths from the codebase.
4. In full create/refresh mode: AGENTS.md or CLAUDE.md exists and contains the Styleguide managed block with correct file paths.
5. In full create/refresh mode: The Styleguide managed block requires same-change updates for **components, fonts/type, breakpoints/responsive, and interactions** (not components alone).
6. The visual guide (when present) has foundation sections for **Typography**, **Breakpoints / responsive**, and **Interactions / state** (may be sparse, must exist).
7. The user's palette (if provided) is reflected in the styleguide's color tokens.
8. `.context/` subject folder, memory, and memory index are updated.

## Behavior rules

- **Explain, don't assume.** The user may not know what a styleguide is. Explain in plain terms before doing anything.
- **Ask one question at a time** during the interview. Batch only if the user answers multiple at once.
- **Defaults are your friend.** If the user says "defaults" or "I don't know," use the recommended defaults and move on.
- **Reverse-engineer by default** when the codebase has UI. It's faster and more useful than inventing from scratch.
- **Always wire AGENTS.md/CLAUDE.md in full mode.** A styleguide without agent wiring is a dead doc. This step is mandatory unless `--inventory-only` was requested.
- **Do not refactor views or migrate CSS.** The skill creates documentation and agent instructions. App wiring (registering `vite.config.mjs` entries and `server.js` routes for format (b) EJS/route-served mode) is explicitly allowed and expected.
- **If the project has no UI** (API-only, CLI-only), say so and stop. A styleguide requires a visual surface.
- **If the user provides a palette in an unusual format** (screenshot, description, CSS file), parse it or ask for clarification. Do not silently ignore it.
- **Idempotent and living: safe to run repeatedly.** On re-run, detect existing styleguide and agent wiring via managed blocks; update in place rather than duplicate. Reconcile `design-brief.json` by stable component `id`: preserve existing entries, add new ones, update changed `locations`/`variants`/`states`, and mark no-longer-found components `status: "deprecated"` instead of deleting them. Always refresh foundation sections (type, breakpoints, interactions) and the AGENTS trigger contract when those surfaces drifted. If nothing changed, confirm and exit with a no-op delta.

## Closeout report format

```text
Styleguide created for <scope>.

Deliverables:
- <styleguide path> (<format>: static-html / ejs / markdown / inventory-only)
- <design-brief json path>
- AGENTS.md / CLAUDE.md updated with Styleguide section (or skipped in --inventory-only mode)

Palette: <provided palette summary or "none — used defaults">

Reverse-engineered: <yes / no>
- <N> component families documented
- <N> duplication hotspots flagged

Agent wiring:
- <AGENTS.md or CLAUDE.md> now requires all agents to reference the styleguide before UI work and to update it in the same change for components, type, breakpoints/responsive, and interactions.

Context:
- Subject: .context/YYYY-MM-DD.<surface>-styleguide/
- Memory + index updated

Recommended next step:
- Open the styleguide in a browser to review. /b-plan to migrate existing views to the new canonical components.
```

**Refresh/update mode closeout:**

```text
Styleguide refreshed for <scope>.

Mode: refresh/update

Refresh delta:
- Added: <N new components>
- Updated: <N components with new locations / variants / states>
- Deprecated: <N components no longer found in codebase>
- Unchanged: <N components>
- Foundation: <type / breakpoints / interactions / none touched>

Managed block status:
- AGENTS.md: <updated in place / no changes>
- Visual guide: <updated in place / no changes>
- JSON spec: <reconciled by id / no changes>

Recommended next step:
- Review deprecated components and migrate any remaining callers, or re-introduce them with a new id.
```

## Related skills

- `b-design-palette` — deterministic OKLCH color palette generator from a single brand hex
- `b-plan` — turn the styleguide into a migration plan for existing views
- `b-build` / `b-build-hard` — implement the styleguide's canonical components
- `b-grill` — stress-test the styleguide decisions before locking them
- `b-blueprint` — visualize a styleguide implementation plan
