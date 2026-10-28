Phase 2 apply implementation and regression coverage are staged in `classify.ts` and `classify.test.ts`. Added fixture checks for fresh `ask` refusal, protected branches, safe worktree removal, failed removal preserving the branch, and pruning without directory deletion.

Verification: 31/31 focused tests passed; `npm run guardrails:check` passed (durable v2; functional and lint gates skipped); classify-only smoke reported this checkout as `skip`. I did not run `--apply` against this checkout.

Other staged context files and untracked review artifacts were left untouched.
