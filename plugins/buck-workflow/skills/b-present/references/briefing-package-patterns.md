# Briefing Package HTML Patterns

Semantic HTML/CSS patterns for b-present presentation packages. No build step required.

## Package Structure

```
presentations/<slug>/
├── index.html          # Primary overview (most polished)
├── architecture.html   # Optional detail page (simpler)
├── phases.html         # Optional detail page (simpler)
├── verification.html   # Optional detail page (simpler)
├── appendix.html       # Optional detail page (simpler)
├── assets/
│   ├── styles.css      # Shared stylesheet
│   └── render-md.js    # Client-side markdown renderer (for source views)
├── sources/            # Copied markdown source artifacts
│   └── <source>.md
└── manifest.json       # Semi-public package metadata
```

## manifest.json Schema

```json
{
  "slug": "<slug>",
  "title": "<Presentation Title>",
  "generated": "2026-05-09T14:30:00Z",
  "sourceArtifacts": [
    ".context/YYYY-MM-DD.subject/plan-topic.md",
    ".context/YYYY-MM-DD.subject/plan-topic-phases.md"
  ],
  "pages": [
    { "file": "index.html", "type": "overview", "title": "Overview" },
    { "file": "phases.html", "type": "detail", "title": "Phase Details" }
  ],
  "sources": ["sources/plan-topic.md", "sources/plan-topic-phases.md"]
}
```

## Shared Stylesheet (assets/styles.css)

### CSS Custom Properties

```css
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;

  /* Light theme (default) */
  --bg-primary: #ffffff;
  --bg-secondary: #f6f8fa;
  --bg-tertiary: #eef1f5;
  --text-primary: #1a1a2e;
  --text-secondary: #4a4a68;
  --text-muted: #6b7280;
  --border-color: #e2e8f0;
  --accent: #2563eb;
  --accent-light: #dbeafe;
  --success: #16a34a;
  --warning: #d97706;
  --danger: #dc2626;

  --max-width: 960px;
  --sidebar-width: 240px;
  --spacing: 1.5rem;
}
```

### Base Reset & Typography

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-sans);
  line-height: 1.6;
  color: var(--text-primary);
  background: var(--bg-primary);
}

h1, h2, h3, h4 { line-height: 1.25; margin-bottom: 0.75rem; }
h1 { font-size: 2rem; }
h2 { font-size: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; }
h3 { font-size: 1.25rem; }

p { margin-bottom: 1rem; }
ul, ol { margin-left: 1.5rem; margin-bottom: 1rem; }

code { font-family: var(--font-mono); background: var(--bg-tertiary); padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.9em; }
pre { background: var(--bg-secondary); padding: 1rem; border-radius: 6px; overflow-x: auto; margin-bottom: 1rem; }
pre code { background: none; padding: 0; }

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
```

### Layout: Overview Page (index.html — most polished)

```css
/* Sticky sidebar layout for wide screens */
.page-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: var(--sidebar-width);
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  padding: var(--spacing);
  flex-shrink: 0;
}

.sidebar h1 { font-size: 1.1rem; margin-bottom: 1rem; }
.sidebar nav ul { list-style: none; margin-left: 0; }
.sidebar nav li { margin-bottom: 0.5rem; }
.sidebar nav a { color: var(--text-secondary); display: block; padding: 0.25rem 0; }
.sidebar nav a:hover { color: var(--accent); }
.sidebar nav a.active { color: var(--accent); font-weight: 600; }

.main-content {
  flex: 1;
  max-width: var(--max-width);
  padding: var(--spacing);
  margin: 0 auto;
}

/* Responsive: collapsible top nav on narrow screens */
@media (max-width: 768px) {
  .page-layout { flex-direction: column; }
  .sidebar {
    position: relative;
    width: 100%;
    height: auto;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }
}
```

### Detail Page Layout (simpler)

```css
.detail-page {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: var(--spacing);
}

.detail-page .back-link {
  display: inline-block;
  margin-bottom: 1.5rem;
  color: var(--text-muted);
}
.detail-page .back-link:hover { color: var(--accent); }
```

### Source View Layout (utilitarian)

```css
.source-view {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: var(--spacing);
  font-family: var(--font-mono);
  font-size: 0.9rem;
  line-height: 1.7;
}

.source-view .back-link {
  display: inline-block;
  margin-bottom: 1rem;
  color: var(--text-muted);
}

.source-view .rendered-content {
  font-family: var(--font-sans);
}
```

### Card & Section Components

```css
/* Card links to detail pages (used on overview) */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1rem;
  transition: box-shadow 0.15s ease;
}
.card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-decoration: none; }
.card h4 { margin-bottom: 0.5rem; }
.card p { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0; }

/* Status badges */
.badge {
  display: inline-block;
  padding: 0.15em 0.6em;
  border-radius: 999px;
  font-size: 0.75em;
  font-weight: 600;
  text-transform: uppercase;
}
.badge-success { background: #dcfce7; color: var(--success); }
.badge-warning { background: #fef3c7; color: var(--warning); }
.badge-danger  { background: #fee2e2; color: var(--danger); }
.badge-info    { background: var(--accent-light); color: var(--accent); }

/* Conflict warning banner */
.conflict-banner {
  background: #fef3c7;
  border-left: 4px solid var(--warning);
  padding: 1rem;
  margin-bottom: 1.5rem;
  border-radius: 0 6px 6px 0;
}
.conflict-banner h4 { color: var(--warning); margin-bottom: 0.5rem; }

/* Risk cards */
.risk-card {
  border-left: 4px solid var(--danger);
  background: var(--bg-secondary);
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
  border-radius: 0 6px 6px 0;
}

/* Table styles */
.table-wrapper { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border-color); }
th { background: var(--bg-secondary); font-weight: 600; font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.05em; }

/* Mermaid diagram container */
.mermaid-container {
  text-align: center;
  margin: 1.5rem 0;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 6px;
}
```

## Overview Page Skeleton (index.html)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{TITLE}}</title>
  <link rel="stylesheet" href="assets/styles.css">
  <!-- Mermaid CDN for diagrams -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <script>mermaid.initialize({ startOnLoad: true, theme: 'default' });</script>
</head>
<body>
  <div class="page-layout">
    <!-- Sticky Sidebar Navigation -->
    <aside class="sidebar">
      <h1>{{SHORT_TITLE}}</h1>
      <nav>
        <ul>
          <li><a href="#summary" class="active">Summary</a></li>
          <li><a href="#why">Why</a></li>
          <li><a href="#what-changes">What Changes</a></li>
          <li><a href="#how-it-works">How It Works</a></li>
          <li><a href="#delivery">Delivery</a></li>
          <li><a href="#risks">Risks & Conflicts</a></li>
          <li><a href="#sources">Sources</a></li>
          <!-- Conditional sections -->
          <!-- <li><a href="#open-questions">Open Questions</a></li> -->
        </ul>
        <!-- Card links to detail pages (when they exist) -->
        <!-- <h4 style="margin-top:1rem;">Detail Pages</h4>
        <ul>
          <li><a href="phases.html">Phase Details</a></li>
          <li><a href="architecture.html">Architecture</a></li>
        </ul> -->
      </nav>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <h1>{{TITLE}}</h1>
      <p class="text-muted">{{DATE}} · {{SUBJECT}}</p>

      <!-- Conflict banner (conditional, only when parent/phase plans contradict) -->
      <!-- <div class="conflict-banner">
        <h4>⚠ Conflicts Detected</h4>
        <p>Parent plan and phased plan disagree on: ...</p>
      </div> -->

      <section id="summary">
        <h2>Summary</h2>
        <p>One-paragraph overview of the plan/purpose.</p>
      </section>

      <section id="why">
        <h2>Why</h2>
        <p>Motivation, context, background.</p>
      </section>

      <section id="what-changes">
        <h2>What Changes</h2>
        <p>Key modifications, affected areas.</p>
        <!-- Optional: card grid linking to detail pages -->
      </section>

      <section id="how-it-works">
        <h2>How It Works</h2>
        <p>Technical approach, architecture.</p>
        <div class="mermaid-container">
          <div class="mermaid">
            flowchart LR
              A[Component] --> B[Service] --> C[Data]
          </div>
        </div>
      </section>

      <section id="delivery">
        <h2>Delivery Shape</h2>
        <p>Implementation steps, phasing, timeline.</p>
      </section>

      <section id="risks">
        <h2>Risks & Conflicts</h2>
        <div class="risk-card">
          <strong>Risk:</strong> Description and mitigation.
        </div>
      </section>

      <!-- Open questions (conditional) -->
      <!-- <section id="open-questions">
        <h2>Open Questions</h2>
        <ul><li>Unresolved issue...</li></ul>
      </section> -->

      <section id="sources">
        <h2>Sources</h2>
        <ul>
          <li><a href="sources/plan-topic.md">plan-topic.md</a> (source view)</li>
        </ul>
      </section>
    </main>
  </div>
</body>
</html>
```

## Detail Page Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{PAGE_TITLE}} — {{SHORT_TITLE}}</title>
  <link rel="stylesheet" href="assets/styles.css">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <script>mermaid.initialize({ startOnLoad: true, theme: 'default' });</script>
</head>
<body>
  <div class="detail-page">
    <a href="index.html" class="back-link">← Back to overview</a>
    <h1>{{PAGE_TITLE}}</h1>

    <section>
      <h2>Details</h2>
      <p>Detailed content goes here.</p>
    </section>
  </div>
</body>
</html>
```

## Source View Template (renders markdown via client-side renderer)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{SOURCE_FILE}} — Source</title>
  <link rel="stylesheet" href="assets/styles.css">
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
</head>
<body>
  <div class="source-view">
    <a href="../index.html" class="back-link">← Back to overview</a>
    <h2>Source: {{SOURCE_FILE}}</h2>
    <div id="rendered-content" class="rendered-content">
      <!-- Client-side markdown renderer inserts HTML here -->
    </div>
  </div>
  <script src="../assets/render-md.js"></script>
  <script>
    renderSource('{{SOURCE_FILE}}');
  </script>
</body>
</html>
```

## Client-Side Markdown Renderer (assets/render-md.js)

Minimal markdown-to-HTML renderer for source views. Uses a simple regex-based approach or loads marked.js from CDN.

```javascript
// Requires the source view HTML to load marked.js before this file:
// <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

function renderSource(filename) {
  fetch(filename)
    .then(r => r.text())
    .then(md => {
      document.getElementById('rendered-content').innerHTML = marked.parse(md);
    })
    .catch(err => {
      document.getElementById('rendered-content').innerHTML =
        '<p class="error">Failed to load source: ' + err.message + '</p>';
    });
}
```

## Navigation Patterns

### Responsive Navigation

- **Wide screens (>768px)**: Sticky sidebar with section links + detail page links
- **Narrow screens (≤768px)**: Sidebar collapses to top bar; sections stack vertically

### Section Anchors

Each section on the overview page uses an `id` matching the nav link `href` fragment. Use `scroll-behavior: smooth` for pleasant scrolling:

```css
html { scroll-behavior: smooth; }
```

### Active Section Highlighting

Use IntersectionObserver to highlight the current section in the sidebar:

```javascript
document.querySelectorAll('.sidebar nav a').forEach(link => {
  const section = document.querySelector(link.getAttribute('href'));
  if (section) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
          link.classList.add('active');
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    observer.observe(section);
  }
});
```

## Mermaid Diagram Embedding

Diagrams work in any page type. Use the standard pattern:

```html
<div class="mermaid-container">
  <div class="mermaid">
    flowchart LR
      A[Client] --> B[API] --> C[Service] --> D[Database]
  </div>
</div>
```

Mermaid init in `<head>`:
```html
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script>mermaid.initialize({ startOnLoad: true, theme: 'default' });</script>
```

For dark-theme pages, use `theme: 'dark'` in the init config.
