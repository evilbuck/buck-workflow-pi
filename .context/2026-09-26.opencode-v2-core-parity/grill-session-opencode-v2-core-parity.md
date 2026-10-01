---
type: grill-session
date: 2026-09-26
subject: 2026-09-26.opencode-v2-core-parity
total_questions: 8
assessment_threshold: 20
boundary_assessment: pending
break_points: []
decision_domains:
  - name: Release scope
    questions: [1]
    resolved: 1
    deferred: 0
  - name: Installation
    questions: [2-4]
    resolved: 3
    deferred: 0
  - name: Runtime boundaries
    questions: [5-6]
    resolved: 2
    deferred: 0
  - name: Workflow semantics
    questions: [7-8]
    resolved: 1
    deferred: 1
status: active
---

# Grill Session: OpenCode V2 Core Workflow Parity

## Decision Domains

### Release scope
- Q1 [scope, resolved]: What must “works in OpenCode V2” mean for the first release? → Core workflow parity: skills and commands work alongside Pi and OMP. Include an installer and change OpenCode documentation references to V2. Runtime extension parity is not a first-release requirement.

### Installation
- Q2 [constraint, resolved]: Prefer a native OpenCode V2 install command pointing at the local package if it installs skills and commands; otherwise use the repository installer. → `opencode2 plugin add` takes an npm/Git package specifier and registers a plugin, not a local skills/commands bundle. V2 config can point at a local plugin, but that does not by itself make this Pi/OMP package loadable as a V2 plugin. Keep the existing `scripts/install.mjs` symlink installer for core parity; do not add a plugin merely to mimic installation.
- Q3 [scope, resolved]: Global and project-scoped OpenCode V2 installation in the first release, or global only? → Global only for now; project-scoped install is out of scope.
- Q4 [scope, resolved]: Full existing catalog or curated cross-harness subset? → Install the full catalog of 64 skills and 43 prompt-backed commands; do not maintain a second allowlist for OpenCode V2.

### Runtime boundaries
- Q5 [scope, resolved]: What should full-catalog commands without an OpenCode implementation do? → User asked to remove `/code-review` and `/b-kamal-release` outright, and agrees to skip OMP-only enhancements in portable skills outside OMP. Keep the three `/omp-*` documentation stubs clearly labelled as no-ops on non-OMP harnesses unless separately changed. Live OpenCode V2 API lists no Buck commands in the current location, so functional behavior is not yet verified.
- Q6 [scope, resolved]: Do removals apply repository-wide including Pi/OMP extension behavior, or only the OpenCode V2 install? → Repository-wide: retire the portable `code-review` skill and `/code-review` command plus the distinct Pi/OMP local review extension; retire `/b-kamal-release` prompt command and Pi/OMP release extension. `b-kamal-release` has no skill directory. Keep the separately named `code-review-universal` unless asked otherwise. Remove stale references and adjust tests/mirror in the eventual implementation.

### Workflow semantics
- Q7 [constraint, resolved]: How should `/b-plan` behave in OpenCode V2 Plan mode, which may not write `.context/`? → Plan read-only in chat, then explicitly hand off to Build mode to save the durable Buck plan. Never claim `.context/` was written in Plan mode.
- Q8 [scope, deferred]: Should OMP-only documentation-stub commands be visible as no-ops in OpenCode V2, or omitted by its installer? → Awaiting user decision.

## Boundary Assessment

Pending; assess separation-of-concerns at question 20 or sooner if the answers expose independent delivery units.

## Deferred Questions

- Q8: Visibility of OMP-only command stubs in OpenCode V2 awaits user decision.
