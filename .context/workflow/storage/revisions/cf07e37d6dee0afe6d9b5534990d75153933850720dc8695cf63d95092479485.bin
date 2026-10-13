## Plan Path Review: deterministic subject work-state

### Plan Source
- File: `.context/2026-09-19.subject-work-state/plan-subject-work-state.md`
- Goal: plan-scoped Buck-loop scanning plus one canonical subject-lifecycle authority and complete caller cutover.
- Baseline: `da0a1e2`; current worktree inspection. Unrelated concurrent `.context/`, `docs/ideas.md`, and package-tarball changes were excluded.

### Completion Matrix

| Step | Status | Evidence |
|---|---|---|
| 1. Plan-scoped phase scanning | ✅ complete | `extensions/buck-loop/scan.ts:163-258`; mixed-plan and sole-plan regressions at `extensions/buck-loop/__tests__/scan.test.ts:165-205` |
| 2. Lifecycle transition coverage | ✅ complete | Legal edges, retries, refusals, legacy handling, preservation, and CLI semantics at `skills/_shared/scripts/subject-lifecycle.test.ts:36-229` |
| 3. Canonical API and CLI | ✅ complete | Named intent union and dispatch at `skills/_shared/scripts/subject-lifecycle.ts:7-13,310-360,476-513` |
| 4. Shared reader/resolution migration | ✅ complete | `skills/_shared/scripts/context-helpers.ts:407-433`; `skills/_shared/subject-resolution.md:18-27` |
| 5. Runtime extension migration | ✅ complete | `extensions/plan-artifact.ts:229-294`; `extensions/code-review-iteration/report.ts:121-159`; corresponding tests passed |
| 6. Skill/prompt caller migration | ✅ complete | Repository audit currently reports zero violations |
| 7. Active `/b-save` ordering | ✅ complete | Lifecycle closeout is explicitly last in `skills/b-save/SKILL.md` and `prompts/b-save.md` |
| 8. `b-save-improved` ordering | ✅ complete | `skills/b-save-improved/scripts/save-apply.ts:424-448,497-508`; `subject_index_status` rejected at lines 464-466 |
| 9. Codex bundle parity | ✅ complete | Canonical-copy parity covered by `scripts/codex-plugin.test.ts:89-106`; full suite passed |
| 10. Syntax-aware policy audit | 🔄 partial | Audit passes, but `auditTypeScript` misses object-property writes because it only collects string literals and searches for literal `status:` text (`subject-lifecycle.ts:394-404`) |
| 11. Verification scenarios | ✅ complete | Guardrails passed all required gates; lifecycle audit returned `{"ok":true,"violations":[]}` |

### Review Axes
- **Spec axis worst finding:** lifecycle policy audit can produce a false green for direct object-field writes.
- **Standards axis worst finding:** same missing negative boundary in the AST policy checker; sequential portable fallback used.
- **Cross-axis ranking:** none.

### Guardrails Verdict
- Contract: `durable`
- Contract version: `2`
- Status: `pass`
- Gates: unit=`pass`, functional=`skipped`, lint=`skipped`, patch=`advisory`, global ratchet=`pass`, complexity=`pass`
- Coverage: `81.5%`; no new complexity violations.

### Verification Status
- Goal achieved: **partial**
- User goal: core runtime behavior is implemented; enforcement cannot yet guarantee the direct-write prohibition.
- Scope adhered: yes for plan-owned changes.
- Out-of-scope changes: unrelated existing worktree files were excluded from this review.

### Finding

**In-plan — policy audit false negative**

`skills/_shared/scripts/subject-lifecycle.ts:394-404` gathers only string-literal descendants and requires concatenated text to match `status:`. This direct writer is therefore not detected:

```ts
writeFileSync(
  join(dir, "index.md"),
  setFrontmatterFields(old, { status: "active" }),
);
```

The property name `status` is an identifier, not a string literal. The dedicated CI job can pass while shipped code bypasses the lifecycle authority.

Iteration artifact written:

`.context/2026-09-19.subject-work-state/iterate-subject-work-state.md`

### Documentation Impact
- No additional documentation impact; authority and conventions are already reflected in `AGENTS.md` and `docs/buck-workflow.md`.

### How-to Impact
- None.

### Issue Classification
- In-plan issues: **1**
- Out-of-plan issues: none

### Verdict
**Needs work**

### Required Next Step
`/b-iterate` should extend the AST audit to detect lifecycle object properties reaching an `index.md` write and add a regression fixture for the example above. Then rerun `/b-review` against the same plan.
