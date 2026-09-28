---
date: 2026-09-28
domains: [skills, tooling]
topics: [fix-pr, pr-resource, agent-tool, planning]
related: [.context/2026-09-28.fix-pr-native-pr-tool/plan-fix-pr-native-pr-tool.md]
priority: medium
status: completed
subject: 2026-09-28.fix-pr-native-pr-tool
artifacts: [plan-fix-pr-native-pr-tool.md]
---

# fix-pr native PR/tool integration plan

The user agreed to keep `skills/fix-pr/scripts/fetch-feedback.ts` as the single exhaustive review/thread/check ingest; native `pr://` is useful for orientation and targeted diffs but does not expose all structured settlement evidence. Plan: expose a thin typed agent tool over the script where available, preserve CLI fallback for other harnesses, and revise the skill's script-only prohibition. No source changes made in this planning session. The subject is active and one near-term backlog item tracks implementation. The plan flags the current fixed `/tmp` inventory filename as a collision risk for concurrent tool calls and preserves current-HEAD revalidation.

Verification: read `pr://30` and `pr://30/diff`, existing script/skill, extension registration, Codex bundle contract, and `docs/buck-workflow.md`; lifecycle `initialize` and `activate` returned `ok: true`. Docs-only planning; code guardrails gate skipped.
