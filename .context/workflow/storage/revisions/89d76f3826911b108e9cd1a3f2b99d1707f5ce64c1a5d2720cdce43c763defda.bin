## Plan Path Review: Buck-loop unphased closeout

**Needs work — six in-plan findings.** Review completed; implementation remains incomplete.

### Plan Source
- File: `.context/2026-09-30.buck-loop-unphased-closeout/plan-buck-loop-unphased-closeout.md`
- Goal: Require closeout evidence before unphased `done`; repair historical false-`done` projections without restarting build.
- Baseline: staged implementation versus `00466ca`, supplemented by current-source inspection and isolated runtime smoke scenarios.

### Evidence Sources
- Reviewed staged loop modules, machine tests, lifecycle implementation/tests, and bundled lifecycle copy.
- Planned loop/persist regression additions and `b-build` instruction changes are absent.
- Pre-existing backlog, plan, and implementation changes were left untouched.

### Completion Matrix

| Step | Status | Evidence |
|---|---|---|
| 1. Body parser and eligibility | Partial | `scan.ts:185-195` computes eligibility, but `[X]` bypasses it; readers use separate parsers. |
| 2. Checked-list status sync | Partial | Writes completed status, but ignores subject-folder input, mutates phased parent plans, and rewrites completion dates. |
| 3. Lifecycle blocker and bundle | Partial | `[ ]` refusal passes; bundled copy is byte-identical. `[X]` incorrectly permits closure. |
| 4. Automatic and choice gates | Complete at machine seam | Both rules require eligibility: `machine.ts:239-249,402-414`. |
| 5. Resume reconciliation | Partial | Open-box resumes launch no work, but report stale reasons. Eligible blocked resume restarts build; eligible false-`done` leaves subject active. |
| 6. Unphased build instructions | Missing | `skills/b-build/SKILL.md:264-298` still covers phase boxes only. |
| 7. Required verification | Missing | Focused suites pass; deterministic guardrails fails; planned resume/persist/choice regressions are absent. |
| Canonical completed retry | Complete | Existing lifecycle retry test passes; authority retains its early no-op return. |
| Supervisor preserves box characters | Complete | Status writer changes frontmatter only. |

### Review Axes
- **Spec axis worst finding:** eligible resume does not perform verified closeout. Smoke observed a checked, initially clean blocked projection call `b-build` twice. A checked false-`done` projection returned `done` with canonical subject still active.
- **Standards axis worst finding:** required complexity violations: `collectPlanBlockers=26`, including hard-ceiling failure; `reconcile=12`. Duplicate parsing and unconditional metadata rewrites also fail standards.
- Standards used the explicitly scoped **sequential fallback**; no sub-agent dispatch tool was available.
- Cross-axis ranking: none.

### Verification Status
- Goal achieved: partially.
- Scope adhered: no — unphased status sync also marks a phased parent plan completed.
- Runtime smoke exercised actual supervisor, persistence, scan, sync, and lifecycle functions in isolated git repositories. Nested work boundaries were injected to detect unexpected calls; OMP TUI rendering was not exercised.

### Guardrails Verdict
- Contract: durable, version 2.
- Status: **fail**.
- Gates: unit tests **fail**; functional tests **skipped**; lint **skipped**; patch **advisory**; global ratchet **fail**; complexity **fail**.
- Focused suites: **170 passed, 3 skipped**.
- Scan suite: **54 passed, 5 failed** on obsolete exact-object-shape assertions.
- Bundled lifecycle comparison: exit 0.

### User Goal Analysis
- Met: incomplete unphased projections now block without nested work.
- Partial: blocker reporting and checked-list synchronization.
- Missing: verified, no-build closeout repair.
- Verdict: **partially met**.

### Documentation / How-to Impact
After correctness repair, document the unphased closeout contract and acceptance-evidence recovery sequence. Non-blocking; recommend `/b-docs`, with how-to synchronization.

### Issue Classification
Six in-plan finding groups:
1. Missing eligible resume closeout.
2. Stale blocker reasons omit acceptance lines.
3. `[X]` bypasses eligibility.
4. Incorrect sync targeting and non-idempotent completion metadata.
5. Missing unphased build instructions.
6. Failed required gates and missing regressions.

Out-of-plan issues: none.

### Artifact and Handoff
Created and staged only:
`.context/2026-09-30.buck-loop-unphased-closeout/iterate-buck-loop-unphased-closeout.md`

The artifact contains reproduction evidence and concrete fixes. Recommended route: `/b-iterate`, then review against the same plan. No loop-state decision was made.
