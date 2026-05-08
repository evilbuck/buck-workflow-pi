---
name: b-present
description: Generate a Reveal.js slide deck from plans, phases, brainstorms, specs, or other .context/ artifacts. Produces a self-contained HTML presentation with Mermaid diagrams for architecture overviews, system flows, and request routing. Use after b-plan, b-phase, or b-brainstorm to create shareable human-readable presentations. Trigger with /b-present or /skill:b-present.
---

# b-present: Context-to-Presentation

Transform `.context/` artifacts (plans, phases, brainstorms, specs) into a polished Reveal.js slide deck with Mermaid diagrams. Present architecture overviews, system flows, request routing, and implementation plans as navigable HTML slides.

## When to Use

- After `b-plan` or `b-phase` — share the plan visually
- After `b-brainstorm` — present the brainstorm output
- When someone asks "can you present this?" or "make slides from this plan?"
- When you need to communicate architecture/system design to stakeholders
- Explicitly via `/b-present` or `/skill:b-present`

## Input Resolution

1. **Explicit path** provided by user → use that
2. **Phased plan** → look for `plan-*-phases.md` overview + discrete `phase-N-*.md` files
3. **Single plan** → newest `plan-*.md` in subject folders
4. **Brainstorm** → `brainstorm-*.md` or brainstorm state JSON in subject folder
5. **Spec** → `spec-*.md` in subject folders
6. **Grill session** → `grill-session-*.md` in subject folder (present findings/decisions)
7. Fail with clear message if nothing found

```bash
# Discovery commands
ls -lt .context/*.* 2>/dev/null
find .context/ -name "plan-*.md" -o -name "plan-*-phases.md" -o -name "phase-*-*.md" | sort
find .context/ -name "grill-session-*.md" | sort
find .context/ -name "brainstorm-*" | sort
find .context/ -name "spec-*.md" | sort
```

## Write Boundary

- Write only to: `.context/YYYY-MM-DD.<subject>/presentations/`
- Do not modify source artifacts
- Do not write outside `.context/`

## Output Structure

```
.context/YYYY-MM-DD.<subject>/presentations/
└── <slug>-presentation.html    # Self-contained single file
```

**One HTML file** — everything embedded (CSS, JS, Mermaid, speaker notes). No network required after first load.

## Slide Deck Structure

### Section Mapping by Source Type

The slide structure adapts to the source artifact:

#### Plan → Slides

| Slide | Content | Visual Treatment |
|-------|---------|-----------------|
| **Title** | Plan goal, date, subject | Large centered text, `r-fit-text` |
| **Why** | Motivation, context, background | Bullet points with key phrases highlighted |
| **Architecture Overview** | High-level system diagram | Mermaid flowchart (inferred from files/steps) |
| **Scope** | In-scope / out-of-scope | Two-column layout |
| **Affected Files** | Files with descriptions | Compact list with directory grouping |
| **Implementation Steps** | Numbered steps from plan | One step per sub-slide (vertical), or fragments |
| **Data Flow** | How data moves through the system | Mermaid sequence/flowchart |
| **Risks & Unknowns** | Identified risks | Warning-styled cards |
| **Verification** | Acceptance criteria | Checklist with ✓/✗ indicators |
| **Next Steps** | Recommended follow-up | Linked to next Buck workflow step |

#### Phased Plan → Slides

| Slide | Content |
|-------|---------|
| **Title** | Plan name, total phases, difficulty mix |
| **Phase Overview** | Summary table (phase, status, difficulty) |
| **Dependency Diagram** | Mermaid graph of phase dependencies |
| **Phase N Detail** (repeated) | Goal, files, implementation, acceptance criteria |
| **Execution Order** | Timeline/sequence of phases |
| **Parallel Opportunities** | Which phases can run concurrently |

#### Brainstorm → Slides

| Slide | Content |
|-------|---------|
| **Title** | Topic, date |
| **Problem Statement** | What was brainstormed |
| **Ideas Generated** | Key ideas as cards/bullets |
| **Top Concepts** | Expanded detail on strongest ideas |
| **Open Questions** | Unresolved areas |
| **Next Steps** | Recommended follow-up (e.g., `/b-plan`) |

#### Spec → Slides

| Slide | Content |
|-------|---------|
| **Title** | Spec name, type (epic/PRD/milestone) |
| **Goal** | One-sentence objective |
| **Context** | Why this spec exists |
| **Requirements** | Must-have / should-have split |
| **Architecture** | System diagram from requirements |
| **Acceptance Criteria** | Checkable outcomes |
| **Implementation Plans** | Linked plan files |
| **Dependencies** | Other specs/packages needed |

## Diagram Generation Rules

Generate Mermaid diagrams ONLY from information present in the source artifacts. Do not invent relationships, services, or data flows.

### When to Generate Diagrams

Generate a diagram when the source contains:
- **Multiple files/directories** that interact → `flowchart`
- **Steps in a sequence** (implementation plan, request flow) → `flowchart LR` or `sequenceDiagram`
- **System boundaries or services** mentioned → `flowchart` with subgraphs
- **Phase dependencies** → `flowchart` with labeled edges
- **User/stakeholder interactions** → `sequenceDiagram`

### Diagram Types

| Source Pattern | Mermaid Type | Example |
|---------------|-------------|---------|
| Files in different directories | `flowchart LR` | `src/api/ --> src/services/ --> src/db/` |
| Steps 1→2→3→4 | `flowchart TD` | Sequential flow top-down |
| Client → Server → DB | `sequenceDiagram` | Request routing |
| Services within boundaries | `flowchart` + `subgraph` | Architecture overview |
| Phase dependencies | `flowchart LR` | `Phase1 -->|HARD| Phase2 -->|SOFT| Phase3` |

### Mermaid in Reveal.js

Use the `reveal.js-mermaid-plugin`. Diagram markup goes inside `<div class="mermaid">`:

```html
<section>
  <h3>Architecture Overview</h3>
  <div class="mermaid">
    flowchart LR
      Client --> API --> Service --> DB
  </div>
</section>
```

For dark themes, add Mermaid init:
```
%%{init: {'theme': 'dark', 'themeVariables': { 'darkMode': true }}}%%
```

## HTML Template

Read `references/revealjs-templates.md` in this skill directory for:
- CDN URLs (Reveal.js 5.x from jsdelivr, Mermaid plugin)
- Complete HTML boilerplate
- Slide layout patterns (two-column, code blocks, diagrams, fragments)
- Theme configuration

## Slide Layout Patterns

### Title Slide
```html
<section>
  <h2 class="r-fit-text">Plan Title</h2>
  <p><small>Subject: YYYY-MM-DD.topic • Date</small></p>
</section>
```

### Two-Column (Scope)
```html
<section>
  <h3>Scope</h3>
  <div style="display: flex; gap: 2rem;">
    <div style="flex: 1;">
      <h4>✅ In Scope</h4>
      <ul><li>Item 1</li><li>Item 2</li></ul>
    </div>
    <div style="flex: 1;">
      <h4>❌ Out of Scope</h4>
      <ul><li>Item 3</li><li>Item 4</li></ul>
    </div>
  </div>
</section>
```

### Step-by-Step with Fragments
```html
<section>
  <h3>Implementation Steps</h3>
  <ol>
    <li class="fragment">Create database schema</li>
    <li class="fragment">Implement API endpoints</li>
    <li class="fragment">Build frontend components</li>
    <li class="fragment">Write integration tests</li>
  </ol>
</section>
```

### Architecture Diagram
```html
<section>
  <h3>System Architecture</h3>
  <div class="mermaid" style="font-size: 0.7em;">
    %%{init: {'theme': 'dark'}}%%
    flowchart LR
      subgraph Client
        A[React App]
      end
      subgraph Server
        B[API Gateway]
        C[Auth Service]
        D[Business Logic]
      end
      subgraph Data
        E[(PostgreSQL)]
        F[(Redis Cache)]
      end
      A --> B --> C --> D --> E
      D --> F
  </div>
</section>
```

### Request Flow (Sequence Diagram)
```html
<section>
  <h3>Request Flow</h3>
  <div class="mermaid" style="font-size: 0.7em;">
    sequenceDiagram
      participant C as Client
      participant A as API
      participant S as Service
      participant D as Database
      C->>A: POST /api/orders
      A->>A: Validate & Auth
      A->>S: createOrder(data)
      S->>D: INSERT order
      D-->>S: order_id
      S-->>A: Order created
      A-->>C: 201 Created
  </div>
</section>
```

### Phase Overview Table
```html
<section>
  <h3>Phase Summary</h3>
  <table>
    <thead>
      <tr><th>Phase</th><th>Status</th><th>Difficulty</th><th>Key Files</th></tr>
    </thead>
    <tbody>
      <tr><td>1: Schema</td><td>⬜ Pending</td><td>Medium</td><td>db/migrations/</td></tr>
      <tr><td>2: API</td><td>⬜ Pending</td><td>Medium</td><td>src/api/</td></tr>
      <tr><td>3: Frontend</td><td>⬜ Pending</td><td>Hard</td><td>src/components/</td></tr>
    </tbody>
  </table>
</section>
```

## Speaker Notes

Add `<aside class="notes">` to slides that benefit from presenter context:

```html
<section>
  <h3>Architecture</h3>
  <div class="mermaid">...</div>
  <aside class="notes">
    The API gateway handles rate limiting and auth before
    routing to internal services. Redis cache reduces DB load
    by ~60% for read-heavy endpoints.
  </aside>
</section>
```

**Guidelines for speaker notes:**
- Add to every diagram slide explaining what the diagram shows
- Add to complex slides with implementation details
- Include non-obvious context (why, trade-offs, alternatives considered)
- Keep concise — 1-3 sentences

## Theme Selection

Default: `black` (dark background, white text — good for diagrams and code).

Available themes (via CDN):
- `black` — dark, minimal (default)
- `white` — light, clean
- `league` — gray gradient
- `sky` — blue gradient
- `night` — dark with subtle gradient
- `moon` — dark blue
- `simple` — white with minimal chrome
- `solarized` — solarized color scheme

The user can request a theme. If the source artifact has a lot of code, `monokai` code theme pairs well with `black`.

## Configuration Defaults

```javascript
Reveal.initialize({
  controls: true,
  progress: true,
  center: true,
  hash: true,
  transition: 'slide',
  backgroundTransition: 'fade',
  width: 1280,
  height: 720,
  margin: 0.1,
  plugins: [RevealMermaid, RevealNotes, RevealHighlight, RevealSearch]
});
```

## Workflow

### Step 1: Discover Source

Find the source artifact using the input resolution order above.

### Step 2: Read and Parse

Read the full source artifact. Extract:
- Frontmatter (status, date, subject, topics)
- Structured sections (goal, scope, steps, files, risks, verification)
- Phase data (if phased plan)
- Dependencies and relationships

If the source is a phased plan, also read:
- The phases overview (`plan-*-phases.md`)
- Each discrete phase file (`phase-N-*.md`)

### Step 3: Design Slide Structure

Map the source sections to slides using the section mapping tables above.

**Slide count guidelines:**
- Title + Why + 3-5 content slides + Next Steps = good range (6-8 slides)
- For phased plans: Title + Overview + (2-3 slides per phase) + Execution Order = 8-15 slides
- Maximum ~20 slides — if more, consolidate or use vertical sub-slides

### Step 4: Generate Diagrams

From the parsed content, determine which diagram types are appropriate:

1. **Architecture overview** — always try to generate if files span multiple directories or services
2. **Data/request flow** — generate if the plan describes interactions between components
3. **Dependency diagram** — generate for phased plans with inter-phase dependencies
4. **Sequence diagram** — generate if request routing or API calls are described

### Step 5: Write Presentation

Generate the self-contained HTML file following the template in `references/revealjs-templates.md`.

### Step 6: Report Output

```
Presentation generated:
  /absolute/path/to/.context/YYYY-MM-DD.subject/presentations/<slug>-presentation.html

Open in browser:
  file:///absolute/path/to/.context/YYYY-MM-DD.subject/presentations/<slug>-presentation.html

Slides: N | Diagrams: M | Source: plan-<topic>.md
```

## Error Handling

- **No source found**: "No plan, spec, or brainstorm found. Provide a path or ensure artifacts exist in `.context/`."
- **Source malformed**: Generate what you can, note missing sections in speaker notes.
- **Empty phases**: Skip phase detail slides, show overview only.

## Integration with Buck Workflow

| Command | Relationship |
|---------|-------------|
| `/b-plan` | Primary input source for presentations |
| `/b-phase` | Phased plans get dedicated phase slides |
| `/b-brainstorm` | Brainstorm output becomes presentation |
| `/b-build` | Can reference presentation for context during implementation |
| `/b-review` | Review the presentation for accuracy before sharing |

**Typical flow**: `b-plan` → `b-present` → `b-build` (or `b-plan` → `b-phase` → `b-present` → `b-build`)
