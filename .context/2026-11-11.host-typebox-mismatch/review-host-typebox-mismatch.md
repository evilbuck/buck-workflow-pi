## Plan Path Review: host-typebox-mismatch

### Plan Source
- File: `.context/2026-11-11.host-typebox-mismatch/plan-host-typebox-mismatch.md`
- Goal: runtime schema checks work against whichever typebox family the host loaded
- Baseline: uncommitted worktree vs HEAD, plus live OMP 18.19.0 smoke

### Evidence Sources
- `npm test`: vitest 2383 passed / 49 skipped; bun 70 passed; sqlite runtime smoke passed
- Focused vitest after the type-narrowing fix passed
- `npm run subject-lifecycle:check`: `{"ok":true,"violations":[]}`
- OMP smoke session `2026-11-12T12-17-17-283Z_01a1cfb0`: zero `Token attribution persistence failed` hits; three attribution rows persisted

### Completion Matrix

| Step | Status | Evidence |
|------|--------|----------|
| 1 helper | complete | `extensions/typebox-check.ts` |
| 2 five call sites | complete | no `Value.Check` in the three runtime files |
| 3 schemas untouched | complete | check path only |
| 4 tests | complete | helper tests and repeat-insert test; focused vitest green |
| 5 backlog | complete | backlog item and todo checkbox |
| 6 A-4 report | complete | plan Findings |

### Review Axes
- Spec axis worst finding: none
- Standards axis worst finding: omitted — parallel reviewer returned no result
- Cross-axis ranking: none

### Verification Status
- Goal achieved: yes for the toast path
- User goal: met for the persistence warning; A-4 reported, not fixed
- Scope adhered: yes
- Out-of-scope changes: none in this diff

### Guardrails Verdict
- Contract: durable, version 2, status pass
- Gates: unit_test_gate=pass, functional_test_gate=skipped, lint_gate=skipped, patch_gate=pass, global_ratchet=pass, complexity_gate=pass
- Coverage current 88.2 vs baseline 84. Implementation files 100% on diff-cover. Combined compare total 97% includes unrelated `scripts/install.mjs`.

### Documentation Impact
- Convention added: extensions use `checkSchema`, not `Value.Check`
- How-to impact: none

### Issue Classification
- In-plan issues: none in the code. Repeat-insert acceptance box left open because jev scored 0.43–0.49 even after the named vitest pass lines. Plan `status` stays active.
- Out-of-plan issues: A-4 `Type.Unsafe` degradation, already deferred

### Verdict
Pass with warnings — open acceptance stamp only; no code defect found

### Recommended Next Step
Commit the fix. Do not mark the plan completed until the repeat-insert box is stamped or the criterion text is rewritten and re-judged.
