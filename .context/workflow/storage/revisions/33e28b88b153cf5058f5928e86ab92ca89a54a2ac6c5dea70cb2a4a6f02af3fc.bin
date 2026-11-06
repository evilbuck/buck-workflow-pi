## Plan Path Review: deterministic subject work-state

### Plan Source
- File: `.context/2026-09-19.subject-work-state/plan-subject-work-state.md`
- Goal: plan-scoped phase scanning, canonical subject-lifecycle authority, and complete caller cutover.
- Baseline: `da0a1e2`; current worktree state. Concurrent changes from other subjects were excluded.

### Evidence Sources
- Git status: implementation remains uncommitted alongside unrelated concurrent work.
- Recent commits: `da0a1e2` through `9d53738`.
- Implementation inspected: lifecycle authority, scan ownership, shared readers, save paths, runtime extensions, policy audit, CI, tests, and bundled copies.
- Runtime evidence:
  - Lifecycle policy audit: `{"ok":true,"violations":[]}`
  - Lifecycle CLI smoke completed `initialize → activate → close-verified → reopen → close-verified`; final state `completed`, revision 5, unrelated frontmatter/body preserved.
  - Durable guardrails passed.

### Completion Matrix

| Step | Status | Evidence |
|---|---|---|
| 1. Plan-scoped phase scanning | ✅ complete | `extensions/buck-loop/scan.ts:163-258`; mixed-plan and sole-plan regressions in `extensions/buck-loop/__tests__/scan.test.ts:165-213` |
| 2. Lifecycle transition coverage | ✅ complete | Legal transitions, retries, legacy behavior, refusals, preservation, and CLI semantics in `skills/_shared/scripts/subject-lifecycle.test.ts:36-229` |
| 3. Canonical API and CLI | ✅ complete | Named intent union and dispatch in `skills/_shared/scripts/subject-lifecycle.ts:7-13,310-360,476-559` |
| 4. Shared reader/resolution migration | ✅ complete | `skills/_shared/scripts/context-helpers.ts:407-429`; `skills/_shared/subject-resolution.md` |
| 5. Runtime extension migration | ✅ complete | `extensions/plan-artifact.ts:229-294`; `extensions/code-review-iteration/report.ts:121-159` |
| 6. Skill/prompt caller migration | ✅ complete | Repository policy audit reports zero violations |
| 7. Active `/b-save` ordering | ✅ complete | Final verified close and refusal handling are specified in canonical skill and prompt |
| 8. `b-save-improved` ordering and result propagation | 🔄 partial | `save-apply.ts:421-448,497-508` runs lifecycle last and returns its result, but `extensions/b-save-improved/index.ts:681-706,753` discards that result and reports success |
| 9. Codex bundle parity | ✅ complete | Recursive path and byte parity enforced by `scripts/codex-plugin.test.ts:74-106`; guardrails passed |
| 10. Syntax-aware policy audit | ✅ complete | Object-field regression coverage at `subject-lifecycle.test.ts:236-268`; live audit clean |
| 11. Verification scenarios | ✅ complete | Guardrails, audit, transition smoke, ownership regressions, and full unit gate passed |

### Review Axes
- **Spec axis worst finding:** `/b-save-improved` silently drops semantic lifecycle refusal results and finishes with `checkpoint written`.
- **Standards axis worst finding:** none from the sequential fallback pass using the TypeScript, universal quality, long-method, and duplicate-code guidance.
- **Cross-axis ranking:** none.

### Verification Status
- Goal achieved: **partial**
- User goal: core lifecycle and plan-identity behavior is implemented; improved-save closeout reporting remains incomplete.
- Scope adhered: yes for plan-owned changes.
- Out-of-scope changes: concurrent `buck-loop` timeout and unrelated `.context/` work were excluded from this review.

### Guardrails Verdict
- Contract: `durable`
- Contract version: `2`
- Status: `pass`
- Gates:
  - `unit_test_gate=pass`
  - `functional_test_gate=skipped`
  - `lint_gate=skipped`
  - `patch_gate=advisory`
  - `global_ratchet=pass`
  - `complexity_gate=pass`
- Coverage: `81.5%`, baseline `79.4%`
- New complexity violations: none

### User Goal Analysis
- Goal: prevent new work from reusing completed subjects or inheriting sibling-plan completion, with one lifecycle authority.
- Met:
  - Selected plans only see owned phases.
  - Completed and stale verified-closed subjects are excluded from reuse.
  - Lifecycle mutations use named intents.
  - Direct-writer audit and bundle parity are enforced.
- Partial:
  - `b-save-improved` performs the correct lifecycle operation but does not surface refusal/blocker information.
- Missing:
  - Accurate improved-save terminal reporting when close verification refuses.
- Verdict: **partially met**

### Finding

**In-plan — `/b-save-improved` reports success when subject closeout was refused**

`skills/b-save-improved/scripts/save-apply.ts` intentionally returns exit 0 after successful artifact writes even when `close-verified` returns `not-verified` or `legacy-ambiguous`; the semantic result is placed in `report.lifecycle`. This preserves completed save work as required.

However, `extensions/b-save-improved/index.ts:682-706` parses only `applied`, `staged_inferred`, and `errors`. It never reads `lifecycle`, then unconditionally calls:

```ts
activity.succeed("checkpoint written");
```

at line 753. The user receives no blockers and no indication that the subject stayed open.

Iteration artifact updated:

`.context/2026-09-19.subject-work-state/iterate-subject-work-state.md`

### Documentation Impact
- No additional documentation impact. The authority and lifecycle conventions are already reflected in `AGENTS.md` and `docs/buck-workflow.md`.
- Recommended: none.

### How-to Impact
- No how-to impact.
- Recommended: none.

### Issue Classification
- In-plan issues: **1** — improved-save lifecycle result propagation.
- Out-of-plan issues: none.

### Verdict
**Needs work**

### Recommended Next Step
Supervisor should route the updated iteration artifact through `/b-iterate`, then rerun `/b-review` against the same plan.
