---
status: completed
date: 2026-10-03
subject: 2026-10-03.buck-loop-iterate-closeout
topics: [plan-validation, buck-loop, iterating, native-judgment]
informs: [plan-iterate-closeout.md]
---

# Plan validation: iterate closeout

## Verdict

**Retain the central design; revise the plan before implementation.** Native TypeSafe Jev `jev-1.13.0` classified all 14 sections as `needs_revision`. A narrower judgment of the central design after correcting the documented defects returned `retain` (P=0.96; confidence=0.95). That is conditional support, not approval of the original plan as written.

Jev supplies bounded labels/probabilities, not explanations. Recommendations below are source-backed reviewer analysis. Choice confidence measures distribution concentration, not proof of correctness.

## Target and evidence

- Latest user direction: incident in `../review-ranking.wt`, plan copied here to fix directly. This plugin checkout is the fix target; no separate clean branch is required.
- Main baseline: `chore/cleanup-skills`, HEAD `b184c34ae00a686ac7410321b226951e24f6c30e`. Existing staged/unstaged changes were preserved.
- Main `scan.ts:349-352` ignores only completed. Incident checkout `scan.ts:349-354` also ignores below-waterline. Ranking phase and iteration artifacts corroborate the lifecycle clash.
- Both incident iteration artifacts record active status after implementation evidence. They also report unrelated required SQL gate failures; those reported failures were not rerun.
- Exact plan, source evidence, native section questions/answers/probabilities, and smoke output: [research-jev-section-judgments.json](research-jev-section-judgments.json).

## Section judgments

| Section | Jev verdict | P(selected label) | Recommendation |
|---|---|---:|---|
| User Goal | needs_revision | 0.93 | Keep the goal; removal of a spurious artifact-status handoff must not bypass limits or genuine failed gates. |
| Goal | needs_revision | 0.96 | Keep deterministic close then review, but distinguish artifact delivery from accepted completion; the hook misses successful iterations after a retry. |
| Context used / assumptions | needs_revision | 0.93 | Correct the copied scanner assumption: below-waterline is ignored in the incident worktree, not this main checkout. |
| Decision Closure | needs_revision | 0.95 | Retain the mechanical decision; repair before routing bypasses ambiguity handling, preserving counters and limits. |
| Assumptions Ledger | needs_revision | 0.96 | A-2 describes a selected tradeoff and a future integration proof, not a validated implemented helper. |
| Material Risks | needs_revision | 0.98 | Add malformed metadata and ineffective/failed writes; two-file nonmutation is not a guarantee of blocking because Jev may retry. |
| Scope | needs_revision | 0.97 | Include shared scanner discovery, bundled skill changes, and all conflicting supervised-child instructions. |
| Out of scope | needs_revision | 0.80 | Keep ranking and SQL fixes excluded; explicitly allow the minimal scanner compatibility change needed for AC-5. |
| Affected files | needs_revision | 0.96 | Add scan.ts, relevant scanner coverage, and both physical plugin skill copies. |
| Implementation steps | needs_revision | 0.93 | Bound frontmatter rewriting, confirm effective mutation, repair before next(), and clarify b-iterate line74. |
| Acceptance criteria | needs_revision | 0.98 | Add successful-after-retry, limit preservation, malformed/write-failure, and review-rejection/reopening cases. |
| Verification | needs_revision | 0.99 | Gate enforcement is accurate; add packaging parity and disposable public-supervisor smoke without waiving known gate failures. |
| Execution Instructions | needs_revision | 0.97 | Fix directly in this plugin checkout; preserve unrelated work and correct the generalized phased/unphased resume claim. |
| Risks | needs_revision | 0.69 | Keep restart and incomplete-child warnings; add baseline/write safety and explicit preservation of required quality gates. |

## Prioritized recommendations

1. **Resolve the copied scanner contract.** Implement here; add `extensions/buck-loop/scan.ts` to scope and use one shared unfinished-artifact discovery rule for scanner, close target, and diagnosis. Exclude completed and below-waterline files while retaining active files as blockers. This is minimal scanner compatibility, not adoption of ranking. Without it, AC-5 cannot pass here: the helper would skip below-waterline while the scanner still reports ambiguity.

2. **Close after successful iteration, before machine routing.** `resolveAmbiguity()` is only reached through an available retry/advance choice (`loop.ts:463-490`). One used retry or exhausted loop limits bypass it and block (`machine.ts:66-75,147-155`), observed in smoke. Put mechanical repair on the successful iteration-result path before the next `next()`. Preserve retry counters and work limits. Fresh review is the next permitted work effect; exhausted limits may still block. Never jump to saving.

3. **Make the frontmatter write bounded and effective.** Do not copy whole-document regex rewriting blindly (`ambiguity.ts:41-49`). Missing/malformed/unreadable status still counts unfinished (`scan.ts:574-590`). Require editable valid active frontmatter, preserve the issue body, update the two date fields, and confirm a real status change before rescanning; otherwise fail closed. An ineffective write returning true can repeatedly reset/re-enter the same ambiguity. Reuse existing parsing conventions.

4. **Finish the lifecycle cutover on every surface.** Also clarify `skills/b-iterate/SKILL.md:74`, which still forbids yielding until review and save. A supervised iterate child completes its assignment and returns; the supervisor owns review/save (`run-step.ts:188-198`). Keep standalone closeout distinct. Update `plugins/buck-workflow/skills/b-iterate/SKILL.md` and `plugins/buck-workflow/skills/b-review/SKILL.md`; physical-copy byte parity is enforced (`scripts/codex-plugin.test.ts:8-16,34,41,102-114`). Artifact completion never waives required quality gates.

5. **Verify the tradeoff, not just the happy path.** Add public-supervisor cases for successful-after-retry, work-limit preservation, reviewer rejection/new active artifact, malformed metadata/failed writes, and both incident shapes. Keep two-file nonmutation and failed-child cases. Add plugin parity and a disposable supervisor smoke. A-2 becomes validated only when the new close-and-re-review path is exercised. Existing required SQL failures need resolution or an explicit operator override before actual closeout; this repair does not clear them.

6. **Correct execution and recovery instructions.** Replace clean-branch/copy instructions with direct scoped work here, preserving the existing index. `persist.ts:201-216` synthesizes confirmed work only when retaining a completed projected phase after the scanner selects a different phase. An unphased projection with no phase path cannot take that shortcut; its open-plan resume is not guaranteed to go directly to review. Keep restart required and historical projections untouched. Replace reset-based mixed-commit rollback with scoped revert/reapplication that preserves user work.

## Executed verification

A disposable Bun script imported actual main-checkout `scan()`, `next()`, and `explainAmbiguity()`. Six scanner/machine scenarios plus the completed-status diagnostic were exercised, then all temporary files were removed:

- Active artifact, first successful result: ambiguity choice with retry/advance.
- Active artifact, successful result after one used retry: blocked before ambiguity repair.
- Active artifact at loop limit: blocked before ambiguity repair.
- Below-waterline artifact on this base: ambiguous.
- Completed artifact: confirmed, next work effect review.
- Fresh active artifact after review: routes to iteration.
- Completed-status diagnostic actually emitted `phase status is completed, not completed.`

Observed terminal result: **SMOKE PASS: six scanner/machine cases plus completed-status diagnosis**.

This verifies existing routing and review findings, not the unimplemented close helper. No runtime source, original plan, incident artifact, production projection, or existing index entry was changed. Only these research artifacts were created. No tests or guardrails were run: this review changes only `.context/` artifacts, so its code-change gate is not applicable.
