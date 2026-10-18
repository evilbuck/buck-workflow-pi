---
status: completed
date: 2026-05-09
subject: 2026-05-07.b-present-skill
topics: [b-present, presentation-package, rewrite, async-reading, briefing-package]
research: [grill-session-b-present-presentation-package.md]
spec:
memory: [b-present-rewrite-build-2026-05-09.md]
iterations: [iterate-b-present-rewrite.md]
---

# Plan: b-present In-Place Rewrite (Slide Deck → Presentation Package)

## Goal

Rewrite `b-present` from a Reveal.js slide-deck generator into an async-reading-first presentation-package generator. The new output is a small static site with a primary overview page, optional detail pages, rendered source views, and a manifest.

## Context used / assumptions

- **Grill session artifact**: `.context/2026-05-07.b-present-skill/grill-session-b-present-presentation-package.md` — 66 questions resolved across 5 decision domains. This is the authoritative design document.
- **Domain context**: `CONTEXT.md` at repo root — glossary and resolved ambiguities for the new model.
- **Memory**: `b-present-grill-with-docs-2026-05-09.md` — session notes documenting the redesign decisions.
- **Old implementation**: `skills/b-present/SKILL.md` (384 lines, Reveal.js), `skills/b-present/references/revealjs-templates.md` (469 lines), `prompts/b-present.md` (107 lines).
- **Assumptions**:
  - In-place rewrite is acceptable (user is the only consumer).
  - Backward compatibility with old Reveal.js output can break outright.
  - ADR for the artifact-model shift is deferred (optional, not blocking).
  - No specific no-build framework is locked in yet — use semantic HTML by default.

## Scope

Rewrite these files to describe the new presentation-package model:

1. **`skills/b-present/SKILL.md`** — full rewrite: new workflow, package structure, synthesis rules, overview skeleton, detail-page types, source-view handling, manifest contract, preview/serve workflow.
2. **`skills/b-present/references/revealjs-templates.md`** — rename/replace with a new reference file for the briefing-package HTML patterns (semantic HTML, CSS, optional Mermaid, navigation patterns).
3. **`prompts/b-present.md`** — full rewrite to reference the new skill and package contract.
4. **`docs/buck-workflow.md`** — update the `/b-present` section to describe briefing-package output.
5. **`README.md`** — update the b-present table entry.

## Out of scope

- Writing ADR for the artifact-model shift (can be done separately).
- Building a runtime implementation (script, server, build tool) — this plan covers the skill/prompt/docs rewrite only.
- Implementing the actual presentation-package generator logic in code — the skill instructs the AI agent how to produce the output.
- Picking or locking in a specific no-build framework.
- Adding slide-deck mode as an optional secondary output.
- Modifying any other Buck workflow skills (`b-phase`, `b-plan`, etc.).

## Affected files

| File | Action | Description |
|------|--------|-------------|
| `skills/b-present/SKILL.md` | Rewrite | New skill describing presentation-package workflow |
| `skills/b-present/references/revealjs-templates.md` | Replace | New reference: briefing-package HTML patterns (delete Reveal.js templates) |
| `prompts/b-present.md` | Rewrite | New prompt template for briefing-package generation |
| `docs/buck-workflow.md` | Edit | Update `/b-present` section (~L509-545) |
| `README.md` | Edit | Update b-present table row (~L39) |
| `CONTEXT.md` | No change | Already up to date from grill-with-docs session |

## Implementation steps

### Step 1: Replace the Reveal.js templates reference file

Replace `skills/b-present/references/revealjs-templates.md` with a new file (e.g., `briefing-package-patterns.md` or keep the same filename with new content). The new reference should contain:

- **Semantic HTML skeleton** for `index.html` (overview page)
- **CSS styling patterns** for the tiered visual system:
  - Overview page: product-brief feel, docs-like nav
  - Detail pages: simpler
  - Source views: utilitarian
- **Navigation patterns**: sticky sidebar on wide screens, collapsible top nav on narrow screens, card links to detail pages
- **Mermaid diagram embedding** (for when diagrams are appropriate)
- **Manifest.json schema** example
- **Source-view page template** (loads markdown via client-side renderer)

Consider whether to delete `revealjs-templates.md` and create a new file, or rewrite in-place with a rename. Since the content is entirely different, creating a new file is cleaner.

### Step 2: Rewrite `skills/b-present/SKILL.md`

Full rewrite. The new SKILL.md should cover:

**Metadata**:
- Update `name` and `description` to reflect presentation-package generation.

**When to Use**:
- Same trigger conditions but described as "async-readable briefing package" not "slide deck."

**Input Resolution** (keep existing resolution order, unchanged).

**Write Boundary**:
- Write to `presentations/<slug>/` (project-root-relative, not inside `.context/`)
- Package-local `assets/`, `sources/`, `manifest.json`

**Output Structure**:
```
presentations/<slug>/
├── index.html          # Primary overview presentation
├── architecture.html   # Optional detail page
├── phases.html         # Optional detail page
├── verification.html   # Optional detail page
├── appendix.html       # Optional detail page
├── assets/             # Package-local CSS, JS, images
├── sources/            # Copied markdown source artifacts
└── manifest.json       # Semi-public package metadata
```

**Package Generation Workflow**:
1. Discover source artifact
2. Read and parse source(s) — parent plan + phased plan if both exist
3. Synthesize overview narrative (moderate synthesis: rephrase, de-duplicate, reorganize)
4. Determine which detail pages to generate based on source complexity
5. Copy referenced source markdown into `sources/`
6. Generate `manifest.json`
7. Serve/preview the package

**Overview Page Skeleton** (hybrid model, adapts by source type):
- Title / Summary / Why / What changes / How it works / Delivery shape / Risks & conflicts / Sources
- Optional: Open questions (only when materially important)
- Conflicts section: visible warning when parent/phase plans contradict

**Source-type bias** (emphasis shifts, package model stays the same):
- Plan: goal, scope, steps, risks, verification
- Brainstorm: problem, options, recommendation, open questions
- Spec: goal, context, requirements, acceptance, implications
- Grill session: challenged, clarified, changed, left open

**Detail Page Rules**:
- `phases.html` — create when phased plan adds significant detail or phase complexity clutters overview
- `architecture.html` — create when architecture exceeds compact overview
- `verification.html` — create when detailed checks distract from main narrative
- `appendix.html` — non-essential supporting material, never core narrative

**Source View Rules**:
- Copy every referenced source markdown into `sources/`
- Source links open rendered source view using client-side markdown renderer
- Renderer is for source views only; synthesized pages remain authored HTML

**Diagram Rules** (carry forward from old skill):
- Generate only from source content, never invent
- Use Mermaid by default
- Plain HTML/CSS fallbacks when Mermaid is a poor fit

**Manifest.json Contract**:
- Semi-public, documented enough to use, room to evolve
- Fields: slug, generated date, source artifacts, pages, title
- Used for regeneration cleanup (remove stale files)

**Preview/Server Workflow**:
- Part of core `b-present` flow
- Fallback chain for serving (Node-based preferred when available)
- Auto-open/select preview when tooling is available

### Step 3: Rewrite `prompts/b-present.md`

Rewrite the prompt template to:

- Reference the new skill file location
- Reference the new reference file (not Reveal.js templates)
- Describe the agent role as generating an async-readable presentation package
- Update the write boundary to `presentations/<slug>/`
- Update output structure and reporting
- Remove all Reveal.js references (CDN URLs, themes, speaker notes, `file://` protocol)
- Add source-view and manifest generation instructions

### Step 4: Update `docs/buck-workflow.md`

Edit the `/b-present` section (~L509-545):
- Change title from "Slide Deck Presentation" to "Presentation Package"
- Update purpose to describe async-reading-first briefing packages
- Update output location from `.context/.../presentations/<slug>-presentation.html` to `presentations/<slug>/`
- Replace "Presentation Features" list with new package model features
- Remove Reveal.js references (keyboard navigation, presenter mode, PDF export)
- Add package-structure listing and detail-page types

### Step 5: Update `README.md`

Update the b-present row in the command table (~L39):
- Change description from "Generate HTML presentation from a plan" to "Generate async-readable presentation package from plan/phase/brainstorm/spec"

### Step 6: Clean up old Reveal.js reference file

After the new reference file is in place, decide whether to:
- Delete `skills/b-present/references/revealjs-templates.md` entirely, OR
- Keep the filename but with fully replaced content

Recommendation: Delete and create new file `briefing-package-patterns.md` for clarity.

## Verification

- [ ] `skills/b-present/SKILL.md` contains zero Reveal.js references
- [ ] `prompts/b-present.md` references new skill and package model, not Reveal.js
- [ ] New reference file contains HTML/CSS patterns for briefing packages
- [ ] `docs/buck-workflow.md` `/b-present` section describes presentation package
- [ ] `README.md` b-present row updated
- [ ] Old Reveal.js templates file removed or replaced
- [ ] All grill-session decisions from Q1-Q66 are reflected in the new skill
- [ ] CONTEXT.md glossary terms used consistently in new docs
- [ ] `grep -ri "reveal" skills/b-present/ prompts/b-present.md` returns no hits

## Risks

- **Scope creep into runtime implementation**: The skill is instructions for an AI agent, not executable code. Resist the urge to write Node scripts or a preview server in this rewrite — that's a separate effort.
- **Over-specifying the HTML template**: The reference file should provide patterns, not a rigid template. The AI agent will generate HTML based on the source content. Over-specifying limits flexibility.
- **Framework temptation**: Do not lock in a no-build framework in this pass. Use semantic HTML and lightweight CSS. Framework choice can happen later when real interactive needs justify it.
- **Mermaid dependency**: Mermaid is the default diagram tool but must degrade gracefully. The skill should note fallback options.

## Recommended next step

This plan is straightforward file-by-file rewriting with clear source material (grill session + CONTEXT.md). Use `/b-build` for execution.

The plan touches 5-6 files with clear before/after states — no phasing needed.
