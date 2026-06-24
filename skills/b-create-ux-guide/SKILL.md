---
name: b-create-ux-guide
description: Break a site or a named section into its UI/UX components, organize them into a reviewed taxonomy, surface duplication to DRY up, and produce three deliverables — a markdown style guide, an HTML research/visual guide, and a detailed machine-readable design-brief.json. Takes an optional section/area argument; otherwise uses the active context. Asks where to write docs, defaulting to docs/ux-style-guide.md, docs/ux-research.html, and docs/ux-design-brief.json.
---

# b-create-ux-guide: Site → Component Inventory → UX Guide

Turn a running site (or one named section of it) into a referenceable UX guide that humans and agents can use to implement UI consistently. The skill does the **analyze → organize → document** loop: it inventories every UI component on the target surface, groups them into a canonical taxonomy, calls out duplication/DRY opportunities, and writes three deliverables — a markdown style guide, a scannable HTML research guide, and a detailed `design-brief.json` that machine-encodes every component for agents to implement against.

This is the codified version of the inventory + visual-guide workflow. It stops at documentation. Turning the guide into an implementation plan is the downstream `b-plan` step.

## Argument

Optional single argument: a **section / area of the project** to scope the analysis (e.g. `admin`, `/u`, `checkout`, `marketing landers`, `public pages`).

- **Argument present** → scope the entire inventory to that section only. State the resolved scope explicitly before analyzing.
- **No argument** → use the active session context (current subject, recently discussed area, or the obvious primary surface). If context does not make the scope obvious, ask the user which surface to inventory before doing work — do not silently inventory the whole repo.

## Use when

- Someone wants a styleguide / component reference for a site or a section of it
- The UI has grown organically and components are duplicated across pages
- An agent needs a canonical "what does a button/input/card/table look like and when to use it" reference
- You need a visual, scannable map of the current UI before refactoring or theming

## Do not use when

- The request is to *implement* or *migrate* components (that is `b-plan` → `b-build`)
- The target is a single trivial page with no reusable structure
- The user wants external/web research rather than internal UI analysis (use `b-research`)

## Output locations (ask first, then default)

This skill produces **three deliverables**:

1. **Markdown style guide** — the organized, reviewable component inventory. Default: `docs/ux-style-guide.md`
2. **HTML research guide** — the visual, scannable synopsis (taxonomy map, inventory tables, duplication patterns, decisions, risks). Default: `docs/ux-research.html`
3. **Design brief JSON** — the detailed, machine-readable component spec (one entry per component: category, variants, anatomy, states, options, locations, a11y, do/don't). Default: `docs/ux-design-brief.json`

**Always ask the user where to leave documentation before writing**, offering the defaults. Accept an alternate directory or filenames. If the user defers or says "default", use the three paths above. Create parent directories as needed.

Also keep durable working notes in `.context/` per the standard before/after workflow — the `docs/` files are the shareable deliverables, `.context/` holds the session trail.

## Component taxonomy (the organizing frame)

Organize every finding into these categories. Omit a category only when the target surface genuinely has nothing in it; never invent entries to fill one.

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

Every entry MUST cite **exact file paths** (and class names where relevant). An inventory without file references is not done.

## Procedure

### Phase 1 — Resolve scope and outputs

1. Read the recent memory index and backlog (standard before-task workflow).
2. Resolve the scope from the argument or context. State it in one sentence.
3. **Ask where to write the three deliverables**, offering `docs/ux-style-guide.md`, `docs/ux-research.html`, and `docs/ux-design-brief.json` as defaults.
4. Create a `.context/YYYY-MM-DD.<surface>-ux-guide/` subject folder with `index.md` and a rolling notes file.

### Phase 2 — Analyze (inventory)

Map the target surface's UI source: views/templates, partials/components, CSS/token files, and any browser/UI tests that reveal interactive behavior. Then inventory every component.

- Use `find` to map structure, `search` to locate component patterns (class names, `role="dialog"`, `<details>`, modal/drawer/sidebar ids, input types), and `read` to confirm exact markup.
- For each component, record: what it is, meaningful variants, exact file location(s), and a concise note.
- Write findings into the rolling notes file as you go — do not hoard in context.

**Parallelize for large surfaces.** If the target spans many files, fan out read-only explorer subagents (one per sub-area, e.g. one for shell+nav, one for data-heavy pages, one for interaction assets/tests), each returning a structured inventory, then merge. Keep judgment and synthesis in your own context. For a small section, inventory inline.

### Phase 3 — Organize (taxonomy + DRY)

1. Group every finding under the taxonomy categories above.
2. Within each category, name the component families and list their variants.
3. Identify **duplication & near-duplication**: the same family implemented with different class systems, repeated inline patterns that bypass a shared partial, dead/legacy components. Each duplication note names the files involved and the merge target.
4. Note responsive behavior and any styling-system splits (e.g. two CSS methodologies / two palettes across sub-areas).
5. List gaps/unknowns for a future review pass.

### Phase 4 — Write the markdown style guide

Write the chosen markdown path (default `docs/ux-style-guide.md`). Structure:

```markdown
# <Surface> UX Style Guide

Scope: <what is in / out of scope>

## Files inspected
- <grouped file list>

## 1. Surfaces / layouts / shells
- **<component>** — <variants>. `path/to/file`

## 2. Navigation
...

## (… one section per taxonomy category that has entries …)

## Duplication & DRY hotspots
1. **<family>** duplicated across `a`, `b`, `c` — merge target: <one canonical>.
...

## Responsive / mobile behavior
...

## Gaps / unknowns
...

## Recommended next step
<hand off to b-create-styleguide to make this living, then b-plan to migrate>
```

Rules:
- Every component line cites real files.
- Variants are concrete, not vague ("primary / ghost / icon-only", not "several styles").
- Duplication notes name the merge target, not just the problem.

### Phase 5 — Write the HTML research guide

Write the chosen HTML path (default `docs/ux-research.html`). A single self-contained, dark-first, scannable page. Mirror the structure of a technical blueprint:

- **Header** — title, scope badge, date, one-liner (problem → what this guide gives)
- **Component Taxonomy Map** — a Mermaid `flowchart` of sub-areas → shared families, plus per-category cards
- **Inventory Surface Files** — a table of the inspected files with layer tags
- **Duplication Patterns** — illustrative code/CSS snippets showing the same family implemented multiple ways (mark illustrative snippets)
- **Styling split** (if any) — side-by-side of competing token/CSS systems
- **Key decisions / scope** — what was included/excluded and why
- **Risks / DRY debt** — severity-ranked cards
- **Next steps** — normalize → plan → build

Constraints:
- Pure HTML + CSS, Mermaid via CDN only. No JS frameworks.
- Diagrams render ONLY relationships found in the inventory — never invented.
- Dark-first, print-friendly, responsive. Self-contained single file.

The HTML guide is the visual companion to the markdown guide; both describe the same inventory.

### Phase 6 — Write the detailed design-brief.json

Write the chosen JSON path (default `docs/ux-design-brief.json`). This is the machine-readable companion to the markdown guide — the artifact agents read to implement components consistently. It MUST be valid JSON and describe the SAME inventory, not a different one.

Top-level shape:

```json
{
  "$schema": "ux-design-brief.schema.json",
  "meta": {
    "surface": "<scope, e.g. /u + /admin>",
    "generated": "YYYY-MM-DD",
    "sourceGuide": "docs/ux-style-guide.md",
    "filesInspected": ["path/a", "path/b"]
  },
  "tokens": {
    "note": "Optional. Populate only when a palette/token system was provided or discovered.",
    "color": {}, "radii": {}, "shadow": {}, "spacing": {}, "typography": {}
  },
  "components": [
    {
      "id": "button-primary",
      "category": "Buttons & CTAs",
      "name": "Primary button",
      "description": "<what it is and the intent>",
      "whenToUse": "<the single decision rule for reaching for this>",
      "whenNotToUse": "<the competing component and when to prefer it>",
      "anatomy": ["label", "optional leading icon", "optional spinner"],
      "variants": [
        { "name": "default", "description": "...", "selector": ".sg-btn--primary" },
        { "name": "icon-only", "description": "...", "selector": ".sg-btn--icon" }
      ],
      "states": ["default", "hover", "active", "focus", "disabled", "loading"],
      "options": [
        { "name": "size", "values": ["sm", "md", "lg"], "default": "md" }
      ],
      "locations": ["views/...", "src/assets/css/..."],
      "duplication": { "duplicateOf": null, "mergeTarget": "<canonical id>", "notes": "..." },
      "responsive": "<breakpoint behavior>",
      "accessibility": ["role/aria expectations", "focus handling", "contrast notes"],
      "do": ["..."],
      "dont": ["..."]
    }
  ],
  "duplications": [
    { "family": "KPI card", "implementations": ["a", "b", "c"], "mergeTarget": "<canonical id>" }
  ],
  "gaps": ["<component families that are missing or ambiguous>"]
}
```

Rules for the design brief:
- **One entry per component family** found in the inventory — the `components` array is exhaustive for the scoped surface.
- Every component carries `category`, `variants`, `states`, `locations`, and `duplication`. `options`, `anatomy`, `accessibility`, `do`/`dont` are filled when known.
- `locations` cite the SAME real files as the markdown guide. The three deliverables describe one inventory.
- `tokens` is populated only when a palette/token system exists; otherwise leave the block with empty objects and the note.
- Mark any inferred field, and never invent variants/states the source markup does not exhibit.
- Validate it parses as JSON before yielding.

### Phase 7 — Bookkeeping

1. Consolidate rolling notes into the subject's canonical research file.
2. Update the subject `index.md` to link all three `docs/` deliverables.
3. Write a session memory file + update `.context/memory/index.md`.
4. Do not modify any application code — this skill only reads source and writes docs + `.context`.

## Verification

Before yielding, confirm:

1. All three deliverables exist at the agreed paths.
2. The markdown guide cites real, existing file paths in every section.
3. The HTML guide opens as a valid self-contained page (Mermaid blocks parse; no broken structure).
4. `docs/ux-design-brief.json` parses as valid JSON, has one `components` entry per inventory family, and its `locations` match the markdown guide's file citations.
5. The duplication section/array names concrete merge targets in both the markdown guide and the JSON.
6. The scope statement matches the argument/context that was resolved.
7. `.context/` subject folder, memory, and memory index are updated.

## Behavior rules

- **Documentation only.** Never edit application code, CSS, or views — read them, document them.
- **Cite files always.** Any component claim without a file path is incomplete.
- **Ask before writing docs.** Offer the defaults; honor an alternate location.
- **Do not invent components or relationships.** Inventory what exists; mark gaps as gaps and inferences as `[INFERENCE]`.
- **Organize, don't just list.** Grouping into the taxonomy and naming duplication is the value — a flat dump is failure.
- **Respect the scope argument.** A named section means that section only; do not creep into the whole site.
- **Handoff awareness at closeout.** Before printing the recommended next step, check whether a styleguide already exists (`docs/styleguide.html`, `docs/styleguide.md`, `docs/styleguide-design-brief.json`, or a `<!-- BEGIN b-create-styleguide -->` block in `AGENTS.md` / `CLAUDE.md`):
  - **No styleguide exists** — recommend `b-create-styleguide` as the natural next step (it can consume this ux-guide JSON as a seed inventory if the user agrees).
  - **Styleguide already exists** — this ux-guide run is either (a) a refresh that produced a new research record (the styleguide stays canonical; do not auto-promote ux-guide), or (b) a one-off inventory the user wanted without changing the styleguide. Surface this in the closeout and ask the user what to do with the new ux-guide deliverables (keep alongside as a dated snapshot, archive, or delete). Do not silently create a second source of truth.

## Closeout report format

```text
UX guide generated for <scope>.

Deliverables:
- <markdown path>
- <html path>
- <design-brief json path>

Coverage:
- <N> taxonomy categories, <N> component families
- <N> duplication hotspots flagged

Context:
- Subject: .context/YYYY-MM-DD.<surface>-ux-guide/
- Memory + index updated

Recommended next step:
- /b-create-styleguide to turn this inventory into a living, agent-wired styleguide (recommended), or /b-plan to skip straight to a migration plan, or /b-grill-me to stress-test scope first.
```

## Related skills

- `b-explore` — generic read-only codebase exploration (this skill is the UX-specialized form)
- `b-blueprint` / `b-present` — generate visual/briefing artifacts from a plan (this skill produces its own HTML guide)
- `b-plan` — turn the finished guide into a bounded implementation/styleguide plan (run after `b-create-styleguide`)
- `b-create-styleguide` — turn this inventory into a living, agent-wired styleguide (reconciles `design-brief.json` by `id`, deprecates missing components, wires AGENTS.md). Best next step before `b-plan`.
- `b-grill-me` — stress-test the scope and decisions before planning
