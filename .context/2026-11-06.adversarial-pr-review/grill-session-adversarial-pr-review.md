---
type: grill-session
date: 2026-11-06
subject: 2026-11-06.adversarial-pr-review
total_questions: 9
assessment_threshold: 20
boundary_assessment: cohesive
break_points: []
decision_domains:
  - name: Identity
    questions: [1]
    resolved: 1
    deferred: 0
  - name: Output
    questions: [2-7]
    resolved: 6
    deferred: 0
  - name: Invocation
    questions: [8]
    resolved: 1
    deferred: 0
status: completed
---

# Grill Session: Adversarial PR Review

## Decision Domains

### Domain: Identity
- Q1: New skill, or change an existing review skill? → resolved: new skill `adversarial-review`; reuse `pr-context.ts` / `submit-review.ts`; only a routing exclusion on `code-review-universal` and its Codex copy. No behavior change to existing reviewers.

### Domain: Output
- Q2: How is local-only selected versus posting comments? → resolved: ask every run. Post calls `submit-review` once. Local never calls it.
- Q3: Where does the local review file go? → resolved: `.context/YYYY-MM-DD.pr-<N>-adversarial-review/review-pr-<N>.md` via workflow_state. Both modes write it. Local stops there. Post also publishes. Not `CODE-REVIEW.md`.
- Q4: Which findings become inline comments? → resolved: only findings with an exact diff line. Unanchored items stay in the review body. Do not re-anchor.
- Q5: What is the published failing signal? → resolved: one atomic `REQUEST_CHANGES` review. Not a commit status or Check Run. Own PR falls back to `COMMENT`.
- Q6: When is the event `REQUEST_CHANGES` instead of `COMMENT`? → resolved: only when a Critical Failure is proven on a diff line. Edge cases, false claims, or could-not-verify alone use `COMMENT`. Zero findings use `COMMENT` and say no failure was proven. Own PR stays `COMMENT`.
- Q7: Must section 2 always list exactly 10 edge cases? → resolved: up to 10 real cases, never pad. Zero is valid.
- Q8: How does the post-vs-local question work outside OMP? → resolved: skill asks in chat and waits. OMP wrapper may use the selector. Do not post until the user answers.
- Q9: What tone is allowed on the published review? → resolved: blunt and specific. No praise, no insults, no sarcasm. Hostile means assume it is broken, not insult the author.
## Addenda
- Local-only mode: review a PR without posting GitHub comments, and save the review to a local file.
- Runtime should present a question and let the user select.
- Published mode: inline comments must sit on the correct PR diff line. The complete review — summation plus anything not inlined — is posted as a comment that is a failing check on the pull request.

## Decision Closure

**Selected course:** New skill `adversarial-review`. Reuse `pr-context.ts` and `submit-review.ts`. Do not change existing review behavior except a routing exclusion on `code-review-universal`.

**Evidence:** Q1–Q9 in this file. `code-review-universal` already posts one atomic inline review and its stance is constructive. GitHub inline comments must be on diff lines. `submit-review.ts` supports `REQUEST_CHANGES` and `COMMENT`, not Check Runs.

**Assumptions:**

| id | statement | status | blocking | evidence |
|---|---|---|---|---|
| A-1 | Authenticated `gh` is already available when the skill runs. | validated | false | User requirement. Skill fails closed if `gh auth status` fails. It does not run `gh auth login`. |
| A-2 | A Critical Failure that cannot be anchored to a diff line stays in the body and does not by itself select `REQUEST_CHANGES`. | validated | false | Q4 and Q6. |

**Material risks:**

- `failure_mode`: The skill posts a `REQUEST_CHANGES` review as the authenticated GitHub user.
- `impact`: The PR author sees inline comments and a changes-requested review. Hard to unsend.
- `mitigation`: Ask Post vs Local and wait. Post only after an answer. `REQUEST_CHANGES` only for a critical failure on a diff line. Dry-run `submit-review` first. Own-PR falls back to `COMMENT`.
- `rollback_or_fallback`: Local mode never calls `submit-review`. A mistaken post is dismissed by the user in GitHub; the skill does not delete reviews.
- `validation_path`: Dry-run must succeed before the live POST. The skill records the review URL only from the script's JSON.

**Excluded scope:** No Check Run. No commit status. No second poster. No change to `b-review`, `code-review`, or `code-review-universal` review behavior. No `APPROVE`. No padded edge cases. No insults.

**Next action:** Add the skill, thin prompt, command symlink, catalog rows, and the routing exclusion.
## Parked

## Settled from the repo (not questions)

- Portable body is a skill. Pi/OMP get a thin `prompts/` wrapper plus a `commands/` symlink. Claude and Codex load the skill, not a second prompt dialect.
- `code-review-universal` already accepts a PR URL, `owner/repo#N`, `#N`, or a number, and posts one atomic GitHub review with inline comments through `skills/code-review/scripts/pr-context.ts` and `submit-review.ts`. Authenticated `gh` is a prerequisite. Do not hand-roll a second poster.
- Inline comments can only anchor to diff lines. `submit-review.ts` findings are `{path, line, side?, severity: critical|warning, body}`. Off-diff points go in the review body.
- Own-PR `APPROVE` / `REQUEST_CHANGES` is rejected by GitHub (422).
- `code-review-universal` is a physical copy in the Codex plugin bundle (`plugins/buck-workflow/skills/`). A description edit must be copied there. A new skill is invisible to Codex until added to `scripts/codex-plugin.test.ts` `canonicalCopies` and copied into the bundle.
