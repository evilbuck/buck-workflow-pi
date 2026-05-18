---
name: arch-deep-dive
description: Generate a single-page dark-themed HTML architecture deep-dive from a phased plan and its source code. Produces self-contained HTML with ASCII state-machine diagrams, typed contract diffs, routing tables, guardrail matrices, and dependency visualizations. Use when the user says "architecture presentation", "deep-dive", "show me the architecture", "visualize the plan", "architecture diagram", or wants a technical walkthrough with code snippets. Trigger with /arch-deep-dive or /skill:arch-deep-dive.
---

# Architecture Deep-Dive Presentation

Generate a **single self-contained HTML file** that presents a phased implementation plan as a technical architecture deep-dive. Dark theme, no external dependencies, no build step.

## When to Use

- After `b-phase` — visualize what the phased plan changes
- After `b-plan` — when the plan touches architecture, state machines, type contracts, or multiple modules
- When the user asks for an architecture walkthrough, technical diagram, or visual plan summary
- Explicitly via `/arch-deep-dive` or `/skill:arch-deep-dive`

## Input Resolution

1. **Phased plan** — `plan-*-phases.md` + `phase-N-*.md` files in `.context/` subject folders
2. **Single plan** — newest `plan-*.md` in subject folders
3. **Explicit path** — user provides a specific plan file
4. Fail clearly if nothing found

```bash
find .context/ -name "plan-*-phases.md" -o -name "phase-*-*.md" | sort
find .context/ -name "plan-*.md" | sort
```

## Write Boundary

- Write to: `.context/<subject>/arch-deep-dive-<topic>.html` (alongside plan artifacts)
- Single self-contained HTML — all CSS inline, all content in `<body>`
- Do not modify source artifacts
- Do not create multi-page sites (that's `b-present`)

## Difference from b-present

`b-present` creates multi-page shareable briefing packages (light theme, Mermaid diagrams, stakeholder audience). This skill creates single-page developer deep-dives (dark theme, ASCII diagrams, inline code diffs, implementer audience).

## Section Inventory

### Required Sections

1. **Title + subtitle** — plan name, delivery tag
2. **Table of contents** — anchored nav
3. **Goal** — one-paragraph purpose + core flow as single-line ASCII diagram
4. **Current architecture** — how things work now, with real source code snippets
5. **Proposed architecture** — layered diagram, "what stays vs what changes" card pair

### Conditional Sections

| Section | Include When |
|---------|-------------|
| Lifecycle state machine | Plan changes state machines or orchestration |
| Type contracts | Plan adds or changes type definitions |
| Result parsing | Plan changes worker output or result formats |
| Worker modes | Plan adds operation-specific worker behavior |
| Guardrails & recovery | Plan adds safety rails or recovery logic |
| Phase plan | Plan has 4+ phases |
| File map | Always when >3 files affected |

## Presentation Workflow

1. **Discover** the plan and phase files
2. **Read** the plan, all phase files, and the **actual source code files** they reference
3. **Synthesize** — decide which conditional sections apply
4. **Write** the single HTML file with real code snippets, ASCII diagrams, diff highlights
5. **Preview** in browser and screenshot to verify

## Code Snippets

Must include **real code from actual source files** — not invented or approximate code. Read the files the plan references and use exact excerpts with diff highlighting via `<span class="added">` / `<span class="removed">`.

## Diagrams

ASCII art in `<div class="diagram">` — no Mermaid, no SVG, no CDN. Uses semantic classes:

- `.state` (green bold) — states
- `.arrow` (blue) — transitions
- `.guard` (orange) — conditions/guards
- `.block` (red) — blocked outcomes
- `.fn` (purple) — function names
- `.type` (blue) — types/files
- `.comment` (gray) — notes

## HTML Template

See [references/template.html](references/template.html) for the complete boilerplate with dark theme CSS, diagram styles, code diff styles, card grids, tables, badges, and responsive layout.

## Output Report

```
Architecture deep-dive generated:
  .context/<subject>/arch-deep-dive-<topic>.html

Open: xdg-open .context/<subject>/arch-deep-dive-<topic>.html
```
