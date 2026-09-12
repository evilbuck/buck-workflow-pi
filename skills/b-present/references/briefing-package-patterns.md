# Briefing Package HTML Patterns

Semantic HTML/CSS patterns for `b-present` packages. No build step, no framework, no webfonts.

**Design language: `skills/_shared/design-brief.jsonc` is authoritative.** It defines the palette,
type scale, layout shell, component set, responsive breakpoints and Mermaid theme shared by every
HTML deliverable the workflow generates (`b-present` packages, `b-blueprint` posters, reports,
guides). Read it before inventing a class. The two generated blocks in this file are rendered from
it and pinned byte-for-byte by `skills/_shared/scripts/design-language.test.ts`:

```bash
bun skills/_shared/scripts/render-design-tokens.ts --write   # after editing the brief
```

Reference implementation: `presentations/2026-09-11.buck-vs-docker-orchestration-overlap/`.

## Package Structure

```
presentations/<slug>/
├── index.html          # Primary overview (full shell: masthead + rail + numbered sections)
├── architecture.html   # Optional detail page (simpler: back-link + content)
├── phases.html         # Optional detail page
├── verification.html   # Optional detail page
├── appendix.html       # Optional detail page
├── assets/
│   ├── styles.css      # Shared stylesheet — starts with the generated token block
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

### 1. Design tokens — generated, paste verbatim at the top of `styles.css`

```css
/* BEGIN generated:design-tokens · from skills/_shared/design-brief.jsonc · do not edit by hand · regenerate with bun skills/_shared/scripts/render-design-tokens.ts --write */
:root{
  /* surface */
  --bg:#f7f6f3;
  --panel:#ffffff;
  --sunk:#faf8f4;
  --chip:#efece6;
  /* ink */
  --ink:#1b1a18;
  --ink2:#3d3a36;
  --muted:#6f6862;
  /* rule */
  --line:#e6e1d9;
  --line2:#f0ece5;
  /* accent */
  --accent:#0f766e;
  --accentbg:#e6f5f3;
  --accentline:#bce8e1;
  --accentink:#155e56;
  /* series */
  --s1:#b4530b;
  --s1bg:#fdf1e3;
  --s1line:#f0d5b4;
  --s2:#2b57c4;
  --s2bg:#eaf0fd;
  --s2line:#c9d8f7;
  /* status */
  --ok:#1c6b3e;
  --okbg:#dff3e6;
  --okline:#c3e6d1;
  --warn:#8a6410;
  --warnbg:#fbf3d0;
  --warnline:#efe0a8;
  --danger:#a92222;
  --dangerbg:#fde8e8;
  --dangerline:#f6cfcf;
  --neutral:#5b554f;
  --neutralbg:#ecebe8;
  --neutralline:#dddad3;
  /* syntax */
  --syn-kw:#a1268f;
  --syn-fn:#2b57c4;
  --syn-st:#1c6b3e;
  --syn-cm:#8a8179;
  --syn-nu:#b4530b;
  --syn-ty:#8a6410;
  --syn-op:#0f766e;
  --diff-add:#e8f5ec;
  --diff-del:#fdeceb;
  /* form */
  --radius:14px;
  --radius-sm:12px;
  --shadow:0 1px 2px rgba(28,26,24,.05),0 8px 24px -16px rgba(28,26,24,.28);
  --wrap:1360px;
  --rail:264px;
  --measure:74ch;
  /* type */
  --font-sans:ui-sans-serif,-apple-system,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;
  --font-mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}
/* END generated:design-tokens */
```

### 2. Base reset & typography

```css
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:24px}
body{margin:0;background:var(--bg);color:var(--ink);
 font:16px/1.62 var(--font-sans);-webkit-font-smoothing:antialiased}
a{color:var(--accent)}
h1,h2,h3,h4,h5{line-height:1.25;letter-spacing:-.012em;margin:0}
p{margin:0 0 1em}
code{font-family:var(--font-mono);font-size:.855em;background:var(--chip);border:1px solid var(--line);
 border-radius:5px;padding:.06em .36em;color:var(--ink2);white-space:nowrap}
pre{margin:0;padding:14px 16px;overflow-x:auto;background:var(--sunk);border:1px solid var(--line);
 border-radius:var(--radius-sm);font-family:var(--font-mono);font-size:13px;line-height:1.55;color:var(--ink2)}
pre code{background:none;border:0;padding:0;white-space:pre}
.wrap{max-width:var(--wrap);margin:0 auto;padding:0 28px}
```

Weights: `550` quiet emphasis, `650` labels and headings, `680` numerals. Never `400`/`700`.

### 3. Masthead

Every overview page opens with eyebrow → `h1` → lede → pin row. The pins carry the metadata that
used to be a grey subtitle: source artifact, date, subject, counts.

```css
header.top{background:linear-gradient(180deg,#fffdfa,var(--bg));border-bottom:1px solid var(--line)}
header.top .wrap{padding-top:52px;padding-bottom:36px}
.eyebrow{font-size:12.5px;font-weight:650;letter-spacing:.11em;text-transform:uppercase;color:var(--accent);margin-bottom:14px}
h1{font-size:clamp(28px,3.6vw,44px);max-width:20ch;margin-bottom:14px}
.sub{font-size:18px;color:var(--ink2);max-width:66ch;margin-bottom:26px}
.pins{display:flex;flex-wrap:wrap;gap:12px}
.pin{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius-sm);padding:12px 16px;min-width:250px}
.pin .pname{font-weight:650;font-size:14.5px;display:flex;align-items:center;gap:8px}
.pin .pmeta{font-size:12.5px;color:var(--muted);margin-top:5px}
.pin .pmeta b{color:var(--ink2);font-weight:600}
.pin.a{border-left:3px solid var(--accent)} .pin.s1{border-left:3px solid var(--s1)} .pin.s2{border-left:3px solid var(--s2)}
```

### 4. Layout — content column + sticky rail

```css
.layout{display:grid;grid-template-columns:minmax(0,1fr) var(--rail);gap:56px;align-items:start}
main{min-width:0;padding:44px 0 110px}
aside{position:sticky;top:0;align-self:start;max-height:100vh;overflow-y:auto;padding:44px 0 60px;
 border-left:1px solid var(--line);padding-left:26px;scrollbar-width:thin}
aside h6{font-size:11.5px;letter-spacing:.11em;text-transform:uppercase;color:var(--muted);margin:0 0 12px;font-weight:650}
aside ul{list-style:none;margin:0;padding:0}
aside a{display:block;text-decoration:none;color:var(--ink2);padding:5px 10px;border-radius:7px;
 border-left:2px solid transparent;margin-left:-2px}
aside a.l1{font-size:13.8px;font-weight:550}
aside a.l2{font-size:12.9px;color:var(--muted);padding-left:16px}
aside a:hover{background:var(--chip);color:var(--ink)}
aside a.active{color:var(--accent);border-left-color:var(--accent);background:var(--accentbg);font-weight:650}
.toctoggle{display:none}

/* grid children must shrink or inner scrollers push the page wide instead of scrolling */
.layout>*,.cards>*,.tiles>*,.stack>*{min-width:0}
```

### 5. Sections — numbered, ruled, with a lede

```css
section.top-level{padding-top:8px;margin-bottom:56px;scroll-margin-top:20px}
h2{font-size:clamp(21px,2.3vw,27px);margin:0 0 6px;padding-bottom:12px;border-bottom:1px solid var(--line)}
h2 .h2n{color:var(--muted);font-weight:500;margin-right:12px;font-variant-numeric:tabular-nums}
.lede{font-size:16.5px;color:var(--ink2);max-width:var(--measure);margin:16px 0 24px}
.subhead{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:650;
 margin:30px 0 14px;display:flex;align-items:center;gap:10px}
.subhead::after{content:"";flex:1;height:1px;background:var(--line)}
```

### 6. Components

```css
/* lead conclusion panel */
.verdict{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);
 padding:26px 28px;box-shadow:var(--shadow);margin-bottom:22px}
.verdict h3{font-size:19px;margin-bottom:12px}
.verdict p:last-child{margin-bottom:0}

/* headline figures */
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(168px,100%),1fr));gap:14px;margin:22px 0}
.tile{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius-sm);padding:16px 18px}
.tile .tn{font-size:27px;font-weight:680;letter-spacing:-.02em;line-height:1.1;color:var(--accent)}
.tile .tl{font-size:12.8px;color:var(--muted);margin-top:5px}

/* diamond-bulleted key points */
ul.keypoints{margin:0;padding-left:0;list-style:none}
ul.keypoints li{position:relative;padding-left:26px;margin-bottom:11px}
ul.keypoints li::before{content:"";position:absolute;left:6px;top:.66em;width:7px;height:7px;
 border-radius:2px;background:var(--accent);transform:rotate(45deg)}

/* card grid — detail-page links, options, findings */
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(330px,100%),1fr));gap:16px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius-sm);
 padding:18px 20px;box-shadow:var(--shadow);display:flex;flex-direction:column;text-decoration:none;color:inherit}
.card header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:9px}
.card h4{font-size:16px;max-width:30ch}
.card p{font-size:14.2px;color:var(--ink2);flex:1}
.card footer{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin-top:12px;padding-top:11px;border-top:1px solid var(--line2)}
a.card:hover{border-color:var(--accentline);box-shadow:0 1px 2px rgba(28,26,24,.05),0 10px 26px -16px rgba(15,118,110,.45)}

/* stacked rows — risks, conflicts, open questions, non-goals */
.stack{display:flex;flex-direction:column;gap:12px}
.row{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius-sm);padding:16px 19px}
.row h4{font-size:15.5px;margin-bottom:6px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.row p{font-size:14.2px;color:var(--ink2);margin:0}

/* quiet aside inside a section */
.note{margin-top:20px;background:var(--sunk);border:1px solid var(--line);border-left:3px solid var(--accent);
 border-radius:10px;padding:15px 18px}
.note h5{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--accent);margin-bottom:7px}
.note p{font-size:14.6px;color:var(--ink2);margin-bottom:0}

/* loud aside — replaces the old .conflict-banner */
.callout{background:var(--accentbg);border:1px solid var(--accentline);border-radius:var(--radius-sm);padding:18px 22px;margin:20px 0}
.callout h4{font-size:15.5px;color:var(--accent);margin-bottom:7px}
.callout p{font-size:14.6px;color:var(--accentink);margin-bottom:0}
.callout.warn{background:var(--warnbg);border-color:var(--warnline)}
.callout.warn h4{color:var(--warn)} .callout.warn p{color:var(--warn)}

/* badges and severity chips */
.badge{font-size:11.5px;font-weight:650;padding:2.5px 10px;border-radius:20px;white-space:nowrap;display:inline-block}
.b-ok{background:var(--okbg);color:var(--ok);border:1px solid var(--okline)}
.b-warn{background:var(--warnbg);color:var(--warn);border:1px solid var(--warnline)}
.b-danger{background:var(--dangerbg);color:var(--danger);border:1px solid var(--dangerline)}
.b-info{background:var(--accentbg);color:var(--accent);border:1px solid var(--accentline)}
.b-neutral{background:var(--neutralbg);color:var(--neutral);border:1px solid var(--neutralline)}
.sev{font-size:10.8px;font-weight:680;text-transform:uppercase;letter-spacing:.06em;padding:2.5px 8px;border-radius:5px}
.sev.high{background:var(--dangerbg);color:var(--danger)}
.sev.medium{background:var(--warnbg);color:var(--warn)}
.sev.low{background:var(--neutralbg);color:var(--neutral)}

/* tables always scroll rather than crush */
.tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:var(--radius);background:var(--panel);box-shadow:var(--shadow)}
table{border-collapse:collapse;width:100%;min-width:720px;font-size:14.2px}
th{text-align:left;font-size:11.8px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);
 padding:12px 16px;background:var(--sunk);border-bottom:1px solid var(--line);font-weight:650}
td{padding:11px 16px;border-bottom:1px solid var(--line2);vertical-align:top;color:var(--ink2)}
tr:last-child td{border-bottom:0}
tbody tr:hover{background:#fdfcfa}

/* diagrams */
.diagram{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);
 padding:22px 24px;box-shadow:var(--shadow);overflow-x:auto}
.diagram .mermaid{display:flex;justify-content:center;min-width:0}
.diagcap{font-size:13px;color:var(--muted);margin-top:14px;text-align:center}

footer.end{border-top:1px solid var(--line);background:var(--sunk);padding:32px 0 48px;font-size:13.4px;color:var(--muted)}

/* long paths in prose must wrap even though inline code is nowrap by default */
.row code,.note code,.callout code,.lede code,.verdict code,td code,.card p code,footer.end code{white-space:normal;overflow-wrap:anywhere}
```

### 7. Detail page and source view

Detail pages drop the rail; source views drop everything.

```css
.detail{max-width:900px;margin:0 auto;padding:44px 0 90px}
.backlink{display:inline-block;margin-bottom:20px;font-size:13.8px;color:var(--muted);text-decoration:none}
.backlink:hover{color:var(--accent)}

.sourceview{max-width:860px;margin:0 auto;padding:32px 0 80px}
.sourceview .rendered{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:26px 28px}
.sourceview .rendered pre{background:var(--sunk)}
```

### 8. Responsive — content breakpoints, not devices

```css
@media (max-width:1080px){
 .layout{grid-template-columns:1fr;gap:0}
 aside{position:static;max-height:none;border-left:0;padding:0;margin:20px 0 0;
  border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--panel)}
 .toctoggle{display:block;width:100%;text-align:left;background:none;border:0;font:inherit;font-weight:650;
  padding:14px 18px;cursor:pointer;color:var(--ink)}
 aside nav{display:none;padding:0 14px 14px}
 aside.open nav{display:block}
 aside h6{display:none}
 main{padding-top:28px}
}
@media (max-width:700px){code{white-space:normal;overflow-wrap:anywhere}}
@media (max-width:640px){.wrap{padding:0 16px}.verdict{padding:20px 18px}.row,.card{padding:14px 16px}}
@media (max-width:400px){.pin{min-width:0;width:100%}}
@media print{aside{display:none}.layout{grid-template-columns:1fr}section.top-level,.row,.card{break-inside:avoid}}
```

Verify by sweeping 1440 / 1080 / 900 / 768 / 700 / 640 / 430 / 390 and asserting
`documentElement.scrollWidth <= innerWidth` at each. `minmax(330px,1fr)` overflows below 330px —
always `minmax(min(330px,100%),1fr)`.

## Overview Page Skeleton (index.html)

```html
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{TITLE}}</title>
<meta name="description" content="{{SUMMARY}}">
<link rel="stylesheet" href="assets/styles.css">
<!-- BEGIN generated:mermaid-init · from skills/_shared/design-brief.jsonc · do not edit by hand · regenerate with bun skills/_shared/scripts/render-design-tokens.ts --write -->
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script>mermaid.initialize({"startOnLoad":true,"theme":"base","themeVariables":{"background":"#ffffff","primaryColor":"#e6f5f3","primaryBorderColor":"#0f766e","primaryTextColor":"#1b1a18","secondaryColor":"#fdf1e3","tertiaryColor":"#faf8f4","lineColor":"#6f6862","textColor":"#3d3a36","fontFamily":"ui-sans-serif,-apple-system,\"Segoe UI\",Inter,Roboto,Helvetica,Arial,sans-serif","fontSize":"14px"},"flowchart":{"curve":"basis","useMaxWidth":true},"sequence":{"useMaxWidth":true}});</script>
<!-- END generated:mermaid-init -->
</head><body>

<header class="top"><div class="wrap">
  <div class="eyebrow">{{SOURCE_TYPE}} · {{DATE}}</div>
  <h1>{{TITLE}}</h1>
  <p class="sub">{{SUMMARY}}</p>
  <div class="pins">
    <div class="pin a"><div class="pname">Source</div>
      <div class="pmeta"><b>{{SOURCE_ARTIFACT}}</b><br>subject {{SUBJECT}}</div></div>
    <div class="pin s1"><div class="pname">Status</div>
      <div class="pmeta"><b>{{STATUS}}</b> · {{N_PHASES}} phases</div></div>
  </div>
</div></header>

<div class="wrap"><div class="layout">
<main>

<!-- conditional: only when parent and phased plans contradict -->
<div class="callout warn"><h4>Conflicts detected</h4>
  <p>Parent plan and phased plan disagree on {{CONFLICT_SUBJECT}}. Full account in the appendix.</p></div>

<section class="top-level" id="summary">
 <h2><span class="h2n">01</span>Summary</h2>
 <div class="verdict"><h3>{{ONE_LINE_CONCLUSION}}</h3><p>{{SUMMARY_BODY}}</p></div>
</section>

<section class="top-level" id="why">
 <h2><span class="h2n">02</span>Why</h2>
 <p class="lede">{{WHY_LEDE}}</p>
 <ul class="keypoints"><li>{{POINT}}</li></ul>
</section>

<section class="top-level" id="what-changes">
 <h2><span class="h2n">03</span>What changes</h2>
 <div class="tablewrap"><table>
  <thead><tr><th>Area</th><th>Change</th></tr></thead>
  <tbody><tr><td>{{AREA}}</td><td>{{CHANGE}}</td></tr></tbody>
 </table></div>
</section>

<section class="top-level" id="how-it-works">
 <h2><span class="h2n">04</span>How it works</h2>
 <div class="diagram">
  <div class="mermaid">
flowchart LR
  A["Component"] --> B["Service"] --> C[("Data")]
  </div>
  <div class="diagcap">{{DIAGRAM_CAPTION}}</div>
 </div>
</section>

<section class="top-level" id="delivery">
 <h2><span class="h2n">05</span>Delivery shape</h2>
 <div class="cards">
  <a class="card" href="phases.html">
   <header><h4>Phase details</h4><span class="badge b-info">detail</span></header>
   <p>{{PHASES_BLURB}}</p></a>
 </div>
</section>

<section class="top-level" id="risks">
 <h2><span class="h2n">06</span>Risks &amp; conflicts</h2>
 <div class="stack">
  <div class="row"><h4>{{RISK_TITLE}} <span class="sev high">high</span></h4><p>{{RISK_BODY}}</p></div>
 </div>
</section>

<section class="top-level" id="sources">
 <h2><span class="h2n">07</span>Sources</h2>
 <ul class="keypoints"><li><a href="sources/plan-topic.md.html">plan-topic.md</a></li></ul>
</section>

</main>

<aside id="toc">
 <button class="toctoggle" aria-expanded="false">Contents ▾</button>
 <h6>Contents</h6>
 <nav><ul>
  <li><a href="#summary" class="l1">Summary</a></li>
  <li><a href="#why" class="l1">Why</a></li>
  <li><a href="#what-changes" class="l1">What changes</a></li>
  <li><a href="#how-it-works" class="l1">How it works</a></li>
  <li><a href="#delivery" class="l1">Delivery shape</a></li>
  <li><a href="#risks" class="l1">Risks &amp; conflicts</a></li>
  <li><a href="#sources" class="l1">Sources</a></li>
  <li><a href="phases.html" class="l1">→ Phase details</a></li>
 </ul></nav>
</aside>
</div></div>

<footer class="end"><div class="wrap">
 Generated by <code>/b-present</code> from <code>{{SOURCE_ARTIFACT}}</code> · {{DATE}}.
</div></footer>

<script src="assets/nav.js"></script>
</body></html>
```

## Detail Page Template

```html
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{PAGE_TITLE}} · {{SHORT_TITLE}}</title>
<link rel="stylesheet" href="assets/styles.css">
</head><body>
<div class="wrap"><div class="detail">
  <a href="index.html" class="backlink">← Back to overview</a>
  <h1>{{PAGE_TITLE}}</h1>
  <p class="lede">{{PAGE_LEDE}}</p>

  <section class="top-level" id="detail">
   <h2><span class="h2n">01</span>{{SECTION_TITLE}}</h2>
   <div class="stack"><div class="row"><h4>{{ITEM}}</h4><p>{{BODY}}</p></div></div>
  </section>
</div></div>
</body></html>
```

## Source View Template

```html
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{SOURCE_FILE}} · source</title>
<link rel="stylesheet" href="../assets/styles.css">
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
</head><body>
<div class="wrap"><div class="sourceview">
  <a href="../index.html" class="backlink">← Back to overview</a>
  <h1>{{SOURCE_FILE}}</h1>
  <div id="rendered" class="rendered"></div>
</div></div>
<script src="../assets/render-md.js"></script>
<script>renderSource('{{SOURCE_FILE}}');</script>
</body></html>
```

The source view inherits the shared stylesheet so it stays in the same visual family — it is
"utilitarian" by having no rail, no masthead and no cards, not by having a different palette.

## Client-Side Markdown Renderer (assets/render-md.js)

```javascript
// Source view must load marked.js before this file.
function renderSource(filename) {
  fetch(filename)
    .then(r => r.text())
    .then(md => { document.getElementById('rendered').innerHTML = marked.parse(md); })
    .catch(err => {
      document.getElementById('rendered').innerHTML =
        '<div class="callout warn"><h4>Source unavailable</h4><p>' + err.message + '</p></div>';
    });
}
```

## Navigation Script (assets/nav.js)

Scroll-spy plus the mobile collapse toggle. Identical on every overview page.

```javascript
(function(){
 var links = Array.prototype.slice.call(document.querySelectorAll('#toc a[href^="#"]'));
 var map = {};
 links.forEach(function(a){ map[a.getAttribute('href').slice(1)] = a; });
 var targets = Object.keys(map).map(function(id){ return document.getElementById(id); }).filter(Boolean);
 var active = null;
 function setActive(el){
   if(!el || el===active) return;
   if(active) active.classList.remove('active');
   active = el; el.classList.add('active');
 }
 var io = new IntersectionObserver(function(entries){
   var visible = entries.filter(function(e){return e.isIntersecting;});
   if(!visible.length) return;
   visible.sort(function(a,b){return a.boundingClientRect.top - b.boundingClientRect.top;});
   setActive(map[visible[0].target.id]);
 }, {rootMargin:'-8% 0px -72% 0px', threshold:0});
 targets.forEach(function(t){ io.observe(t); });

 var btn = document.querySelector('.toctoggle'), side = document.getElementById('toc');
 if(btn){ btn.addEventListener('click', function(){
   var open = side.classList.toggle('open');
   btn.setAttribute('aria-expanded', String(open));
   btn.textContent = open ? 'Contents ▴' : 'Contents ▾';
 }); }
 links.forEach(function(a){ a.addEventListener('click', function(){
   if(side.classList.contains('open')){ side.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.textContent='Contents ▾'; }
 }); });
})();
```

## Mermaid Diagram Embedding

Init is generated (see the overview skeleton). Embed with:

```html
<div class="diagram">
  <div class="mermaid">
flowchart LR
  A["Client"] --> B["API"] --> C[("Database")]
  </div>
  <div class="diagcap">Caption stating what the reader should take from the diagram.</div>
</div>
```

Mermaid reads `textContent`, so a literal `<br/>` inside `.mermaid` is parsed into a DOM node and
lost. Write `&lt;br/&gt;` for a line break inside a node label.

There is no dark variant. The design language is light-only by decision — see `modes.dark` in
`skills/_shared/design-brief.jsonc` before adding one.
