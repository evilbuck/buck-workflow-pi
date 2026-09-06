---
name: b-present
description: Generate an async-readable presentation package (static site) from plan/phase/brainstorm/spec/grill-session artifacts. Produces a primary overview page, optional detail pages, source views, and a manifest. Use after b-plan, b-phase, b-brainstorm, or b-research to create shareable briefing packages. Trigger with /b-present or /skill:b-present.
---

# b-present: Context-to-Presentation-Package

Transform `.context/` artifacts (plans, phases, brainstorms, specs, grill sessions) into an async-reading-first **Presentation Package** — a small static site with a primary overview page, optional detail pages, rendered source views, and a manifest.

## When to Use

- After `b-plan` or `b-phase` — generate a briefing package for review
- After `b-brainstorm` — present brainstorm findings
- After `b-explore` or `b-research` — share research output as a readable package
- When someone asks "can you present this?" or "make a briefing from this plan?"
- Explicitly via `/b-present` or `/skill:b-present`

## Input Resolution

1. **Explicit path** provided by user → use that
2. **Subject `index.md`** → if present, read it first for fast artifact discovery, then follow its links
3. **Phased plan** → look for `plan-*-phases.md` overview + discrete `phase-N-*.md` files
4. **Single plan** → newest `plan-*.md` in subject folders
5. **Brainstorm** → `brainstorm-*.md` or brainstorm state JSON in subject folder
6. **Spec** → `spec-*.md` in subject folders
7. **Grill session** → `grill-session-*.md` in subject folder (present findings/decisions)
8. **Research** → `research-*.md` in subject folders (from either `b-explore` or `b-research`)
9. If multiple plausible sources exist at the same precedence level, **stop and ask the user**
10. Fall back to newest artifact in subject folders
11. Fail with clear message if nothing found

```bash
# Discovery commands
find .context/ -name "plan-*.md" -o -name "plan-*-phases.md" -o -name "phase-*-*.md" | sort
find .context/ -name "grill-session-*.md" | sort
find .context/ -name "brainstorm-*" | sort
find .context/ -name "spec-*.md" | sort
find .context/ -name "research-*.md" | sort
```

## Write Boundary

- Write only to: `presentations/<slug>/` (project-root-relative)
- Package-local `assets/`, `sources/`, and `manifest.json`
- Do not modify source artifacts
- Do not write outside the package directory
- Packages are disposable generated output — not intended for hand-editing

## Output Structure

```
presentations/<slug>/
├── index.html          # Primary overview presentation (required)
├── architecture.html   # Optional detail page
├── phases.html         # Optional detail page
├── verification.html   # Optional detail page
├── appendix.html       # Optional detail page
├── assets/
│   ├── styles.css      # Shared stylesheet
│   └── render-md.js    # Client-side markdown renderer
├── sources/            # Copied markdown source artifacts
│   └── <source>.md
└── manifest.json       # Semi-public package metadata
```

## Package Generation Workflow

### Step 1: Discover Source

Resolve the source artifact using the input resolution order.

### Step 2: Read and Parse

Read the full source artifact(s). Extract:
- Frontmatter (status, date, subject, topics)
- Structured sections (goal, scope, steps, files, risks, verification)
- Phase data (if phased plan)
- Dependencies and relationships

When **both parent plan and phased plan** exist:
- Parent plan is authoritative for goal, scope, and narrative
- Phased plan is authoritative for execution detail
- Synthesize both — de-duplicate overlap
- If contradictions exist, surface them (do not silently merge)

### Step 3: Synthesize Overview Narrative

Use **moderate synthesis**: rephrase, de-duplicate, and reorganize for clarity without strong interpretation.

The overview uses a **hybrid top-level skeleton** — labels and emphasis adapt by source type:

```
Title / Summary / Why / What Changes / How It Works / Delivery Shape / Risks & Conflicts / Sources
```

**Source-type bias** (emphasis shifts, package model stays the same):

| Source Type | Emphasis |
|-------------|----------|
| Plan | Goal, scope, steps, risks, verification |
| Brainstorm | Decision landscape: problem, options, recommendation, open questions |
| Spec | Product narrative: goal, context, requirements, acceptance, implications |
| Grill session | Decision resolution: what was challenged, clarified, changed, left open |
| Research | Findings, data flow, risks, unknowns, recommended next steps |

**Conflicts section**: When parent/phase plans contradict, show a visible warning banner on the overview page with a concise summary. Fuller explanation goes in the appendix.

**Open questions**: Include an `Open questions` section only when unresolved issues materially affect understanding or next decisions.

### Step 4: Determine Detail Pages

Create detail pages only when justified by source complexity:

| Page | When to Create |
|------|----------------|
| `phases.html` | Phased plan adds significant new detail, or phase complexity would clutter the overview |
| `architecture.html` | Architecture needs more than a compact overview diagram plus short explanation |
| `verification.html` | Detailed checks or matrices would distract from the main narrative |
| `appendix.html` | Non-essential but useful supporting material; never core narrative |

### Step 5: Copy Source Markdown

Copy **every** artifact directly used in the synthesis into `sources/`. This ensures source views match actual provenance.

### Step 6: Generate manifest.json

Generate a semi-public `manifest.json` with:
```json
{
  "slug": "<slug>",
  "title": "<title>",
  "generated": "<ISO date>",
  "sourceArtifacts": ["<paths>"],
  "pages": [{"file": "...", "type": "overview|detail", "title": "..."}],
  "sources": ["sources/<file>.md"]
}
```

Use `manifest.json` on regeneration to remove stale files that are no longer needed.

### Step 7: Serve/Preview

Preview launching is part of the core `b-present` flow:
- Start a local server from `presentations/<slug>/`
- Auto-open or select a preview when tooling is available
- Use this concrete fallback chain:
  1. `npx --yes serve . -l 4321`
  2. `python3 -m http.server 4321`
  3. `python -m http.server 4321`
  4. `php -S localhost:4321`
  5. If no server is available, report the package path and tell the user to open `presentations/<slug>/index.html` manually
- Prefer an available idle tmux pane for long-running preview servers when operating in an interactive terminal session

## Overview Page Structure

The overview page (`index.html`) uses a **product-brief feel** with **docs-like navigation**:

- **Sticky sidebar** on wide screens with section anchor links
- **Collapsible top nav** on narrow screens (responsive)
- **Card links** to detail pages when they exist
- **Mixed navigation** supporting non-linear async reading

### Section Layout

```
┌─ Sidebar ──────────┐ ┌─ Main Content ─────────────────────┐
│ Title              │ │                                    │
│                    │ │ Title / Date / Subject             │
│ Summary            │ │                                    │
│ Why                │ │ [Conflict banner if applicable]    │
│ What Changes       │ │                                    │
│ How It Works       │ │ Summary                            │
│ Delivery           │ │ Why                                │
│ Risks & Conflicts  │ │ What Changes                       │
│ Sources            │ │ How It Works (with diagrams)       │
│                    │ │ Delivery Shape                     │
│ Detail Pages:      │ │ Risks & Conflicts                  │
│   → Phase Details  │ │ [Open Questions if applicable]     │
│   → Architecture   │ │ Sources                            │
└────────────────────┘ └────────────────────────────────────┘
```

## Detail Page Rules

- Detail pages are **simpler** than the overview — no sidebar nav, just back-link + content
- Each detail page focuses on **one concern** (phases, architecture, verification, or appendix)
- Use the `detail-page` CSS layout class from the reference patterns
- Always include a "← Back to overview" link

## Source View Rules

- Source links open rendered **source views** using a client-side markdown renderer
- The renderer is for source views **only** — synthesized overview/detail pages remain authored HTML
- Use `marked.js` from CDN or a simple regex-based renderer
- Source views use a **utilitarian** visual style (monospace font, minimal styling)

## Diagram Rules

Generate diagrams **ONLY** from information present in the source artifacts. Never invent relationships, services, or data flows.

### When to Generate

Generate a diagram when the source contains:
- Multiple files/directories that interact → `flowchart`
- Steps in a sequence → `flowchart LR` or `flowchart TD`
- System boundaries or services → `flowchart` with subgraphs
- Phase dependencies → `flowchart` with labeled edges
- User/stakeholder interactions → `sequenceDiagram`

### Diagram Runtime

- **Mermaid by default** — load from CDN
- **Plain HTML/CSS fallbacks** when Mermaid is a poor fit (simple tables, lists)
- Diagrams on the overview page: include as many as materially improve understanding
- `architecture.html` serves as overflow/deep-dive when architectural explanation exceeds comfortable overview density

```html
<div class="mermaid-container">
  <div class="mermaid">
    flowchart LR
      A[Component] --> B[Service] --> C[Data]
  </div>
</div>
```

## Visual System

Styling is **tiered** across page types:

| Page Type | Visual Polish |
|-----------|---------------|
| `index.html` (overview) | Most polished — sidebar nav, cards, badges |
| Detail pages | Simpler — back-link + content |
| Source views | Utilitarian — monospace, minimal |

Use mostly **semantic HTML** by default. A lightweight no-build framework is allowed only when it meaningfully improves navigation or rendering. Do not lock in a specific framework.

## HTML Templates

Read `references/briefing-package-patterns.md` in this skill directory for:
- Complete HTML boilerplate for overview, detail, and source pages
- CSS custom properties and component patterns
- Responsive navigation patterns
- Mermaid embedding
- Client-side markdown renderer
- manifest.json schema

## Error Handling

- **No source found**: "No plan, spec, brainstorm, research, or grill session found. Provide a path or ensure artifacts exist in `.context/`."
- **Source malformed**: Generate what you can, note missing sections in the output.
- **Empty phases**: Skip phase detail pages, show overview only.
- **Contradictory sources**: Generate output with a visible conflicts section; do not fail.

## Integration with Buck Workflow

| Command | Relationship |
|---------|-------------|
| `/b-plan` | Primary input source for presentation packages |
| `/b-phase` | Phased plans may trigger phases detail page |
| `/b-brainstorm` | Brainstorm output becomes a briefing package |
| `/b-build` | Can reference package for context during implementation |
| `/b-review` | Review the package for accuracy before sharing |

**Typical flow**: `b-plan` → `b-present` → `b-build` (or `b-plan` → `b-phase` → `b-present` → `b-build`)

## Output Report

```
Presentation package generated:
  presentations/<slug>/
  ├── index.html          (overview)
  ├── phases.html         (detail, if applicable)
  ├── assets/
  ├── sources/
  └── manifest.json

Preview: http://localhost:<port>/
Source: <source-file(s)>
```
