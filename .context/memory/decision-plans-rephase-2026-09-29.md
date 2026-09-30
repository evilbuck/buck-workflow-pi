---
date: 2026-09-29
domains: [planning, workflow]
topics: [decision-closure, chooser-block-determinism, bugs-first, rephasing]
related:
  - .context/2026-09-16.decision-closure/plan-decision-closure-protocol.md
  - .context/2026-09-16.decision-closure/plan-decision-closure-protocol-phases.md
  - .context/2026-09-19.chooser-block-determinism/plan-chooser-block-determinism.md
priority: high
status: completed
subject: 2026-09-16.decision-closure
artifacts: [plan-decision-closure-protocol.md, plan-decision-closure-protocol-phases.md, phase-1-chooser-stall.md]
---

# Coordinated Decision Plans — Bugs First

User requested rephasing the decision-closure and chooser-block-determinism plans together, with bugs first. The existing decision-closure subject owns the combined six-phase sequence; both original plan filenames are preserved. The chooser subject retains incident requirements and points to combined Phase 1 rather than creating a second execution queue.

Sequence: 1 chooser stall verification/remaining-gap repair → 2 shared protocol → 3 grill variants, 4 plan/phase, 5 build/review → 6 narrative/proof. The 1→2 gate is user priority policy, not a claimed technical coupling. Phases 3–5 may be authored in parallel after 2; 6 joins their completed consumers.

The earlier description of the chooser plan as unstarted was unsupported: current source already has heading-level-tolerant review parsing, context injection/audit and native Jev selection. Rephasing does not infer bug completion from these observations. Phase 1 must exercise all five original criteria, repair only demonstrated gaps, preserve legal-set/safety behavior, and record evidence before feature work starts. The broader typed-review/fix-or-continue plan remains separate.

Original closure phases are renumbered 2–6, preserving their detailed criteria and verification. Combined scope explicitly distinguishes closure-only runtime exclusions from the added original bug contract. Phase difficulty now uses hard/not-hard. Backlog pickup links, subject artifact links and dependent plan/research references were updated. Historical memory files were not rewritten. No implementation criterion or subject lifecycle was marked completed.

## Verification

- Actual `extensions/buck-loop/scan.ts` smoke on the combined parent selected `phase-1-chooser-stall.md`; planFacts was `phased-incomplete`.
- Disposable structural verifier passed: 6 phase files, 28 relative links, 10 numbered parent steps, 15 original closure acceptance rows, 5 original chooser acceptance rows, and dependency graph 1→2→{3,4,5}→6.
- 41 unchanged closure phase acceptance entries were compared against the original snapshots; one existing runtime-exclusion entry was scoped to closure phases to allow the explicitly added bug phase.
- Lifecycle inspections report both subjects active; no lifecycle fields were edited.
- Session changes are confined to `.context/`; deterministic gate skipped as docs-only. No runtime or feature tests claimed.
- SQL/native memory devices were unmounted during this work. Portable file checkpoint used; shared-store unavailability is not a zero-row recall result.

Next executable artifact: `.context/2026-09-16.decision-closure/phase-1-chooser-stall.md`.
