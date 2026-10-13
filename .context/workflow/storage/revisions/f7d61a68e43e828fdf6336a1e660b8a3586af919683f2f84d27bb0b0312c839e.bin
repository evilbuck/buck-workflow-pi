---
status: active
date: 2026-07-22
subject: 2026-07-22.fix-pr-diagnosis-codification
---

# fix-pr diagnosis efficiency + codification

Strengthen `fix-pr` skill's PR-diagnosis path: add `--dry-run` mode, review-commit
pinning + cross-review dedup, name the `gh` diagnosis commands, and codify
Phase 1+2 ingestion into one fetch helper script.

## Artifacts

- `plan-fix-pr-diagnosis-codification.md` — implementation plan

## Evidence (dry run on evilbuck/partypic#38)

The dry run surfaced every gap this plan addresses:
- 2 of 4 findings were `already_done` (fixed between the two review commits) —
  current skill lacks commit pinning, risking a re-fix of an already-fixed typo.
- All feedback lived in review bodies; both `pulls/N/comments` and `issues/N/comments`
  were empty — 2 wasted calls the fetch helper collapses.
