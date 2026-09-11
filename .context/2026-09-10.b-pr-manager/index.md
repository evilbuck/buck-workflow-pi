---
status: active
date: 2026-09-10
subject: 2026-09-10.b-pr-manager
topics:
  - omp-extension
  - pull-requests
  - state-machine
---

# b-pr-manager

Plan a narrow OMP extension that drives one open pull request from review-feedback intake through validated Buck fix rounds, safe rebase/push, bounded polling, auto-merge, and confirmed GitHub merge state.

## Artifacts

- [Implementation plan](plan-b-pr-manager.md)
- [Phases overview](plan-b-pr-manager-phases.md)
- [Phase 1: Freeze contracts and pure machine](phase-1-contracts-pure-machine.md)
- [Phase 2: Extract shared PR git primitives](phase-2-shared-pr-git.md)
- [Phase 3: Deterministic GitHub inventory](phase-3-github-inventory.md)
- [Phase 4: Atomic persistence and resume](phase-4-persistence-resume.md)
- [Phase 5: Model actors and Buck fix rounds](phase-5-model-actors-buck-loop.md)
- [Phase 6: XState runner and command UX](phase-6-runner-command-ux.md)
- [Phase 7: Safety proof, docs, and smoke](phase-7-proof-docs-smoke.md)

## Current state

- Planning decisions resolved.
- Implementation plan drafted.
- Phases 1–2 completed. First non-completed phase: **Phase 3** (medium, `/b-build`).
