# Buck Workflow Presentation Context

This context defines the domain language for Buck workflow artifacts that summarize plans for humans. It exists to keep planning outputs, presentation outputs, and follow-on tooling aligned on what each artifact is for.

## Language

**Presentation**:
A human-readable overview page optimized for async reading, generated from one or more `.context/` artifacts, and optionally linking to deeper detail pages.
_Avoid_: Slide deck, slideshow

**Parent Plan**:
The top-level plan artifact that orchestrates execution and may delegate implementation detail to related artifacts.
_Avoid_: Main phase plan, master slide source

**Phased Plan**:
A plan artifact that decomposes a parent plan into ordered or parallelizable phases, sometimes with more detail than the parent.
_Avoid_: Replacement plan, child spec

**Detail Page**:
A separate, more detailed page linked from the primary **Presentation** when additional depth would overwhelm the main narrative.
_Avoid_: Extra slides, appendix deck

**Presentation Package**:
A small site folder containing a primary **Presentation**, any **Detail Pages**, and shared assets.
_Avoid_: Single self-contained file, deck export

**No-Build Framework**:
A client-side library or framework that can be loaded directly in the browser without a compilation or bundling step.
_Avoid_: Build pipeline, static-site generator

**Source Artifact Link**:
A direct link from the generated **Presentation Package** to an underlying markdown artifact used as source material.
_Avoid_: Hidden provenance, non-clickable-only references

**Client-Side Markdown Renderer**:
A browser-loaded renderer that displays markdown artifacts as readable HTML without a build step.
_Avoid_: Precompiled docs pipeline, raw-only markdown access

**Source View**:
A rendered reader-facing page that displays a linked markdown source artifact through a **Client-Side Markdown Renderer**.
_Avoid_: Raw markdown tab, opaque provenance

**Overview Narrative**:
The primary **Presentation** structure, organized first around reader questions and only secondarily around execution detail.
_Avoid_: Phase-by-phase dump, slide order

**Presentation Navigation**:
A mixed navigation model with a sticky sidebar on wide screens, a top or collapsible nav on narrow screens, and optional card links to **Detail Pages**.
_Avoid_: Linear slide controls, single-mode navigation

**Approved Detail Page Types**:
The small approved set of detail-page categories that a **Presentation Package** may generate beyond the required overview page: architecture, phases, verification, and appendix.
_Avoid_: Arbitrary page types, unconstrained page sprawl

## Relationships

- A **Parent Plan** may reference one or more **Phased Plans**
- A **Presentation** synthesizes both a **Parent Plan** and its **Phased Plan** while de-duplicating overlap when both exist
- A **Presentation** may link to one or more **Detail Pages** when the source material is too dense for a single narrative surface
- A **Presentation Package** contains exactly one primary **Presentation** and zero or more **Detail Pages**
- An **Overview Narrative** may summarize execution phases, but it is not required to mirror phase boundaries one-for-one
- A **Presentation** uses **Presentation Navigation** to support non-linear reading across sections and **Detail Pages**
- A **Presentation Package** always includes an overview page and may add **Approved Detail Page Types** when justified by source complexity

## Example dialogue

> **Dev:** "Should the **Presentation** just mirror the **Phased Plan**?"
> **Domain expert:** "No — start from the **Parent Plan** for the narrative, use the **Phased Plan** for detail, and move excess detail into a linked **Detail Page**."

## Flagged ambiguities

- "presentation" was used to mean a Reveal.js slide deck — resolved: in this context it means a primary scrollable page with optional linked detail pages
- "use both" could imply duplication between **Parent Plan** and **Phased Plan** — resolved: the presentation must synthesize and de-duplicate rather than concatenate both artifacts verbatim
- "good for various types of presentations" was ambiguous between live talks and readable handoffs — resolved: **Presentation** is optimized for async reading first
- output shape was ambiguous between a single file and a small site — resolved: b-present writes a **Presentation Package** with shared assets
- acceptable runtime dependencies were unclear — resolved: CDN-loaded assets and **No-Build Frameworks** are acceptable, but no build system is allowed
- page organization was ambiguous between plan sections and phases — resolved: the primary **Presentation** uses an **Overview Narrative** organized around reader questions, with execution phases summarized within it
- navigation style was ambiguous between docs-style and site-style — resolved: the **Presentation** uses mixed **Presentation Navigation** optimized for non-linear async reading
- detail-page structure was ambiguous between fixed and free-form — resolved: the package uses a semi-fixed set of **Approved Detail Page Types** with the overview page required
- the default detail-page taxonomy was undecided — resolved: the approved default set is architecture, phases, verification, and appendix
- when to emit `phases.html` was unclear — resolved: create it when the phased plan adds significant new detail or when phase count/complexity would clutter the overview
- when to emit `architecture.html` was unclear — resolved: create it when architecture needs more than a compact overview diagram plus short explanation on the main page
- when to emit `verification.html` was unclear — resolved: keep a concise completion/validation summary on the main page and create `verification.html` only when detailed checks or matrices would distract from the main narrative
- the role of `appendix.html` was unclear — resolved: use it for non-essential but useful supporting material, never for core narrative
- output behavior across source types was unclear — resolved: b-present uses one core package model with source-biased emphasis rather than completely different package types
- brainstorm presentation shape was unclear — resolved: brainstorm-based presentations emphasize the decision landscape: problem, key options, strongest recommendation, and unresolved questions
- spec presentation shape was unclear — resolved: spec-based presentations emphasize the product narrative: goal, context, requirements, acceptance, and implementation implications
- grill-session presentation shape was unclear — resolved: grill-session presentations emphasize decision resolution: what was challenged, clarified, changed, and left open
- diagram usage was unclear in the async-reading model — resolved: diagrams are a strong default for technical sources when structure or flow is present, but they are not mandatory for thin sources
- source traceability was unclear — resolved: use light section-level provenance in the main narrative and fuller source traceability in the appendix when useful
- whether source artifacts should be directly linkable was unclear — resolved: direct **Source Artifact Links** are allowed
- how markdown source artifacts should be viewed was unclear — resolved: a **Client-Side Markdown Renderer** is acceptable for readable source viewing without a build step
- what should happen when opening a source artifact was unclear — resolved: source links should open a rendered **Source View** powered by a client-side markdown renderer
- whether client-side markdown rendering should power first-class pages was unclear — resolved: the renderer is for **Source Views** only; synthesized overview/detail pages remain authored narrative HTML
- whether the package must work fully from `file://` was unclear — resolved: a tiny local server is acceptable, which makes rendered Source Views reliable
- whether serving is outside the scope of b-present was unclear — resolved: b-present should integrate with Buck/Pi tooling to launch or preview the Presentation Package
- preview integration behavior was unclear — resolved: b-present should start a local server and automatically open/select a preview when tooling is available
- whether preview was optional workflow sugar or core behavior was unclear — resolved: preview launching is part of the core `b-present` flow
- output lifecycle on regeneration was unclear — resolved: Presentation Packages are derived artifacts and should be overwritten in place
- behavior under ambiguous source selection was unclear — resolved: when multiple plausible sources exist at the same precedence level, b-present should stop and ask the user
- package folder naming was unclear — resolved: write Presentation Packages to `presentations/<slug>/`
- main entry filename was unclear — resolved: the primary Presentation entry point is `index.html`
- asset scope was unclear — resolved: assets are package-local under `presentations/<slug>/assets/`
- source-view location was unclear — resolved: rendered source views live under `presentations/<slug>/sources/`
- runtime access to markdown sources was unclear — resolved: b-present should copy only referenced source markdown files into the package for rendered source views
- the meaning of “referenced sources” was unclear — resolved: copy every artifact directly used in the synthesis into the package so the source views match actual provenance
- the meaning of “standard” visual presentation was unclear — resolved: b-present should use a hybrid visual style: product-brief presentation with docs-like navigation and readability
- page-to-page visual consistency was unclear — resolved: styling is tiered: `index.html` is most polished, detail pages are simpler, and source views are utilitarian
- synthesis aggressiveness was unclear — resolved: overview pages should use moderate synthesis: rephrase, de-duplicate, and reorganize for clarity without strong interpretation
- whether overview structure should be fixed or free-form was unclear — resolved: use a hybrid model with a standard top-level skeleton whose labels and emphasis adapt by source type
- the standard overview skeleton was unclear — resolved: use `Title / Summary / Why / What changes / How it works / Delivery shape / Risks & conflicts / Sources`
- placement of unresolved questions was unclear — resolved: add an `Open questions` section only when unresolved issues materially affect understanding or next decisions
- expected diagram density on the overview page was unclear — resolved: `index.html` may contain as many diagrams as needed when they materially improve understanding
- whether `architecture.html` still mattered when diagrams fit on the overview was unclear — resolved: keep `architecture.html` as an overflow/deep-dive page when architectural explanation exceeds comfortable overview density
- diagram runtime choice was unclear — resolved: use Mermaid by default, with plain HTML/CSS fallbacks when Mermaid is a poor fit
- whether synthesized pages should require a UI framework was unclear — resolved: use mostly semantic HTML by default, but allow a lightweight no-build framework when it meaningfully improves navigation or rendering
- whether to standardize on a specific no-build framework was unclear — resolved: do not lock in a framework until actual interactive needs justify one
- preview server selection was unclear — resolved: use a fallback chain rather than a single hard-coded server mechanism, with Node-based serving likely preferred when available
- whether the command name should stay `b-present` was unclear — resolved: keep `b-present` as the command name even though the artifact model has shifted from slide deck to async-readable briefing package
- the meaning of “present” in Buck docs was unclear after the artifact shift — resolved: document `present` as producing a human-readable presentation artifact, not necessarily slides
- whether slide-deck output remained part of `b-present` was unclear — resolved: slide decks are out of current scope, but may return later as an optional secondary mode
- whether the rewrite needed backward compatibility with old slide-deck output was unclear — resolved: old slide-deck output can break outright in this in-place rewrite
- whether the Presentation Package should have a machine-readable contract was unclear — resolved: generate a `manifest.json` alongside the human-facing pages
- whether `manifest.json` should be a strict public contract was unclear — resolved: treat it as semi-public: documented enough to use, but with room to evolve fields
- how regeneration should remove stale output was unclear — resolved: use `manifest.json` to remove only previously generated files that are no longer needed
- whether generated presentation packages were disposable or hand-edited was unclear — resolved: `presentations/<slug>/` is disposable generated output only
- whether to rewrite or migrate in stages was unclear — resolved: an in-place rewrite of `b-present` is acceptable for this repo because the user is the only consumer
- authority between parent and phased plans was unclear — resolved: the parent plan is authoritative for goal, scope, and narrative; the phased plan is authoritative for execution detail; contradictions must be surfaced rather than silently merged
- behavior under source contradictions was unclear — resolved: b-present should still generate output and include a visible Conflicts section rather than failing hard or silently choosing
- placement of contradictions was unclear — resolved: show a concise conflict warning on the overview page and fuller explanation/provenance in the appendix
- whether b-present should prescribe next workflow actions was unclear — resolved: the presentation should describe rather than recommend Buck next steps
- whether the presentation could act as an orchestration surface was unclear — resolved: the Presentation Package is purely descriptive, not an interactive control panel
