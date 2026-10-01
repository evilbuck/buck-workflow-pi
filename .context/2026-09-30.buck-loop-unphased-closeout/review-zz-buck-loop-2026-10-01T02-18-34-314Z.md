## Plan Path Review: Buck-loop unphased closeout

**Needs work — one high-severity in-plan regression.** The closeout scenarios pass, but ordinary blocked unphased work can no longer resume.

### Plan Source
- Contract: `.context/2026-09-30.buck-loop-unphased-closeout/plan-buck-loop-unphased-closeout.md`
- Baseline: staged implementation versus `00466ca`, supplemented by current-source inspection and isolated runtime scenarios.

### Finding
**Unrelated blocked work becomes a closeout hold** — `extensions/buck-loop/persist.ts:177–182`, `extensions/buck-loop/loop.ts:349–358`.

Both guards apply eligibility restrictions to **every** blocked unphased projection, rather than only false-`done` and closeout-blocked projections.

Reproduced with a clean repository, active plan, open acceptance, and history containing only `building → blocked`:
- Original interruption reason replaced by `unphased plan remains open`.
- Resume returns blocked.
- Zero `runStep` calls; the build needed to satisfy acceptance cannot continue.

**Fix:** restrict reconciliation and confirmation suppression using the original projection’s closeout cause/history. Preserve normal recovery for unrelated failures. Add an opposite-case regression alongside the existing closeout-hold tests.

### Completion Matrix

| Step | Status | Evidence |
|---|---|---|
| Shared parser and lowercase eligibility | Complete | Boundary tests pass, including `[X]` and missing/empty sections |
| Checked-list status synchronization | Complete | Target safety, body preservation, stable metadata tests pass |
| Lifecycle blockers and bundled parity | Complete | Actual lifecycle CLI refusals; byte comparisons pass |
| Automatic and choice commit gates | Complete | Eligible/ineligible regressions pass |
| Resume reconciliation | **Partial** | Closeout cases pass; ordinary blocked-work recovery is regressed |
| Unphased build instructions | Complete | Evidence-only instruction present in canonical and bundled skill |
| Required verification | Complete for existing suites | Focused tests and deterministic contract pass |

### Review Axes
- **Spec axis worst finding:** cause-insensitive resume hold violates step 5’s closeout-only restriction.
- **Standards axis worst finding:** reconciliation overwrites actionable failure evidence and breaks recovery.
- Standards used the separate sequential fallback. No cross-axis ranking.

### Verification / Guardrails
- Focused suites: **254 passed, 3 skipped**, six files.
- `npm run guardrails:check`: **pass**, durable contract v2.
- Unit, patch, global ratchet, complexity: **pass**.
- Functional and lint: **skipped**, disabled by contract.
- Coverage: **87.8%**, baseline **84%**.
- Actual supervisor smoke verified open holds and eligible no-build closeout for both `done` and closeout-blocked projections. Lifecycle CLI exercised; OMP TUI not exercised.

### User Goal / Impact
- User goal: **partially met**; closeout works, but ordinary unfinished-work resume is blocked.
- Documentation and how-to coverage already updated; no additional gap found.
- In-plan issues: **1**. Out-of-plan issues: **none**.

Reopened and staged only:
`.context/2026-09-30.buck-loop-unphased-closeout/iterate-buck-loop-unphased-closeout.md`

Full evidence and fix proposal are in its **Re-review — 2026-09-30** section. Recommended route: `/b-iterate`, then review the same plan. No loop-state decision made.
