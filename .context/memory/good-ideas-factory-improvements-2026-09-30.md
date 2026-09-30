---
date: 2026-09-30
domains: [tooling, testing, ci]
topics: [guardrails, skill-frontmatter, codex-plugin, installer, git-hooks, factory-integrity]
subject: 2026-09-18.good-ideas
artifacts: [plan-buck-workflow-factory-improvements.md, iterate-good-ideas.md, report-factory-improvements.html]
related: []
priority: medium
status: completed
---

# Buck Workflow factory hardening shipped

All 11 acceptance criteria of plan-buck-workflow-factory-improvements.md verified SHIPPED on 2026-09-30 with file:line evidence:

- `scripts/skill-frontmatter.test.ts` validates every `skills/*/SKILL.md` frontmatter (name/dir equality, uniqueness, block-scalar).
- `scripts/codex-plugin.test.ts` enforces the curated Codex bundle spec (`codexOnly=[b-build-hard,b-commit]`, no-twin assert, recursive parity); `plugins/buck-workflow/skills/` is physical.
- `scripts/commands-mirror.test.ts` derives prompts/commands mirroring from the real `prompts/` tree.
- `scripts/install.test.mjs` ships the hermetic npm-pack + login-shell smoke test (`bash -lc 'buck-workflow --list'`).
- `guardrails.json` carries six gates with explicit enforcement states; `skills/b-guardrails-check/scripts/check.mjs` is the single computation source, run by CI via `npm run guardrails:check` (`.github/workflows/test.yml`).
- CI pins `lizard==1.24.0`, `diff-cover==10.5.1`, `fetch-depth: 0`.
- `scripts/hooks.mjs` (install/status/remove, refuses foreign hooks) + `scripts/hooks/pre-push` security-audit launcher.

Note: `iterate-good-ideas.md` (1 critical + 7 warnings) left `active` — those are out-of-plan review findings, not plan criteria; they were not re-verified in this closeout.
