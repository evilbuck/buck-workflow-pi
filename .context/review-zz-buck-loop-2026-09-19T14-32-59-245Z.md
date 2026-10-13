## Plan Path Review: deterministic subject work-state

### Plan Source
- File: `.context/2026-09-19.subject-work-state/plan-subject-work-state.md`
- Goal: plan-scoped phase scanning plus one deterministic subject-lifecycle authority and complete caller cutover.
- Baseline: `HEAD da0a1e2`; reviewed the current unstaged implementation. The branch contains unrelated work, so acceptance was verified from current source state and plan-specific tests rather than treating the entire working-tree diff as this plan.

### Evidence Sources
- Git status: no staged changes; plan implementation is unstaged alongside unrelated subject work.
- Relevant implementation: lifecycle authority, scan, context helpers, save flows, runtime extensions, workflow instructions, bundle copies, package script, and CI job.
- Direct verification:
  - Guardrails passed.
  - Repository lifecycle audit reported zero violations.
  - Canonical/Codex lifecycle files are byte-identical.
  - Live lifecycle CLI reached completed revision 5 through the full transition sequence.
  - Independent negative audit smoke reproduced one false negative.

### Completion Matrix

| Step | Status | Evidence |
|---|---|---|
| 1. Plan-scoped scanning | ✅ complete | `extensions/buck-loop/scan.ts:163-244`; mixed-plan and sole-plan cases in `scan.test.ts` |
| 2. Lifecycle contract tests | ✅ complete | `skills/_shared/scripts/subject-lifecycle.test.ts`; guardrails unit gate passed |
| 3. Canonical lifecycle authority | ✅ complete | `subject-lifecycle.ts:5-360`; named intents only, internal close verification, atomic replacement |
| 4. Shared readers/resolution | ✅ complete | `context-helpers.ts:409-413`; `subject-resolution.md:18-27` |
| 5. Runtime extension migration | ✅ complete | `plan-artifact.ts:226-282`, `code-review-iteration/report.ts:121-152`, save-improved integration |
| 6. Workflow caller migration | ✅ complete | Repository audit currently reports no shipped direct writers |
| 7. Active `/b-save` ordering | ✅ complete | `skills/b-save/SKILL.md` and `prompts/b-save.md` place lifecycle closeout last and preserve checkpoint work on refusal |
| 8. `/b-save-improved` lifecycle-last behavior | ✅ complete | `save-apply.ts:423-446,495-508`; extension surfaces refusal at `index.ts:708-756` |
| 9. Codex bundle parity | ✅ complete | Canonical and bundled authority/test files passed byte comparison |
| 10. Syntax-aware policy enforcement | 🔄 partial | Direct inline and nested object writes are detected, but identifier-indirected target/content writes are missed |
| 11. Required smoke scenarios | 🔄 partial | Lifecycle CLI and clean audit passed; negative smoke exposed the policy-audit false negative |

### Review Axes
- **Spec axis worst finding:** The PR policy audit does not prevent a common direct-writer shape required by implementation step 10.
- **Standards axis worst finding:** Same enforcement-boundary defect. The AST pass inspects only literals/object fields nested directly in the write call, creating false confidence in the repository policy. Sequential fallback standards pass used TypeScript, universal-quality, and diff-relevant code-smell guidance.
- **Cross-axis ranking:** none.

### Verification Status
- Goal achieved: **partial**
- User goal: known stale-subject and sibling-phase failure paths are addressed, but the “must not write lifecycle fields directly” enforcement is incomplete.
- Scope adhered: yes for reviewed implementation.
- Out-of-scope working-tree changes: separate buck-loop timeout, chooser, ideas, and settings subjects were present and excluded from this plan’s verdict.

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
  - Finished legacy subjects are excluded from reuse.
  - Lifecycle transitions use named intents.
  - Active and improved save flows preserve lifecycle refusals.
- Partial:
  - The direct-write prohibition is not reliably enforced for identifier-indirected TypeScript writes.
- Missing:
  - Audit dataflow sufficient to catch the reproduced writer shape.
- Verdict: **partially met**

### Documentation Impact
- Living documentation is already updated in `docs/buck-workflow.md` and the managed `AGENTS.md` conventions block.
- Recommended: none beyond correcting implementation and re-reviewing.

### How-to Impact
- No how-to impact.

### Issue Classification
- In-plan issues: **1**
  - `auditTypeScript` misses identifier-indirected lifecycle writes.
- Out-of-plan issues: none.

### Verdict
**Needs work**

The repository audit currently returns:

```json
{"ok":true,"violations":[]}
```

But this direct writer also returns clean:

```ts
const indexPath = join(dir, "index.md");
const contents = "---\nstatus: active\n---\n";
writeFileSync(indexPath, contents);
```

`auditTypeScript` only gathers literals and lifecycle-bearing object expressions contained directly inside each call at `skills/_shared/scripts/subject-lifecycle.ts:433-454`; the test fixtures at `subject-lifecycle.test.ts:236-266` only cover inline call arguments.

### Artifact
Updated:

`.context/2026-09-19.subject-work-state/iterate-subject-work-state.md`

It contains the reproduced defect and proposed fix.

### Recommended Next Step
`/b-iterate` against the recorded audit false negative, then rerun `/b-review` against the same plan.
