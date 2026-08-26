---
title: Raise patch coverage vs origin/master above 90%
status: active
priority: medium
created: 2026-08-26
updated: 2026-08-26
completed: null
related:
  - guardrails.json
  - extensions/b-kamal-release/index.ts
  - extensions/b-pr-improved/index.ts
  - extensions/b-commit-improved/index.ts
  - extensions/command-progress.ts
  - .context/2026-08-26.b-init-guardrails-on-repo/index.md
---

# Raise patch coverage vs origin/master above 90%

First `/b-guardrails-check` after recording `guardrails.json` failed `patch_gate` at **51%** (need 90%). `diff-cover` compared `origin/master...HEAD` plus staged/unstaged. 149 lines, 72 missing.

Not caused by `guardrails.json` / AGENTS.md init files. Uncovered executable lines:

- `extensions/b-kamal-release/index.ts` — 0% (327–476 deploy/version path)
- `extensions/b-pr-improved/index.ts` — 39% (55, 325–376)
- `extensions/b-commit-improved/index.ts` — 80% (420, 471)
- `extensions/command-progress.ts` — 95.8% (28–29)

These sit on the dirty/unpushed tree that `current-session.json` still attributes to `2026-08-20.deterministic-extension-progress`. Add tests or drop uncovered lines from the branch before the patch gate can pass.
