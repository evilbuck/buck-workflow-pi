# Prompt: Improve Wooderson Review Bot — Re-Review Awareness

Copy everything below the line into a new Hermes session on the wooderson host.

---

You manage the Wooderson AI Code Reviewer — a narrowly scoped GitHub PR
reviewer that runs as a Hermes agent profile (`~/.hermes/profiles/reviewer/`)
using the `github-code-review` skill (`~/.hermes/skills/github/github-code-review/`).
It reviews PRs via a GitHub App webhook trigger.

A dry-run analysis of `evilbuck/partypic#38` exposed six concrete problems.
Each is backed by evidence from that PR. Your job: fix the root causes by
editing the SOUL.md and/or the skill, then verify the fix against the same PR.

## The evidence

PR #38 received **3 reviews in 7 hours** from wooderson. The commit timeline:

| Time | Event |
|---|---|
| 02:07 | Commit `978e751` — initial PR |
| 03:40 | **Review 1** — 4 findings (typo `occassion`, `event_date` allowlist, 2 `return_to` notes) |
| 10:47 | Commit `e268458` — photo step + return_to plumbing |
| 10:48 | **Review 2** — restated findings 1+2, downgraded the typo to "confirm intentional", flip-flopped on return_to |
| 10:52 | Commit `a2812a6a` — "address PR #38 review" — **added the exact comment wooderson suggested** for the `event_date` finding |
| 10:53 | **Review 3** — **re-posted the `event_date` finding as unfixed**, one minute after the fix commit landed |

## The six problems (root-cause ranked)

### 1. Re-posts already-fixed findings (most damaging)

Review 3 (10:53) re-raised "`event_date` in `ALLOWED_FIELDS` is a virtual
attribute" — but commit `a2812a6a` (10:52, one minute earlier) had added the
exact explanatory comment wooderson itself requested:

```js
// event_date is the form field name (server converts to starts_at/ends_at).
ALLOWED_FIELDS = ["host_kind", "display_name", "tenant_name", "event_name", "event_date"]
```

The bot couldn't detect this because **it reviews every commit from scratch
with no memory of what it said before.**

### 2. Re-reviews without delta awareness

3 reviews in 7 hours, each restating the same findings. Review 2 opens with
"Non-blocking notes (same as prior review)" then re-lists them anyway. If
findings haven't changed, the review should say "No new findings since review 1"
or list only deltas.

### 3. Internal contradiction across reviews

- Review 2, finding 2: "session still holds `pending_return_to` (stale)"
- Review 3, finding 3: "`session.delete` is called, no issue here — already handled"

The bot flip-flopped on the same code between two reviews 5 minutes apart.

### 4. Downgrades real findings on re-review

- Review 1: "`occassion` → typo, fix before merge"
- Review 2: "confirm this is intentional"

If the code hasn't changed, the original verdict should carry forward, not
get re-analyzed from scratch with a softer conclusion.

### 5. Posts self-described non-defects as numbered findings

Findings explicitly labeled "Not a defect," "harmless no-op," "No issue here
— already handled." These waste the author's time and inflate the review.
SOUL.md says "Prefer a small number of high-confidence, actionable findings"
but the bot doesn't filter its own output against this rule.

### 6. Reviews before CI completes

All three reviews say "Checks: 5 in progress, none complete yet." The bot
fires before CI can reveal regressions, then may need to re-review after CI
finishes — compounding problem #2.

## What to change

The root cause is that both the SOUL.md and the skill are **stateless** —
they have no concept of "I reviewed this PR before; what changed since?"

### In SOUL.md (`~/.hermes/profiles/reviewer/SOUL.md`)

Add a **Re-review protocol** section:

1. **Check for prior reviews first.** Before analyzing, fetch existing reviews
   on this PR (`gh pr view <N> --json reviews` or the API equivalent). If you
   have reviewed before, this is a **re-review**, not a first review.
2. **Identify what changed.** Compare the current HEAD commit SHA against the
   commit you last reviewed. Only analyze the diff between those two commits,
   not the full PR diff from base.
3. **Carry forward or resolve.** For each prior finding:
   - If the code region it cited hasn't changed → carry the finding forward
     verbatim. Do **not** re-analyze or soften the verdict.
   - If the code changed in a way that addresses it → mark it **resolved**
     with evidence (cite the fix commit + the changed lines). Do **not**
     re-post it as a new finding.
4. **Post deltas only.** A re-review body should contain: (a) any **new**
   findings in the changed diff, (b) any prior findings now **resolved**, (c)
   a one-line "all other prior findings still apply" if nothing else changed.
   If nothing changed and nothing was resolved → **do not post a review at all.**
5. **No self-contradiction.** If your prior analysis was wrong, explicitly
   retract with "Correction to review 1: …" — never silently flip the verdict.
6. **Filter non-defects.** If your analysis of a potential issue concludes
   "not a defect," "harmless," or "already handled" → **omit it.** Post only
   actionable findings. Non-defects go in a "Positive observations" section
   at most, never as numbered findings.
7. **Wait for CI (or mark preliminary).** If CI checks are still running,
   either wait for them to complete before reviewing, or prefix the review
   with "**Preliminary review — CI still running.**" and suppress the
   re-review trigger until CI completes.

### In the skill (`~/.hermes/skills/github/github-code-review/SKILL.md`)

Add a **Step 0: Re-review check** before the existing Step 1 in the
"PR Review Workflow" section:

```bash
# Check if we (wooderson-ai-code-reviewer) have reviewed this PR before
PRIOR_REVIEWS=$(gh pr view $PR_NUMBER --json reviews --jq '
  [.reviews[] | select(.author.login == "wooderson-ai-code-reviewer")]
  | sort_by(.submittedAt) | .[-1]
')
LAST_REVIEWED_SHA=$(echo "$PRIOR_REVIEWS" | jq -r '
  .body | capture("Commit:\\s*(?<sha>[0-9a-f]{7,40})")?.sha // empty
')
CURRENT_SHA=$(gh pr view $PR_NUMBER --json headRefOid --jq '.headRefOid')

if [ "$LAST_REVIEWED_SHA" = "${CURRENT_SHA:0:${#LAST_REVIEWED_SHA}}" ]; then
  echo "No new commits since last review — skipping."
  exit 0
fi
```

If there are prior reviews, diff from the last-reviewed commit to HEAD instead
of from the base branch. And add the prior-review body to the context so the
LLM can carry forward / resolve findings.

## Verification

After making changes, verify against the same PR:

1. **Simulate a re-review of `evilbuck/partypic#38`.** Since the `event_date`
   finding was already addressed in commit `a2812a6a`, a re-review should
   either: (a) mark it resolved with evidence, or (b) omit it entirely. It
   must **not** re-post it as a new finding.
2. **Confirm the re-review body contains deltas only** — new findings or
   resolved findings, not a full restatement.
3. **Confirm no self-described non-defects** appear as numbered findings.
4. **Confirm the bot does not fire while CI is "in progress"** without a
   "Preliminary" prefix.

## Constraints

- Edit only `~/.hermes/profiles/reviewer/SOUL.md` and
  `~/.hermes/skills/github/github-code-review/SKILL.md`.
- Do not change the webhook trigger config, the GitHub App permissions, or
  any Python in the hermes-agent runtime.
- Do not change the review output template
  (`references/review-output-template.md`) — the severity taxonomy is fine;
- Preserve the existing boundaries (review-only, no mutation, untrusted
  input, credential safety).

## Codification — what can be made deterministic

Six of the improvements above are mechanical, not judgment. Codify them into
a pre-review script so the LLM receives a prepared context package instead of
reconstructing it from raw API calls every time. This mirrors the pattern
sibling tools use (e.g. `fix-pr`'s `fetch-feedback.sh`, `b-pr`'s
`pr-preflight.ts`).

Create `~/.hermes/skills/github/github-code-review/scripts/prereview-check.sh`:

```bash
#!/usr/bin/env bash
# prereview-check.sh — deterministic re-review gate + context assembler.
#
# Usage: prereview-check.sh <owner/repo> <pr-number>
#
# Outputs JSON to stdout with:
#   - is_rereview: bool (have we reviewed before?)
#   - last_reviewed_sha: the commit SHA of our most recent review
#   - current_sha: PR HEAD
#   - delta_files: files changed since last review (empty if first review)
#   - prior_findings: [{path, line, claim, region_changed: bool}]
#   - ci_status: "in_progress" | "complete" | "none"
#
# Exit codes:
#   0 — proceed with review (context printed to stdout)
#   10 — skip: no commits since last review (don't invoke the LLM at all)
set -euo pipefail
REPO="$1"; PR="$2"
BOT="wooderson-ai-code-reviewer"

PR_JSON=$(gh pr view "$PR" --repo "$REPO" \
  --json headRefOid,reviews,commits,statusCheckRollup)

# 1. Find our most recent review
LAST_REVIEW=$(echo "$PR_JSON" | jq -r --arg bot "$BOT" '
  [.reviews[] | select(.author.login == $bot)]
  | sort_by(.submittedAt)
  | if length > 0 then .[-1] else null end
')

CURRENT_SHA=$(echo "$PR_JSON" | jq -r '.headRefOid')

if [ "$LAST_REVIEW" = "null" ] || [ -z "$LAST_REVIEW" ]; then
  # First review — full context, no delta
  echo "$PR_JSON" | jq --arg sha "$CURRENT_SHA" '{
    is_rereview: false,
    last_reviewed_sha: null,
    current_sha: $sha,
    delta_files: [.commits[].oid],
    prior_findings: [],
    ci_status: (if (.statusCheckRollup | length) == 0 then "none"
      elif any(.statusCheckRollup[]; .status == "IN_PROGRESS") then "in_progress"
      else "complete" end)
  }'
  exit 0
fi

# 2. Extract last-reviewed commit SHA from review body (best-effort)
LAST_SHA=$(echo "$LAST_REVIEW" | jq -r '
  .body | capture("Commit:\\s*(?<sha>[0-9a-f]{7,40})"; "i")?.sha // empty
')
# Fallback: use the commit closest to the review's submittedAt
if [ -z "$LAST_SHA" ]; then
  REVIEW_TIME=$(echo "$LAST_REVIEW" | jq -r '.submittedAt')
  LAST_SHA=$(echo "$PR_JSON" | jq -r --arg t "$REVIEW_TIME" '
    [.commits[] | select(.committedDate <= $t)] | last | .oid
  ')
fi

# 3. Delta: what changed since last review?
DELTA_FILES=$(gh api "repos/$REPO/compare/$LAST_SHA...$CURRENT_SHA" \
  --jq '[.files[].filename]')

# 4. Gate: if nothing changed, skip entirely
DELTA_COUNT=$(echo "$DELTA_FILES" | jq 'length')
if [ "$DELTA_COUNT" -eq 0 ]; then
  echo '{"skip": true, "reason": "no commits since last review"}' >&2
  exit 10
fi

# 5. Prior findings: extract file:line from ALL prior review bodies.
# Uses grep for portability (jaq/jq regex escaping varies across versions).
# Extracts from every prior review, not just the last — later reviews may
# have dropped line numbers that earlier ones included.
ALL_PRIOR_BODIES=$(echo "$PR_JSON" | jq -r --arg bot "$BOT" '
  [.reviews[] | select(.author.login == $bot)] | sort_by(.submittedAt) | .[].body
')
PRIOR_PATHS=$(echo "$ALL_PRIOR_BODIES" \
  | grep -oP '`[a-zA-Z0-9_./-]+\.[a-z]+(:\d+)?`' \
  | tr -d '`' | sort -u)
PRIOR_FINDINGS=$(echo "$PRIOR_PATHS" | while IFS= read -r ref; do
  path="${ref%%:*}"
  line="${ref##*:}"
  [ "$line" = "$path" ] && line="null"
  changed="false"
  echo "$DELTA_FILES" | jq -e --arg p "$path" 'index($p) != null' >/dev/null 2>&1 && changed="true"
  jq -n --arg p "$path" --argjson l "$line" --argjson c "$changed" \
    '{path: $p, line: $l, region_changed: $c}'
done | jq -s '.')

# 6. CI status
CI_STATUS=$(echo "$PR_JSON" | jq -r '
  if (.statusCheckRollup | length) == 0 then "none"
  elif any(.statusCheckRollup[]; .status == "IN_PROGRESS") then "in_progress"
  else "complete" end
')

# 7. Assemble context package
jq -n \
  --arg sha "$CURRENT_SHA" \
  --arg last "$LAST_SHA" \
  --argjson delta "$DELTA_FILES" \
  --argjson findings "$PRIOR_FINDINGS" \
  --arg ci "$CI_STATUS" \
  '{
    is_rereview: true,
    last_reviewed_sha: $last,
    current_sha: $sha,
    delta_files: $delta,
    prior_findings: $findings,
    ci_status: $ci
  }'
```

### What the script eliminates (deterministic, no LLM needed)

| Problem | Codified how |
|---|---|
| Re-posts fixed findings | `region_changed` flag: if prior finding's file isn't in the delta, the LLM carries it forward without re-analysis |
| Re-reviews without delta | `delta_files` limits LLM to changed regions only |
| Re-reviews unchanged PRs | Exit 10 skips the LLM entirely — no token spend, no noise |
| Reviews before CI | `ci_status` field lets SOUL.md gate on "in_progress" |

### What stays with the LLM (judgment, not scriptable)

- Whether a changed region actually resolves a prior finding (intent matters)
- Whether a new diff hunk contains a real defect
- Non-defect filtering (soft — the script can't know "this is harmless"; but a
  post-generation regex strip of self-described non-defects is a deterministic
  add-on)
- Citation format consistency (7th problem — see below)

### Non-defect post-filter (deterministic add-on)

Add this as a final gate before posting, either in the script or as a
SOUL.md instruction the LLM self-enforces:

``+# If any finding's text matches these patterns, strip it before posting:``+
Strip patterns: "not a defect", "harmless", "already handled",
"no issue here", "this is intentional", "not a bug"

These are signals the analysis concluded non-defect — the finding should
never have been posted as actionable.

### Problem 7: Inconsistent citation format across reviews (discovered during codification)

Review 1 cited findings as `` `file/path.ext:line` `` (e.g.
`` `app/views/pages/home.html.erb:2265` ``). Review 3 cited the same files
without line numbers (`` `app/javascript/controllers/host_onboarding_wizard_controller.js` ``).
This breaks the deterministic prior-finding extraction — without a line number,
the script can't track whether a specific finding's code region changed.

Fix: SOUL.md should mandate `` `file/path.ext:line` `` citation format in
every finding, every review. The script's `region_changed` flag depends on it.
