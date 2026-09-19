## Plan Path Review: deterministic subject work-state

### Plan Source
- File: `.context/2026-09-19.subject-work-state/plan-subject-work-state.md`
- Goal: plan-scoped phase scanning, canonical subject-lifecycle authority, and complete caller cutover.
- Baseline: `HEAD da0a1e2`; reviewed current unstaged implementation. Unrelated concurrent subjects were excluded through current-source and plan-specific verification.

### Evidence Sources
- Git status: no staged changes; implementation remains unstaged alongside unrelated work.
- Relevant implementation inspected: lifecycle authority, scan, context helpers, save flows, runtime extensions, workflow instructions, Codex bundle, package script, and CI job.
- Focused tests: 8 files, 151 tests passed.
- Lifecycle policy audit: `{"ok":true,"violations":[]}`.
- Canonical/Codex lifecycle authority and test copies: byte-identical.
- Guardrails: durable v2 contract passed.

### Completion Matrix

| Step | Status | Evidence |
|---|---|---|
| 1. Plan-scoped scanning | ✅ complete | `extensions/buck-loop/scan.ts:163-244`; mixed-plan, sole-plan, malformed-owner, and explicit-phase tests passed |
| 2. Lifecycle contract tests | ✅ complete | `skills/_shared/scripts/subject-lifecycle.test.ts`; focused suite and unit gate passed |
| 3. Canonical lifecycle authority | ✅ complete | `subject-lifecycle.ts:7-361`; named intents, internal verification, atomic replacement |
| 4. Shared readers/resolution | 🔄 partial | Runtime helpers and shared resolution use inspection, but `skills/b-plan-update/SKILL.md:72` still instructs reading raw subject `status` |
| 5. Runtime extension migration | ✅ complete | `plan-artifact.ts`, `code-review-iteration/report.ts`, and save-improved use lifecycle inspection/intents |
| 6. Workflow caller migration | 🔄 partial | Direct writers are removed, but one repository-owned reader remains outside the authority |
| 7. Active `/b-save` ordering | ✅ complete | Lifecycle closeout runs after consolidation and preserves saved work on refusal |
| 8. `/b-save-improved` lifecycle-last behavior | ✅ complete | `save-apply.ts:421-451,505-508`; extension surfaces refusal without rollback |
| 9. Codex bundle parity | ✅ complete | Authority and tests passed byte comparison; focused parity test passed |
| 10. Policy enforcement | ✅ complete | Identifier-indirected writer fixtures now fail; repository audit reports zero violations |
| 11. Smoke and deterministic checks | ✅ complete | Focused suite, audit, parity, and durable guardrails all passed |

### Review Axes
- **Spec axis worst finding:** `skills/b-plan-update/SKILL.md:72` retains raw lifecycle-status reading, violating the planned clean cutover.
- **Standards axis worst finding:** none independent. Sequential fallback used the TypeScript guide and diff-relevant Long Method, Duplicate Code, and Shotgun Surgery guidance.
- **Cross-axis ranking:** none.

### Verification Status
- Goal achieved: **partial**
- User goal: functional stale-subject and sibling-phase failures are fixed, but lifecycle reader centralization is incomplete.
- Scope adhered: yes for reviewed plan changes.
- Out-of-scope changes: unrelated buck-loop timeout and other subject work were present in the working tree and excluded from this verdict.

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
- Coverage: 81.5%; baseline 79.4%
- New complexity violations: none

### User Goal Analysis
- Met:
  - Selected plans ignore sibling phases.
  - Closed legacy subjects are excluded from reuse.
  - Lifecycle transitions use named intents.
  - Save flows preserve and report close refusals.
  - Shipped direct lifecycle writers are policy-audited.
- Partial:
  - `b-plan-update` still directs agents to inspect the raw compatibility scalar.
- Missing:
  - Complete lifecycle-reader cutover in `b-plan-update`.
- Verdict: **partially met**

### Documentation Impact
- Living documentation already records the lifecycle authority and direct-write prohibition.
- Recommended: none.

### How-to Impact
- No how-to impact.

### Issue Classification
- In-plan issues:
  1. `skills/b-plan-update/SKILL.md:72` bypasses canonical lifecycle inspection for one read.
- Out-of-plan issues: none.

### Verdict
**Needs work**

Updated iteration artifact:

`.context/2026-09-19.subject-work-state/iterate-subject-work-state.md`

The expected workflow route is `/b-iterate`, followed by another review against the same plan. Loop-state selection remains with the supervisor.
