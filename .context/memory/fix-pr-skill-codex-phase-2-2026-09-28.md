---
date: 2026-09-28
domains: [skills, docs, testing]
topics: [fix-pr, pr-resource, agent-tool, codex-parity]
related:
  - .context/2026-09-28.fix-pr-native-pr-tool/phase-2-skill-and-codex-copy.md
priority: medium
status: active
subject: 2026-09-28.fix-pr-native-pr-tool
artifacts:
  - .context/2026-09-28.fix-pr-native-pr-tool/phase-2-skill-and-codex-copy.md
  - skills/fix-pr/SKILL.md
  - plugins/buck-workflow/skills/fix-pr/SKILL.md
---

# fix-pr skill and Codex copy — Phase 2

The canonical fix-pr skill documents optional `pr://` orientation/targeted inspection, exhaustive ingest through registered `fix_pr_feedback` when available or sibling CLI otherwise, and agent validation against one authoritative inventory. Phase 1/5c retain explicit failure policy and `headRefOid` revalidation. The physical Codex copy remains byte-identical.

Fresh verification: `cmp skills/fix-pr/SKILL.md plugins/buck-workflow/skills/fix-pr/SKILL.md` passed. `bunx vitest run scripts/codex-plugin.test.ts` failed 1 of 7 tests; the only reported offenders are unrelated `b-build/SKILL.md`, `b-grill-me/SKILL.md`, and `b-grill-with-docs/SKILL.md`. No unrelated copies were modified. Phase 2 remains in progress because its required parity suite does not pass.
