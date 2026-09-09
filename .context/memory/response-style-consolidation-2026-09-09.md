---
date: 2026-09-09
domains: [agent-instructions, bootstrap, docs]
topics: [response-style, global-agents-bootstrap, consolidation, bootstrap-drift, symlink-install]
related: ["GLOBAL_OR_PROJECT-AGENTS.md"]
priority: medium
status: completed
subject: 2026-09-09.review-response-style
artifacts:
  - GLOBAL_OR_PROJECT-AGENTS.md
  - .context/2026-09-09.review-response-style/plan-response-style-consolidation.md
  - .context/2026-09-09.review-response-style/review-response-style-2026-09-09.md
---

# Response-style consolidation in the global bootstrap

Merged three overlapping response-style policies in `GLOBAL_OR_PROJECT-AGENTS.md` into one canonical section, and fixed two stale bootstrap install targets.

## What changed

- **One section replaces three.** `## Response Style (Default — Always On)` at line 7 (16 lines + one example) replaces `Communication Style (Default — Always On)` (7-27), `Default Response Style` (278-296), and the uncommitted 228-line `Response Style: Concise, Contextual, Low-Noise` (310-536).
- File: 536 (working) / 308 (HEAD) → **285 lines**. Response-style share dropped from ~50% of the bootstrap to ~7%.
- `~/.pi/agent/AGENTS.md` was a plain copy 318 diff lines behind; replaced with a symlink to the repo file (backup at `/tmp/pi-agents-md-backup-2026-09-09.md`).
- `~/.local/share/buck-workflow-pi` (source of the `~/.claude/CLAUDE.md` symlink) was stuck at `c6859ec`; pulled to `f99e87b`.

## Review validation

Second pass confirmed all four findings and every inline comment in `review-response-style-2026-09-09.md`. Two additions:

1. **Four competing templates, not a heading conflict.** The file prescribed four response shapes (`:20-23`, `:289-292`, `:325-330`, `:374-384`) with no precedence rule. `:374` used bold labels rather than markdown headings, so the literal clash with `:16` was weaker than the review claimed — the ambiguity was worse.
2. **The change was already live.** `~/.omp/agent/AGENTS.md` is a symlink into this repo, so the uncommitted +228 governed OMP sessions before any commit. There is no staging step for this file.

`:469-489` ("do not sacrifice necessary context") was the only unique idea in the 228-line block — preserved as the *Concise is not cryptic* bullet. A plain revert would have lost it.

## Decisions

- Consolidation, not revert: the pre-existing duplicate at 278 is what made a third section look necessary.
- Survivor lives in the line-7 slot, before workflow content.
- No fixed response template. Length guidance has no floor ("1–5 sentences or a compact list… never pad").
- Phrase blacklists dropped — `No filler` covers them categorically and blacklists invite synonym dodging.
- Bootstrap install targets should all be symlinks; copies drift silently.

## Verification

- `grep '^## .*Response Style\|^## Communication Style'` → exactly one match (line 7).
- Absent: `2–5 short paragraphs`, `Let me walk you through`, `signal density`, `Concise by default is the personality`, first-person `my input` / `when I ask`.
- Present: `Concise is not cryptic`, `security concerns`, `never pad`.
- `git diff -U0` hunks confined to the two intended regions; tail byte-identical to HEAD after the deleted section.
- `diff ~/.pi/agent/AGENTS.md GLOBAL_OR_PROJECT-AGENTS.md` → empty.
- Guardrails: docs-only session (`.md` at repo root + `.context/`) → deterministic check gate skipped per the Deterministic Check Contract.

## Follow-up

`~/.local/share/buck-workflow-pi` needs one more `git pull` after this lands on `master`, or the Claude Code bootstrap stays one commit behind.
