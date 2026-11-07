**Needs work — one High in-plan safety defect.**

At `skills/git-cleanup/scripts/classify.ts:279`, `%(refname:short)` is treated as canonical branch identity. With a tag named `main`, Git emits the integration branch as `heads/main`, bypassing the skip check. A disposable repository reproduced:

```json
{"name":"heads/main","disposition":"auto-delete","skip_reason":null,"contained":true}
```

Use full `%(refname)` values and strip exactly `refs/heads/`; add collision regressions for integration protection and worktree deduplication.

- **Spec axis:** High — integration-branch protection fails.
- **Standards axis:** High — ambiguous display names used as canonical identities. Separate sequential fallback pass; no sub-agent tool available.
- **Verification:** 25 classifier tests passed; durable v2 guardrails passed. Actual repository CLI protected the current checkout; unsupported `--apply` exited 1 with unchanged refs.
- **Previous description defect:** current regression passes.
- **Out-of-plan issues / additional documentation impact:** none.

Full completion matrix and reproduction recorded in the **staged review-owned artifact**:
`.context/2026-10-26.git-cleanup-skill/iterate-phase-1-refname-collision-review.md`

Recommended next step: `/b-iterate`, then re-review the same phase. No implementation or loop-state changes made.
