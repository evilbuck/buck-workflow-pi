---
status: active
date: 2026-07-22
subject: 2026-07-22.fix-pr-diagnosis-codification
topics: [fix-pr, skill, gh-cli, pr-review, dry-run, commit-pinning, codification]
research: []
iterations: []
spec:
memory: []
---

# Plan: fix-pr diagnosis efficiency + codification

## User Goal

Any agent (and the human steering it) that runs `fix-pr` on a pull request
diagnoses the PR faster and more correctly: fewer `gh` round-trips (less token
spend), no false fixes chasing a stale review that a later commit already
addressed, and a safe `--dry-run` that validates + reports without mutating
anything. Today the skill re-reads the PR up to three times, doesn't pin
findings to the commit each review was left on, and has no no-mutate mode — so
the human has to enforce "don't write, don't push" by hand.

## Goal

Make `fix-pr`'s diagnosis path (Phase 1–2 + the Phase 3 entry) efficient and
commit-aware, add `--dry-run`, and codify the deterministic ingestion into one
helper script. Touch only `skills/fix-pr/SKILL.md` and add one new script.

## Context used / assumptions

- **User-provided context:** the dry-run analysis of `evilbuck/partypic#38`
  performed in this session. That PR had 2 bot reviews at *different commits*
  (`1a7a6aa` 03:40, `e268458` 10:48), 0 inline comments, 0 conversation
  comments. Finding 1 (typo `occassion`) was valid at commit 1 and already
  fixed at commit 2; finding 2 (`event_date` allowlist) had its requested
  explanatory comment already present at head. The other two were self-described
  nits ("Not a defect", "harmless no-op").
- **Session context:** the four gaps + codification proposal from the analysis
  turn (review-commit pinning, cross-review dedup, `--dry-run`, named `gh`
  diagnosis commands / fetch script).
- **Code read:** `skills/fix-pr/SKILL.md` (full, line-anchored `#957F`).
- **Repo convention:** sibling skills ship helper scripts — `b-pr` has
  `pr-preflight.ts`, `code-review-universal` has `submit-review.ts`. A
  `scripts/fetch-feedback.*` helper under `skills/fix-pr/` is consistent, not a
  new pattern. The skill's "Surface — skill only" rule forbids a *prompt
  wrapper*, not a helper script.
- **Assumptions:**
  - Codification ships as a **script**, not just inline commands — it is the
    high-payoff item the user explicitly asked about ("could any of it be
    codified?") and matches repo conventions. Inline `gh` commands are ALSO
    documented as the portable fallback (belt + suspenders).
  - Language: **`sh` + `jq`** (no Node runtime requirement) so the helper runs
    anywhere `gh` does — matches the skill's agent-agnostic posture. Reconsider
    only if `jq` proves unavailable; `gh … --jq` is the in-binary fallback.
  - The script does the *mechanical* merge (3 sources → 1 ordered feed, each
    finding tagged with source review + commit SHA + `submittedAt`); the
    *semantic* dedup stays with the agent. We do not script judgment.
- **Open questions:** none blocking. Language choice (`sh+jq` vs `bun`) is
  settled by the agent-agnostic assumption above.

## Scope

1. **`--dry-run` mode** — new invoke flag + Phase 4 gate row. Validate +
   inventory + verdict, then hard-stop. No fix, no issue, no commit, no push.
   Memory artifact is allowed (read-only diagnosis still worth recording) but
   the skill must not mutate the repo or PR.
2. **Review-commit pinning** — Phase 2 inventory rules: sort reviews by
   `submittedAt`, tag each finding with its review's commit SHA, treat the
   latest review on a given file/line as authoritative, add a `stale` class
   (finding valid at an earlier commit but superseded on HEAD).
3. **Cross-review dedup** — broaden the `duplicate` rule from "threads" to
   "across all reviews + inline + conversation"; one work item, cite every
   source including the earliest `submittedAt`.
4. **Named `gh` diagnosis commands** — Phase 1 universal fallback: add `files`
   to the `--json` field list; note `--repo <owner/repo>` for out-of-tree /
   dry-run use; document `gh pr diff <N>` for the changed-files diff and the
   `gh api repos/{owner}/{repo}/contents/<path>?ref=<head>` single-file-at-head
   command (with the path-filtered `gh pr diff -- <path>` emptiness gotcha).
5. **Fetch helper script** — new `skills/fix-pr/scripts/fetch-feedback.sh`:
   merges `pr view` + `pulls/N/comments` + `issues/N/comments` into one JSON,
   sorts reviews by `submittedAt`, pins each review's commit SHA, dedups empty
   sources silently, and emits the Phase 2 working-table skeleton with empty
   `status` cells. Documented in Phase 1 as the fast path; raw `gh` remains the
   fallback.

## Out of scope

- Rewriting Phase 3 validation logic (the judgment core) — stays prose.
- Changing the size heuristic, fix path, or issue path.
- A slash-command / prompt wrapper for `fix-pr` (explicitly forbidden by the
  skill's Surface section).
- Mechanical semantic dedup (NLP claim-matching) — out of reach, stays with agent.
- Touching any other skill.

## Affected files

- `skills/fix-pr/SKILL.md` (modify — 5 localized edits)
- `skills/fix-pr/scripts/fetch-feedback.sh` (new)

## Implementation steps

### A. `skills/fix-pr/SKILL.md`

1. **Inputs block (lines 77–83)** — add the dry-run line:
   ```
   fix-pr <pr> --dry-run         # validate + inventory only; never mutate repo/PR
   ```
2. **Phase 1 — universal fallback (lines 120–125)** — (a) add `files` to the
   `--json` field list; (b) add a `--repo <owner/repo>` note for out-of-tree /
   dry-run invocations; (c) add a short "Changed files & code at head" subsection
   naming `gh pr diff <N> --repo <owner/repo>` (full diff), the
   `gh api …/contents/<path>?ref=<headRefName>` single-file form, and the
   path-filtered `gh pr diff -- <path>` emptiness gotcha (use the contents API
   instead); (d) point to the new `scripts/fetch-feedback.sh` as the fast path
   that collapses these three calls into one, with raw `gh` as fallback.
3. **Phase 2 — inventory rules (lines 142–153)** — (a) add a `stale` row to the
   class table: "finding valid at an earlier review commit but superseded on
   HEAD → re-validate against HEAD; mark `already_done` with evidence, do not
   re-fix"; (b) rewrite the `duplicate` row to "across all reviews + inline +
   conversation — same claim or root cause → one work item, cite every source
   incl. earliest `submittedAt`"; (c) add a lead sentence: "When a PR has
   multiple reviews, sort by `submittedAt`; treat the latest review touching a
   file/line as authoritative. Tag each finding with its review's commit SHA so
   a fix landed in a later commit is detected as `stale`/`already_done`."
4. **Phase 4 — size gate (lines 190–195)** — add a row:
   `--dry-run (any valid count) | Stop after Phase 3; emit inventory + verdict table; no fix, issue, commit, or push`.
   Add one line under the table: "`--dry-run` short-circuits Phase 5 entirely;
   memory artifact (Phase 6) is still written because the diagnosis is worth
   keeping, but the repo and PR are not touched."
5. **Behavior rules (lines 261–273)** — add: "**`--dry-run` is no-mutate.**
   Diagnosis only; never checkout-away dirty work, commit, push, or open issues
   under `--dry-run`." (Checkout onto the PR head for *reading* code is allowed;
   mutation is not.)

### B. `skills/fix-pr/scripts/fetch-feedback.sh` (new)

6. `#!/usr/bin/env bash`, `set -euo pipefail`, usage `fetch-feedback.sh <owner/repo> <pr-number>`.
7. Fetch the three sources into one merged JSON via `gh` + `jq`:
   - `gh pr view <pr> --repo <repo> --json number,title,headRefName,baseRefName,url,files,reviews,comments`
   - `gh api repos/<repo>/pulls/<pr>/comments`
   - `gh api repos/<repo>/issues/<pr>/comments`
8. Transform with `jq`: sort `reviews` by `submittedAt`; for each review,
   capture `author`, `submittedAt`, and a best-effort commit SHA (from the
   review body's short-SHA if present, else null); flatten inline + convo
   comments into the same feed tagged by `source` + `submittedAt`; silently
   drop empty arrays.
9. Emit the Phase 2 working-table skeleton to stdout:
   `# | source | commit | path:line | claim | submittedAt | status: pending_validation`,
   one row per finding, sorted by `submittedAt` ascending.
10. Exit non-zero with a clear message if `gh` is missing/unauthenticated or the
    PR is not found (mirrors the skill's Error handling table).
11. Add a `ponytail:` comment noting the mechanical-only boundary: "does not
    dedup semantically — the agent merges duplicates; script only orders and
    sources." Keep it dependency-free: `gh` + `jq` only.

## Verification

- **Self-check the script** (ponytail one-runnable-check): run
  `bash skills/fix-pr/scripts/fetch-feedback.sh evilbuck/partypic 38` and confirm
  it emits exactly 4 findings (2 distinct claims: typo + `event_date`; the two
  `return_to` notes; deduped across the two reviews), each tagged with its
  review commit SHA, sorted by `submittedAt`. This is the same PR the dry run
  used, so the expected output is known.
- **Skill-doc sanity**: re-read the edited `SKILL.md` and confirm (a) `--dry-run`
  appears in Inputs, Phase 4, and Behavior rules consistently; (b) Phase 1 names
  `gh pr diff`, `--repo`, `files`, and the contents-at-ref command; (c) Phase 2
  has the `stale` class and the cross-review dedup rule.
- **No-mutate proof**: the dry-run invocation writes nothing to the partypic
  repo — confirm `git status` is clean and no push/issue occurred (the script is
  read-only by construction; Phase 5 is unreachable under `--dry-run`).
- `shellcheck skills/fix-pr/scripts/fetch-feedback.sh` clean (if available).

## Risks

- **`jq` availability** — not universal on minimal containers. Mitigation: the
  script is an *optional fast path*; raw `gh` fallback remains documented, so
  the skill never hard-depends on `jq`. If `jq` is absent, the agent falls back
  to the documented raw commands. Note this in the script header.
- **Commit-SHA extraction** — review bodies don't always carry a parseable SHA
  (bot reviews on partypic#38 did: `Commit: 1a7a6aa03270`). Best-effort capture
  with null fallback; the `submittedAt` ordering is the real staleness signal,
  SHA is a convenience tag.
- **`--dry-run` + dirty tree** — reading code may need a checkout onto the PR
  head. On a dirty working tree this could clobber. Mitigation: the Behavior
  rule permits checkout only for reading and inherits the existing "stop if
  unrelated dirty work blocks you" guard from Phase 1 step 4.
- **Over-codification creep** — resist turning the script into a validator/
  classifier. The `ponytail:` boundary comment is the guardrail.

## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:
1. Run `/b-build` against this plan (two files: edit `SKILL.md`, add `fetch-feedback.sh`).
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`,
   then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope
   beyond this plan), do not iterate — route them to a separate `/b-plan` →
   `/b-build` follow-up; they do not block this plan. If `/b-review` flags
   documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and review/iteration artifacts.
5. Run `/b-commit` to checkpoint durable state.
6. If interrupted before completion, leave a clear note in memory and resume from
   the active plan next turn.
