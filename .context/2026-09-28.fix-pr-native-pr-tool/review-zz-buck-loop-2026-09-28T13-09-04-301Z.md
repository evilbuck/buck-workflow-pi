## Phase 1 Review: Tool Contract + Adapter Extension

**Verdict: Needs work.** The adapter is wired and its focused tests pass, but cancellation does not reliably dispose of the child or clean the seen-ID directory.

| Phase requirement | Status | Evidence |
|---|---|---|
| Register `fix_pr_feedback` with the installed tool API | ✅ Complete | `extensions/fix-pr-feedback/index.ts:201-223`; `extensions/index.ts:12,28`; installed `ToolDefinition.execute` signature matches. |
| Spawn the CLI, handle seen IDs privately, return a compact summary | ✅ Complete | `extensions/fix-pr-feedback/index.ts:79-135,165-190`; private inventory creation at `skills/fix-pr/scripts/fetch-feedback.ts:858-900`. |
| Fail closed and clean up on cancellation | 🔄 Partial | Abort sends SIGTERM at `extensions/fix-pr-feedback/index.ts:176-184`, but waits for `close` without a deadline. A real Bun child that ignored SIGTERM left the tool pending after 500 ms; forced SIGKILL released it. The test child always closes after `kill` (`extensions/fix-pr-feedback/__tests__/index.test.ts:156-178`). |
| Cover the phase contract with tests | 🔄 Partial | **27 focused tests passed**, but none covers a child that ignores SIGTERM. |

**Review axes:** Spec worst finding: cancellation can hang and defer cleanup. Standards worst finding (sequential fallback): the cancellation fake assumes termination succeeds. No cross-axis ranking.

**Guardrails:** Durable v2 **pass**; unit, patch, coverage ratchet, and complexity gates pass; lint and functional gates skipped. A direct default-path smoke reached CLI argument validation and returned structured exit-code-2 failure without GitHub access. Live PR equivalence remains Phase 4 scope.

**Issue classification:** One in-plan defect; no out-of-plan findings. Phase 1 introduces a tool surface whose skill and public-documentation updates are assigned to later phases. No separate how-to impact identified.

**Next step:** `/b-iterate` using the staged `.context/2026-09-28.fix-pr-native-pr-tool/iterate-tool-contract-adapter-fourth-review.md`, then re-review Phase 1. No loop state was selected.
