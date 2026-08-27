---
date: 2026-08-27
domains: [review, security, extensions, testing]
topics: [fix-pr, pr-10, b-save-improved, path-containment, apply-failure, yaml-frontmatter]
subject: 2026-08-26.deterministic-bsave
artifacts:
  - skills/b-save-improved/scripts/save-apply.ts
  - skills/b-save-improved/scripts/save-apply.test.ts
  - extensions/b-save-improved/index.ts
  - extensions/b-save-improved/__tests__/handler.test.ts
related:
  - fix-pr-10-2026-08-27.md
priority: high
status: completed
---

# fix-pr: PR #10 remaining blockers

## PR

- https://github.com/evilbuck/buck-workflow-pi/pull/10
- Head validated: `d244c5a38c8f2ff7786e8119702b2dad269c3e20`

## Validation

| # | Claim | Verdict | Evidence / disposition |
| --- | --- | --- | --- |
| 1 | A missing immediate parent can bypass ancestor-symlink containment. | valid | `containedContextPath` returned the lexical path when its immediate parent did not exist. It now canonicalizes the nearest existing ancestor before resolving the tail. |
| 2 | A nonzero apply continued into post-apply actions. | valid | The handler logged `recordCommandError` but then notified, re-indexed, and emitted the retain handoff. It now returns immediately. |
| 3 | Multiline frontmatter strings could inject a YAML fence. | valid | `yamlScalar` did not classify CR/LF as YAML-sensitive. It now JSON-quotes multiline strings. |

The later extract review claimed no delta findings at the same commit. Its conclusion conflicts with the three concrete code paths above; it was not treated as clearance.

## Changes

- Walk to the nearest existing ancestor before canonical containment checks for non-existent targets.
- Quote CR/LF-bearing YAML scalars.
- Stop the extension after a failed apply.
- Add regressions for the missing-parent symlink bypass, YAML-fence injection, and failed-apply post-actions.

## Verification

- `npx vitest run skills/b-save-improved/scripts/save-apply.test.ts extensions/b-save-improved/__tests__/handler.test.ts` — 33 passed.
- TypeScript LSP diagnostics — clean for all three changed implementation/test files.
- `git diff --check` — clean.
- /b-guardrails-check — unit 434/434, coverage 70.45% (ratchet pass), patch coverage 90.79% (pass), lint and functional gates skipped. Complexity gate reports pre-existing PR hotspots; the documented 2026-08-27 explicit override applies because this diff adds no branch/CCN and lizard still parse-glues parseArgs across lines 32–677.

## Closeout

Code commit: 155e07cec5c37a80d5b450cda22bd33472317aad (fix(b-save-improved): address PR #10 remaining blockers), pushed to origin/feat/deterministic-bsave.
