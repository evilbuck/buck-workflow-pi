# Reveal.js Templates Reference

Complete HTML boilerplate and layout patterns for b-present presentations.

## CDN URLs

### Reveal.js 5.x (latest stable)
```
https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reset.css
https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.css
https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/black.css
https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/plugin/highlight/monokai.css
https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js
https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/plugin/highlight/highlight.js
https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/plugin/search/search.js
https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/plugin/notes/notes.js
```

### Mermaid Plugin
```
https://cdn.jsdelivr.net/npm/reveal.js-mermaid-plugin@11.12.3/plugin/mermaid/mermaid.js
```

### Alternative: Reveal.js 6.x (if available)
```
https://cdn.jsdelivr.net/npm/reveal.js@6.0.1/dist/reset.css
https://cdn.jsdelivr.net/npm/reveal.js@6.0.1/dist/reveal.css
https://cdn.jsdelivr.net/npm/reveal.js@6.0.1/dist/theme/black.css
https://cdn.jsdelivr.net/npm/reveal.js@6.0.1/dist/reveal.js
```

Use 5.1.0 as the safe default.

## Available Themes

Replace `black.css` with any of these:
- `black.css` — dark, minimal (default, best for diagrams)
- `white.css` — light, clean
- `league.css` — gray gradient
- `sky.css` — blue gradient
- `night.css` — dark with subtle gradient
- `moon.css` — dark blue
- `simple.css` — white with minimal chrome
- `solarized.css` — solarized color scheme
- `dracula.css` — dracula color scheme
- `blood.css` — dark red accent

## Complete HTML Boilerplate

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{TITLE}}</title>

  <!-- Reveal.js Core -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reset.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/black.css" id="theme">

  <!-- Code Highlighting -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/plugin/highlight/monokai.css">

  <!-- Custom Styles -->
  <style>
    .reveal h1, .reveal h2, .reveal h3 {
      text-transform: none;
    }
    .reveal section {
      text-align: left;
    }
    .reveal h2.r-fit-text, .reveal h3.r-fit-text {
      text-align: center;
    }
    .reveal .mermaid {
      text-align: center;
    }
    .two-column {
      display: flex;
      gap: 2rem;
    }
    .two-column > div {
      flex: 1;
    }
    .scope-in h4 { color: #17ff2e; }
    .scope-out h4 { color: #ff4444; }
    .risk-card {
      background: rgba(255,255,255,0.05);
      border-left: 4px solid #ff6b6b;
      padding: 0.5rem 1rem;
      margin: 0.5rem 0;
      font-size: 0.8em;
    }
    .checklist li {
      list-style: none;
    }
    .checklist li::before {
      content: '☐ ';
      color: #888;
    }
    .checklist li.done::before {
      content: '☑ ';
      color: #17ff2e;
    }
    table {
      font-size: 0.75em;
      border-collapse: collapse;
      width: 100%;
    }
    table th, table td {
      border: 1px solid rgba(255,255,255,0.2);
      padding: 0.4rem 0.8rem;
    }
    table th {
      background: rgba(255,255,255,0.1);
    }
    .tag {
      display: inline-block;
      padding: 0.1rem 0.5rem;
      border-radius: 3px;
      font-size: 0.7em;
      margin-right: 0.3rem;
    }
    .tag-easy { background: #1a7a1a; }
    .tag-medium { background: #7a7a1a; }
    .tag-hard { background: #7a1a1a; }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">

      <!-- TITLE SLIDE -->
      <section>
        <h2 class="r-fit-text">{{TITLE}}</h2>
        <p style="text-align: center;">
          <small>{{SUBTITLE}} • {{DATE}}</small>
        </p>
      </section>

      <!-- WHY SLIDE -->
      <section>
        <h3>Why This Matters</h3>
        <ul>
          <li>{{MOTIVATION_1}}</li>
          <li>{{MOTIVATION_2}}</li>
        </ul>
        <aside class="notes">
          {{NOTES_WHY}}
        </aside>
      </section>

      <!-- ARCHITECTURE OVERVIEW (MERMAID) -->
      <section>
        <h3>Architecture Overview</h3>
        <div class="mermaid" style="font-size: 0.65em;">
          %%{init: {'theme': 'dark', 'themeVariables': { 'darkMode': true }}}%%
          flowchart LR
            %% Replace with actual architecture
            A[Client] --> B[API Gateway]
            B --> C[Service Layer]
            C --> D[(Database)]
        </div>
        <aside class="notes">
          {{NOTES_ARCHITECTURE}}
        </aside>
      </section>

      <!-- SCOPE (TWO-COLUMN) -->
      <section>
        <h3>Scope</h3>
        <div class="two-column">
          <div class="scope-in">
            <h4>✅ In Scope</h4>
            <ul>
              <li>{{IN_SCOPE_1}}</li>
              <li>{{IN_SCOPE_2}}</li>
            </ul>
          </div>
          <div class="scope-out">
            <h4>❌ Out of Scope</h4>
            <ul>
              <li>{{OUT_SCOPE_1}}</li>
              <li>{{OUT_SCOPE_2}}</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- AFFECTED FILES -->
      <section>
        <h3>Affected Files</h3>
        <table>
          <thead>
            <tr><th>File</th><th>Purpose</th></tr>
          </thead>
          <tbody>
            <tr><td><code>path/to/file1</code></td><td>{{DESC_1}}</td></tr>
            <tr><td><code>path/to/file2</code></td><td>{{DESC_2}}</td></tr>
          </tbody>
        </table>
      </section>

      <!-- IMPLEMENTATION STEPS (FRAGMENTS) -->
      <section>
        <h3>Implementation Steps</h3>
        <ol>
          <li class="fragment">{{STEP_1}}</li>
          <li class="fragment">{{STEP_2}}</li>
          <li class="fragment">{{STEP_3}}</li>
          <li class="fragment">{{STEP_4}}</li>
        </ol>
        <aside class="notes">
          {{NOTES_STEPS}}
        </aside>
      </section>

      <!-- REQUEST FLOW (SEQUENCE) -->
      <section>
        <h3>Request Flow</h3>
        <div class="mermaid" style="font-size: 0.65em;">
          %%{init: {'theme': 'dark', 'themeVariables': { 'darkMode': true }}}%%
          sequenceDiagram
            participant C as Client
            participant A as API
            participant S as Service
            participant D as Database
            C->>A: HTTP Request
            A->>S: Process
            S->>D: Query
            D-->>S: Result
            S-->>A: Response
            A-->>C: HTTP Response
        </div>
        <aside class="notes">
          {{NOTES_FLOW}}
        </aside>
      </section>

      <!-- RISKS -->
      <section>
        <h3>Risks & Unknowns</h3>
        <div class="risk-card">
          <strong>{{RISK_1_TITLE}}</strong><br>
          {{RISK_1_DESC}}
        </div>
        <div class="risk-card">
          <strong>{{RISK_2_TITLE}}</strong><br>
          {{RISK_2_DESC}}
        </div>
      </section>

      <!-- VERIFICATION -->
      <section>
        <h3>Verification</h3>
        <ul class="checklist">
          <li>{{CRITERIA_1}}</li>
          <li>{{CRITERIA_2}}</li>
          <li>{{CRITERIA_3}}</li>
        </ul>
      </section>

      <!-- NEXT STEPS -->
      <section>
        <h3>Next Steps</h3>
        <ul>
          <li>{{NEXT_1}}</li>
          <li>{{NEXT_2}}</li>
        </ul>
        <p style="text-align: center; margin-top: 2rem;">
          <small>Generated by <code>b-present</code> • Source: <code>{{SOURCE_FILE}}</code></small>
        </p>
      </section>

    </div>
  </div>

  <!-- Reveal.js Scripts -->
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/plugin/highlight/highlight.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/plugin/search/search.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/plugin/notes/notes.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js-mermaid-plugin@11.12.3/plugin/mermaid/mermaid.js"></script>

  <script>
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
      slideNumber: true,
      showSlideNumber: 'all',
      plugins: [RevealMermaid, RevealHighlight, RevealNotes, RevealSearch]
    });
  </script>
</body>
</html>
```

## Phased Plan Template

Additional slides for phased plans (insert after scope, before verification):

```html
<!-- PHASE OVERVIEW -->
<section>
  <h3>Phase Overview</h3>
  <table>
    <thead>
      <tr><th>Phase</th><th>Difficulty</th><th>Files</th><th>Depends On</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>1: {{PHASE_1_NAME}}</td>
        <td><span class="tag tag-{{PHASE_1_DIFF}}">{{PHASE_1_DIFF}}</span></td>
        <td>{{PHASE_1_FILE_COUNT}} files</td>
        <td>—</td>
      </tr>
      <tr>
        <td>2: {{PHASE_2_NAME}}</td>
        <td><span class="tag tag-{{PHASE_2_DIFF}}">{{PHASE_2_DIFF}}</span></td>
        <td>{{PHASE_2_FILE_COUNT}} files</td>
        <td>Phase 1 (HARD)</td>
      </tr>
    </tbody>
  </table>
  <aside class="notes">
    {{NOTES_PHASES}}
  </aside>
</section>

<!-- DEPENDENCY DIAGRAM -->
<section>
  <h3>Phase Dependencies</h3>
  <div class="mermaid" style="font-size: 0.65em;">
    %%{init: {'theme': 'dark'}}%%
    flowchart LR
      P1[Phase 1: {{PHASE_1_NAME}}]
      P2[Phase 2: {{PHASE_2_NAME}}]
      P3[Phase 3: {{PHASE_3_NAME}}]
      P1 -->|HARD| P2
      P2 -.->|SOFT| P3
  </div>
  <aside class="notes">
    HARD = blocking dependency. SOFT = can stub/mock.
  </aside>
</section>

<!-- PHASE DETAIL (repeat per phase) -->
<section>
  <section>
    <h3>Phase {{N}}: {{PHASE_NAME}}</h3>
    <p><span class="tag tag-{{DIFFICULTY}}">{{DIFFICULTY}}</span></p>
    <ul>
      <li><strong>Goal:</strong> {{GOAL}}</li>
      <li><strong>Files:</strong> {{FILES}}</li>
    </ul>
  </section>
  <section>
    <h3>Phase {{N}}: Implementation</h3>
    <ol>
      <li class="fragment">{{STEP_1}}</li>
      <li class="fragment">{{STEP_2}}</li>
    </ol>
    <aside class="notes">
      {{NOTES_PHASE_N}}
    </aside>
  </section>
  <section>
    <h3>Phase {{N}}: Acceptance Criteria</h3>
    <ul class="checklist">
      <li>{{CRITERIA_1}}</li>
      <li>{{CRITERIA_2}}</li>
    </ul>
  </section>
</section>
```

## Vertical Slides (Drill-Down)

Use nested `<section>` for sub-detail under a main slide:

```html
<section>
  <!-- Main slide (horizontal) -->
  <section>
    <h3>Implementation</h3>
    <p>4 phases, ~3 weeks estimated</p>
    <p><small>↓ Scroll down for details</small></p>
  </section>
  <!-- Detail slides (vertical) -->
  <section>
    <h3>Step 1: Database Schema</h3>
    <pre><code class="language-sql">CREATE TABLE orders (...);</code></pre>
  </section>
  <section>
    <h3>Step 2: API Endpoints</h3>
    <pre><code class="language-javascript">router.post('/orders', ...);</code></pre>
  </section>
</section>
```

## Fragment Patterns

```html
<!-- Fade in one by one -->
<li class="fragment">Item</li>

<!-- Custom fragment styles -->
<span class="fragment fade-up">Appears rising</span>
<span class="fragment fade-left">Slides from right</span>
<span class="fragment grow">Grows in</span>
<span class="fragment shrink">Shrinks in</span>
<span class="fragment highlight-red">Highlights red</span>
<span class="fragment highlight-blue">Highlights blue</span>

<!-- Stack multiple elements (show one at a time) -->
<div class="r-stack">
  <img class="fragment" src="diagram-v1.svg" width="80%">
  <img class="fragment" src="diagram-v2.svg" width="80%">
  <img class="fragment" src="diagram-v3.svg" width="80%">
</div>
```

## Code Blocks

```html
<!-- Simple code block -->
<pre><code class="language-typescript" data-trim>
export async function createOrder(data: OrderInput) {
  const order = await db.orders.create(data);
  return order;
}
</code></pre>

<!-- Line highlighting -->
<pre><code class="language-typescript" data-trim data-line-numbers="1-2|4-6|8">
import { Router } from 'express';
const router = Router();

router.post('/orders', async (req, res) => {
  const order = await createOrder(req.body);
  res.json(order);
});

export default router;
</code></pre>
```

## Background Colors/Gradients

```html
<!-- Solid color -->
<section data-background="#1a1a2e">
  <h3>Custom Background</h3>
</section>

<!-- Gradient -->
<section data-background-gradient="linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)">
  <h3>Gradient Background</h3>
</section>
```
