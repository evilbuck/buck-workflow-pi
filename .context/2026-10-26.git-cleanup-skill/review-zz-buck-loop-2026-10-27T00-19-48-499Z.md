## Phase 1 review: Needs work

**6 in-plan issues; no out-of-plan findings.** Full completion matrix and fixes recorded in [iterate-phase-1-classify-json-review.md](.context/2026-10-26.git-cleanup-skill/iterate-phase-1-classify-json-review.md).

### Spec axis
Worst finding: **High — malformed merge-tree output can authorize `auto-delete`.**

- `classify.ts:59` stops at the first empty NUL record and ignores trailing structured records. Injecting an unrecognized trailing record reproduced `contained: true`, `disposition: auto-delete`.
- `classify.ts:104-117` labels unique implementation code `finished` when an unrelated historical subject is completed.
- `classify.ts:84-85` searches only files changed by the tip commit, missing an existing plan H1 that should precede the commit subject.
- `classify.ts:37-41` truncates registered worktree paths containing newlines.
- Required regression scenarios remain absent: eligible ancestor, clean single-commit squash, cherry-pick equivalent, non-current unique code, prunable/missing-gitdir, untracked-only, and ignored-file behavior.
- Required checkpoint fails: the new `skills/git-cleanup/` directory lacks `SKILL.md`, violating the existing skill-catalog invariant.

### Standards axis
Worst finding: **High — external protocol output is incompletely validated before emitting destructive eligibility.** Sequential fallback pass completed using TypeScript/universal-quality guidance and a scoped smell subset. No cross-axis ranking.

### Verification

| Check | Result |
|---|---|
| Classifier tests | **9 passed** |
| Repository CLI smoke | **15 items**; current checkout correctly `skip`; four prunable entries `ask` |
| Targeted disposable scenarios | Reproduced parser, state, description, and pathname defects |
| `--apply` rejection | Exit **1**, empty stdout, usage error |
| Durable v2 guardrails | **Fail** |

Guardrails: `unit_test_gate=fail`, `global_ratchet=fail`, `complexity_gate=pass`; functional/lint skipped; patch advisory. Coverage command failed, so coverage is unavailable—not a measured regression.

No additional documentation/how-to impact beyond the work already assigned to Phase 3.

**Only the new iteration artifact was staged successfully.** Pre-existing changes were left untouched. Recommended follow-up: `/b-iterate` against the artifact, then re-review the same phase; no loop-state transition performed.
