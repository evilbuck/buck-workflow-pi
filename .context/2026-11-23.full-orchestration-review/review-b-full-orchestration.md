---
status: completed
---
# Full-orchestration skill: source review

Goal: autonomously finish phased plans, unphased plans, or work supplied in context; resume without repeating or skipping work. Static contract walk-through, not a live orchestration.

- Preserve one serialized run per slice, independent review, permission to save and commit, and artifact-over-summary verification. The main issue is transition coverage, not excess prose.
- The generic stage loader constructs paths that do not exist: hard build is `skills/b-build/SKILL.md` in hard mode, and commit is `skills/git-commit/SKILL.md`. The latter operates on staged changes only; assign scoped staging before dispatch.
- The outer map lacks a direct planning edge for a clear feature in familiar code with no existing findings or external research need. Plan re-entry after research also needs a guard that admits an existing plan.
- A quick fix is selected before completion on re-entry. A final plan already saved but not yet verified closed can resume directly at commit. Prefer completed proofs, then missing prerequisites, over original task labels.
- The run worker expects a persisted review even on pass; canonical b-review returns a report and need not write one. Record a per-slice verdict tied to the reviewed revision plus gate results and follow-up findings.
- Unphased build assigns completed plan status to the supervisor, and lifecycle closure checks it. No explicit run-worker step synchronizes unphased status from verified acceptance before closure.
- Keep the ordered table authoritative. Replace hand-maintained duplicate diagrams/instructions with a few scenario traces, including restart boundaries.

Sources: skills/b-full-orchestration/SKILL.md:20-62; references/stage-map.md:39-66,120-159 and references/run.md:18-32 under that skill; skills/b-review/SKILL.md:294,376-391; skills/b-build/SKILL.md:310-312; skills/_shared/scripts/subject-lifecycle.ts:187-196; skills/git-commit/SKILL.md:16-28; prompts/{b-build-hard,b-commit}.md:9-13.