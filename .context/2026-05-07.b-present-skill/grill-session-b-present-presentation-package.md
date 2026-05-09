---
type: grill-session
date: 2026-05-09
subject: 2026-05-07.b-present-skill
total_questions: 66
assessment_threshold: 20
boundary_assessment: cohesive
break_points: []
decision_domains:
  - name: Presentation Artifact Model
    questions: [1-18]
    resolved: 18
    deferred: 0
  - name: Source Synthesis and Provenance
    questions: [19-32]
    resolved: 14
    deferred: 0
  - name: Package Runtime and Preview
    questions: [33-42]
    resolved: 10
    deferred: 0
  - name: Visual System and Source Views
    questions: [43-57]
    resolved: 15
    deferred: 0
  - name: Migration and Lifecycle
    questions: [58-66]
    resolved: 9
    deferred: 0
status: active
---

# Grill Session: b-present Presentation Package

## Decision Domains

### Domain: Presentation Artifact Model

- Q1-Q4: When parent plan and phased plan both exist, use both. The parent plan is the orchestrating overview; the phased plan may add detail and must be synthesized rather than treated as a separate competing source.
- Q5-Q12: `b-present` is no longer slide-first. Its canonical output is an async-reading-first **Presentation Package**: a small static site with one primary overview page and optional detail pages.
- Q13-Q18: The package uses mixed navigation for non-linear reading, with a required overview page and a semi-fixed set of approved detail page types: `architecture`, `phases`, `verification`, and `appendix`.
- Split rules:
  - `phases.html` appears when the phased plan adds significant new detail or phase complexity would clutter the overview.
  - `architecture.html` appears when architecture needs more than a compact overview explanation.
  - `verification.html` appears only when detailed checks would distract from the main narrative.
  - `appendix.html` is for non-essential but useful supporting material, never core narrative.

### Domain: Source Synthesis and Provenance

- Q19-Q24: `b-present` uses one core package model with source-biased emphasis rather than separate tools per source type.
  - Brainstorms emphasize decision landscape.
  - Specs emphasize product narrative.
  - Grill sessions emphasize decision resolution.
- Q25-Q27: Source authority is mixed:
  - Parent plan is authoritative for goal, scope, and narrative.
  - Phased plan is authoritative for execution detail.
  - Contradictions must be surfaced, not silently merged.
  - Output should still generate with a visible conflicts summary on the overview page and fuller explanation in the appendix.
- Q28-Q32: The package is descriptive rather than prescriptive. It may link directly to source artifacts. Source links should open rendered source views powered by a client-side markdown renderer, but that renderer is for source views only — synthesized overview/detail pages remain authored HTML.

### Domain: Package Runtime and Preview

- Q33-Q42: `file://` support is no longer required; a tiny local server is acceptable.
- Preview launch is part of the core `b-present` flow, not a separate command.
- Regeneration overwrites the same package in place.
- If source resolution finds multiple plausible inputs at the same precedence level, stop and ask the user.
- On disk, the package lives at:
  - `presentations/<slug>/index.html`
  - `presentations/<slug>/assets/`
  - `presentations/<slug>/sources/`
- Assets are package-local, not shared globally.

### Domain: Visual System and Source Views

- Q43-Q57: Copy every artifact directly used in the synthesis into the package so source views match actual provenance.
- The visual style is hybrid: product-brief feel with docs-like navigation and readability.
- Styling is tiered:
  - `index.html` is most polished.
  - Detail pages are simpler.
  - Source views are utilitarian.
- Overview synthesis should be moderate: rephrase, de-duplicate, and reorganize for clarity without strong interpretation.
- The overview uses a hybrid top-level skeleton:
  - `Title / Summary / Why / What changes / How it works / Delivery shape / Risks & conflicts / Sources`
  - `Open questions` appears only when materially important.
- Diagrams are a strong default for technical sources when useful, but not mandatory. Use Mermaid by default, with plain HTML/CSS fallbacks when Mermaid is a poor fit.
- Main pages should use mostly semantic HTML, with a lightweight no-build framework allowed only if it clearly helps. No framework is locked in yet.
- Preview serving should use a fallback chain, with Node-based serving likely preferred when available.

### Domain: Migration and Lifecycle

- Q58-Q66: Keep the command name `b-present`.
- Redefine “present” in Buck docs to mean producing a human-readable presentation artifact, not necessarily slides.
- Slide-deck output is out of current scope, though it could return later as an optional secondary mode.
- An in-place rewrite is acceptable for this repo because the user is the only consumer.
- Backward compatibility with the old Reveal.js slide-deck output can break outright.
- Generate a semi-public `manifest.json` alongside the human-facing pages.
- Use `manifest.json` to remove stale generated files on regeneration.
- `presentations/<slug>/` is disposable generated output only, not intended for hand-editing.

## Documentation Decisions

### Terms Resolved
- **Presentation** → async-reading-first overview page with optional detail pages; not synonymous with slide deck.
- **Presentation Package** → small static site folder containing the presentation, detail pages, assets, source views, and manifest.
- **Parent Plan** → authoritative for goal/scope/narrative.
- **Phased Plan** → authoritative for execution detail.
- **Source View** → reader-facing page that renders copied markdown source artifacts client-side.

### ADRs Created
- None.
- Note: the shift from Reveal.js slide deck to async-readable presentation package likely qualifies for an ADR because it is surprising, hard enough to reverse, and the result of a real trade-off.

### Conflicts Found
- Existing repo docs, prompt, and skill files still describe `b-present` as a Reveal.js slide-deck generator.
- The grilling session resolved that the command name remains `b-present`, but the artifact model changes to a presentation package.
- Existing references to single-file HTML output and `file://` viewing are now stale.

## Boundary Assessment

Triggered at Q20 (assessment threshold: 20), then continued to close open branches through Q66.

**Assessment**: cohesive

**No phase boundaries**: despite the high question count, the decisions cluster around a single concern: redefining `b-present` from a slide generator into an async-readable presentation-package workflow. The discussion covered artifact shape, source synthesis, navigation, source provenance, runtime preview, rendering approach, migration strategy, and lifecycle, but these are all aspects of one design rather than multiple separable specs.

Implementation may still be tackled incrementally, but the design itself should stay in one `b-present` rewrite effort.

## Deferred Questions

- Whether to write an ADR for the artifact-model shift.
- Which specific no-build framework, if any, earns adoption later based on real interactive needs.
- Whether an optional slide-deck secondary mode should return in the future.
