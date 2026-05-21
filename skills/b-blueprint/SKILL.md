---
name: b-blueprint
description: Generate a single-page architecture blueprint as HTML from Buck workflow plans, brainstorms, and phases. Produces a visually rich synopsis with code snippets, Mermaid diagrams, file-change maps, before/after diffs, and data-flow visualizations. Use after b-plan, b-phase, or b-brainstorm when you need a quick-to-scan technical overview of proposed architecture and code changes. Trigger with /b-blueprint or /skill:b-blueprint.
---

# b-blueprint: Architecture Plan Blueprint

Transform a `.context/` plan, phase, or brainstorm artifact into a **single-page HTML architecture blueprint** — a dense, visual, scannable synopsis of the proposed architecture and code changes.

## When to Use

- After `/b-plan` — visualize the plan before building
- After `/b-phase` — show the phase architecture and dependencies
- After `/b-brainstorm` — sketch the proposed direction visually
- When someone says "show me the architecture", "visualize the plan", "render the blueprint"
- When you need a quick-to-scan technical summary rather than a full briefing package
- Use `/b-present` for full multi-page briefing packages; use `/b-blueprint` for focused technical blueprints

## Relationship to b-present

| Feature | b-present | b-blueprint |
|---------|-----------|-------------|
| Purpose | Shareable briefing package | Technical architecture poster |
| Pages | Multi-page static site | Single HTML file |
| Navigation | Sidebar + section links | Scroll-based sections |
| Focus | Narrative + overview | Code + diagrams + file changes |
| Audience | Stakeholders, reviewers | Engineers, implementers |
| Output | `presentations/<slug>/` directory | `presentations/<slug>/blueprint.html` |

Both can coexist — generate a blueprint for the implementer and a briefing for the reviewer.

## Input Resolution

Follow the same discovery as b-present:

1. **Explicit path** provided by user → use that
2. **Subject `index.md`** → read first, follow links
3. **Phased plan** → `plan-*-phases.md` + `phase-N-*.md` files
4. **Single plan** → newest `plan-*.md` in subject folders
5. **Brainstorm** → `brainstorm-*.md` in subject folder
6. **Spec** → `spec-*.md` in subject folders
7. If ambiguous, **stop and ask**

```bash
# Discovery commands
find .context/ -name "plan-*.md" -o -name "plan-*-phases.md" -o -name "phase-*-*.md" | sort
find .context/ -name "brainstorm-*" | sort
find .context/ -name "spec-*.md" | sort
```

## Write Boundary

- Write to: `presentations/<slug>/blueprint.html` (single file)
- Optionally write supporting `assets/blueprint.css` if the user requests customization
- Do not modify source artifacts
- Coexists with b-present output in the same `presentations/` directory

## Blueprint Section Layout

The blueprint is a **single scrolling page** with these sections, each visually distinct:

```
┌─────────────────────────────────────────────┐
│  HEADER: Title + Status Badge + Date        │
│  ONE-LINER: Problem → Solution              │
├─────────────────────────────────────────────┤
│  ARCHITECTURE OVERVIEW                       │
│  ┌─────────────────────────────────────────┐│
│  │  Mermaid diagram: system/data flow      ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  FILE CHANGE MAP                             │
│  ┌─────────┬─────────┬────────────────────┐ │
│  │ File    │ Action  │ Description        │ │
│  ├─────────┼─────────┼────────────────────┤ │
│  │ file.ts │ NEW     │ Endpoint handler   │ │
│  │ db.ts   │ MODIFY  │ Add column X       │ │
│  │ old.ts  │ DELETE  │ Superseded by new  │ │
│  └─────────┴─────────┴────────────────────┘ │
├─────────────────────────────────────────────┤
│  CODE CHANGES                                │
│  ┌─────────────────────────────────────────┐│
│  │ Before/After diff or new code snippet   ││
│  │ with syntax highlighting                ││
│  └─────────────────────────────────────────┘│
│  ... repeat per significant change ...       │
├─────────────────────────────────────────────┤
│  DATA FLOW / SEQUENCE                        │
│  ┌─────────────────────────────────────────┐│
│  │  Mermaid sequence/flowchart             ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  KEY DECISIONS                               │
│  ▸ Decision 1 — rationale                   │
│  ▸ Decision 2 — rationale                   │
├─────────────────────────────────────────────┤
│  RISKS & TRADEOFFS                           │
│  ┌─────────────────────────────────────────┐│
│  │ Risk card with severity + mitigation    ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  DELIVERY SHAPE                              │
│  Phase 1 ──▶ Phase 2 ──▶ Phase 3            │
├─────────────────────────────────────────────┤
│  VERIFICATION CHECKLIST                      │
│  ☐ Test X passes                            │
│  ☐ No regressions in Y                      │
├─────────────────────────────────────────────┤
│  FOOTER: Source artifacts + generated date   │
└─────────────────────────────────────────────┘
```

## Generation Workflow

### Step 1: Discover and Read Source

Resolve the source artifact. Read it fully, extracting:

- **Goal/Summary** → feeds header one-liner
- **Scope** → feeds file change map
- **Implementation Steps** → feeds code changes and data flow
- **Architecture decisions** → feeds key decisions section
- **Affected files** → feeds file change map and code snippets
- **Risks** → feeds risk cards
- **Verification** → feeds checklist
- **Phases** → feeds delivery shape timeline

### Step 2: Extract Architecture Signals

From the source artifact, identify and extract:

1. **Component relationships** — which modules/services interact
2. **Data flows** — how data moves through the system
3. **File changes** — what files are created, modified, or deleted
4. **Code patterns** — key code snippets that illustrate the approach
5. **Decision points** — architectural choices with rationale
6. **Dependencies** — between phases or components

### Step 3: Generate Mermaid Diagrams

Generate diagrams **ONLY from information in the source**. Never invent relationships.

**Architecture Overview Diagram** (always generate):
- If the source describes services/modules → `flowchart` with subgraphs
- If the source describes data flow → `flowchart LR`
- If the source describes user interactions → `sequenceDiagram`

**Data Flow / Sequence Diagram** (generate when the source describes):
- Request/response flows
- Data transformations
- Event-driven sequences
- Multi-step processes

**Delivery Shape Diagram** (generate for phased plans):
- Phase dependencies as a flowchart
- Show which phases can run in parallel vs sequential

### Step 4: Build File Change Map

Parse the source for file references. Classify each as:
- **NEW** (green badge) — file is being created
- **MODIFY** (amber badge) — existing file is being changed
- **DELETE** (red badge) — file is being removed
- **DEPS** (blue badge) — dependency change (package.json, etc.)

Extract from:
- "Affected Files" sections in plans
- File paths mentioned in implementation steps
- Import statements in code snippets
- Explicit create/modify/delete markers

### Step 5: Render Code Snippets

For each significant code change mentioned in the source:

1. If the source contains **inline code blocks** → render with syntax highlighting
2. If the source describes a change but doesn't show code → generate a **representative snippet** that illustrates the pattern (mark it as "illustrative" with a badge)
3. If the source has **before/after patterns** → render as a diff-style block

Code snippet rules:
- Always label the language for syntax highlighting
- Include the file path as a caption
- Mark illustrative snippets clearly (they're not copied from source, they're pattern demonstrations)
- Keep snippets focused — show the key change, not entire files

### Step 6: Assemble the HTML

Use the blueprint HTML template from `references/blueprint-template.html` in this skill directory. The template includes:
- Complete CSS (inline, no external dependencies except Mermaid CDN)
- Syntax highlighting via CSS classes
- Responsive layout
- Print-friendly styles
- Dark mode support

### Step 7: Write and Report

Write to `presentations/<slug>/blueprint.html` and report:

```
Blueprint generated:
  presentations/<slug>/blueprint.html

Sections:
  - Architecture Overview (diagram)
  - File Change Map (N files)
  - Code Changes (N snippets)
  - Data Flow (diagram)
  - Key Decisions (N items)
  - Risks (N items)
  - Delivery Shape (N phases)
  - Verification (N checks)

Source: <source-artifact-path>
```

## Code Snippet Rendering

### Syntax Highlighting Approach

The blueprint uses **CSS-based syntax highlighting** with no JavaScript highlighting library. Define color classes for common token types:

```css
.code-block .kw { color: #c678dd; }   /* keyword */
.code-block .fn { color: #61afef; }   /* function */
.code-block .st { color: #98c379; }   /* string */
.code-block .cm { color: #5c6370; }   /* comment */
.code-block .nu { color: #d19a66; }   /* number */
.code-block .op { color: #56b6c2; }   /* operator */
.code-block .ty { color: #e5c07b; }   /* type */
```

When generating code snippets, wrap tokens in appropriate `<span class="kw">` etc. For long snippets or when syntax highlighting is impractical, use plain `<pre><code>` blocks — they're still readable.

### Diff-Style Blocks

For before/after comparisons, use a split layout:

```html
<div class="diff-block">
  <div class="diff-before">
    <div class="diff-caption">Before — routes/auth.js</div>
    <pre><code>old code here</code></pre>
  </div>
  <div class="diff-after">
    <div class="diff-caption">After — routes/auth.js</div>
    <pre><code>new code here</code></pre>
  </div>
</div>
```

For inline diffs (single file changes), use `diff-add` and `diff-remove` line highlighting:

```css
.diff-add { background: rgba(22, 163, 74, 0.15); }
.diff-remove { background: rgba(220, 38, 38, 0.15); }
```

### Illustrative Snippet Badge

When generating a code snippet that demonstrates a pattern (not copied from source):

```html
<span class="badge badge-info">illustrative</span>
```

## Diagram Generation Rules

### What Gets a Diagram

Always generate:
- **Architecture Overview** — shows the high-level component/service relationship
- **Delivery Shape** — shows phase timeline (for phased plans)

Generate when the source describes:
- Multi-step data flow → **sequence diagram**
- Component interactions → **flowchart**
- State transitions → **state diagram**
- File dependencies → **flowchart** with file nodes

Do NOT generate when:
- Only one file is changing
- The change is trivial (rename, config update)
- The source doesn't describe any relationships

### Mermaid Patterns

**System architecture:**
```
flowchart TB
  subgraph "Client Layer"
    A[Browser]
  end
  subgraph "API Layer"
    B[Auth Middleware]
    C[Route Handler]
  end
  subgraph "Data Layer"
    D[(SQLite)]
    E[Cache]
  end
  A --> B --> C --> D
  C --> E
```

**Data flow (sequence):**
```
sequenceDiagram
  participant U as User
  participant A as API
  participant S as Service
  participant D as Database
  U->>A: POST /api/links
  A->>S: createLink()
  S->>D: INSERT INTO links
  D-->>S: {id, code}
  S-->>A: {shortUrl, qr}
  A-->>U: 201 Created
```

**Phase timeline:**
```
flowchart LR
  P1["Phase 1<br/>Auth Setup"] --> P2["Phase 2<br/>API Routes"]
  P2 --> P3["Phase 3<br/>Frontend"]
  P3 --> P4["Phase 4<br/>Testing"]
```

**File dependency map:**
```
flowchart TB
  subgraph NEW
    N1[services/auth.js]
    N2[middleware/validate.js]
  end
  subgraph MODIFIED
    M1[routes/api.js]
    M2[server.js]
  end
  N1 --> M1
  N2 --> M1
  M1 --> M2
```

## File Change Map

The file change map is a table with visual action badges:

| Column | Content |
|--------|---------|
| File | Relative path from project root |
| Action | `NEW` / `MODIFY` / `DELETE` / `DEPS` badge |
| Layer | `frontend` / `backend` / `database` / `infra` / `config` |
| Description | One-line summary of the change |

Group by action type (NEW first, then MODIFY, then DELETE) for quick scanning.

## Visual System

The blueprint has a **dark-first aesthetic** optimized for technical readability:

- Dark background (`#0d1117`) — easy on eyes for long review sessions
- Monospace code blocks with syntax colors matching VS Code dark theme
- Color-coded badges for file actions and severity
- Generous spacing between sections
- Print-friendly: switches to light theme with `@media print`
- Responsive: stacks to single column on mobile

Read `references/blueprint-template.html` for the complete HTML/CSS boilerplate.

## Error Handling

- **No source found**: "No plan, phase, brainstorm, or spec found. Provide a path or ensure artifacts exist in `.context/`."
- **Source has no file references**: Skip file change map, note in output.
- **Source has no code snippets**: Skip code changes section, generate architecture diagram from prose.
- **Source is minimal**: Generate whatever sections are possible, skip the rest. Don't pad with filler.

## Integration with Buck Workflow

| Command | When to blueprint |
|---------|-------------------|
| `/b-plan` | After planning — visualize before building |
| `/b-phase` | After phasing — show phase architecture |
| `/b-brainstorm` | After brainstorming — sketch the direction |
| `/b-build` | Reference during implementation |
| `/b-review` | Review blueprint accuracy against what was built |
| `/b-present` | Coexists — blueprint for engineers, briefing for stakeholders |

**Typical flow**: `b-plan` → `b-blueprint` → review → `b-build`

## What NOT to Do

- Do NOT invent architecture that isn't in the source — only visualize what's described
- Do NOT write multiple HTML files — this is a single-page blueprint
- Do NOT add JavaScript frameworks — pure HTML/CSS + Mermaid CDN only
- Do NOT include full file contents in code snippets — show the relevant change only
- Do NOT generate diagrams for trivial single-file changes
- Do NOT make the blueprint a replacement for b-present — different purposes
