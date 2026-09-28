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

The canonical fix-pr skill documents three layers: optional `pr://` orientation/targeted inspection, exhaustive ingest through registered `fix_pr_feedback` when available or sibling CLI otherwise, and agent validation of the one authoritative inventory. Phase 1 and 5c ingest procedures include seen-ID polling and failure policy; the existing `headRefOid` revalidation rules remain. The physical Codex copy matches the canonical skill byte-for-byte.

Verification: `cmp skills/fix-pr/SKILL.md plugins/buck-workflow/skills/fix-pr/SKILL.md` passed. The phase-required `bunx vitest run scripts/codex-plugin.test.ts` had 6/7 passing; the unrelated copies `b-grill-me/SKILL.md` and `b-grill-with-docs/SKILL.md` fail parity. Re-running only the byte-parity test also failed on those same unrelated copies, so no repo-wide bundle files were changed. The phase acceptance criterion requiring the named parity suite to pass remains unchecked for supervisor resolution. Changes are docs-only; deterministic code guardrails are skipped.
