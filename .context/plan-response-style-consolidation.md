---
date: 2026-09-09
status: completed
domains: [agent-instructions, bootstrap, docs]
topics: [response-style, global-agents-bootstrap, consolidation, bootstrap-drift]
related: ["GLOBAL_OR_PROJECT-AGENTS.md", "review-response-style-2026-09-09.md"]
research: []
memory: [../memory/response-style-consolidation-2026-09-09.md]
priority: medium
---

# Plan: consolidate response-style policy in `GLOBAL_OR_PROJECT-AGENTS.md`

## User Goal

Validate the 2026-09-09 review (and its inline second-opinion comments) against the actual file, then land one canonical response-style policy instead of three competing ones.

## Validation summary

All four findings and every inline comment hold up against the file. Evidence:

| Claim | Verdict | Evidence |
|---|---|---|
| Diff is `+228 / −0`, append-only, `GLOBAL_OR_PROJECT-AGENTS.md` only | confirmed | `git diff --stat`: 1 file, 228 insertions; HEAD 308 lines → working 536 |
| Three overlapping policies at lines 7, 278, 310 | confirmed | headings: `Communication Style (Default — Always On)` 7, `Default Response Style` 278, `Response Style: Concise, Contextual, Low-Noise` 310 |
| [important] template vs heading rule conflict (`:370` vs `:16`) | confirmed, understated | see "Missed finding A" below |
| [important] padding risk from four-item goal + "2–5 short paragraphs" | confirmed | `:314-319` reads as a required set; `:338` reads as a floor; both contradict `:15` "if in doubt, leave it out" |
| [nit] blacklist + three example pairs over-specified | confirmed | `:17` `No filler` already covers the blacklist categorically; examples at 362-368, 404-410, 423-425, 440-452, 491-525 restate prose rules |
| Unique load-bearing content is "do not sacrifice necessary context" (`:469-489`) | confirmed | no equivalent rule exists in the sections at 7 or 278 — this is the only idea that would be lost by a plain revert |
| Inline: "put the survivor at the line-7 slot, not after Specialized Roles" | agreed | the new section is appended after `Specialized Roles` with no `---` separator, breaking the file's own section convention |
| Inline: "reverting the add is not enough — merge the two pre-existing sections" | agreed | 7-27 and 278-296 are near-verbatim duplicates of each other |

Quantified: response-style policy is **267 of 536 lines (~50%)** of the global bootstrap. The new section alone is 6.7 KB (~1.7k tokens) loaded on every session, on every harness.

### Missed finding A — four competing response templates, not just a heading conflict

The review frames `:370` as headings-vs-no-headings. The sharper defect: the file now prescribes four different response shapes.

1. `:20-23` Overview / Why / Only-then-detail
2. `:289-292` Overview / Why / Only-then-detail (restated)
3. `:325-330` Answer / minimum context / caveats / stop
4. `:374-384` **What changed** / **Why** / **Important**

Technically #4 is bold labels rather than markdown headings, so the literal contradiction with `:16` is weaker than the review says — but the structural problem is worse: an agent must pick one of four shapes with no precedence rule, and recency favors #4 on exactly the routine coding answers that should be one sentence.

### Missed finding B — the change is already live, and two install targets are stale

`GLOBAL_OR_PROJECT-AGENTS.md` is not a passive source file; it is symlinked into harness bootstraps.

| Target | Kind | State |
|---|---|---|
| `~/.omp/agent/AGENTS.md` | symlink → this repo | **live now** — the uncommitted +228 is already in effect for OMP sessions |
| `~/.claude/CLAUDE.md` | symlink → `~/.local/share/buck-workflow-pi/` (separate clone at `c6859ec`) | stale, 15,371 B vs 22,460 B |
| `~/.pi/agent/AGENTS.md` | plain copy | stale, 318 diff lines |

Consequence: the review's "before committing" framing understates urgency (OMP already reads it), and consolidation is not complete until the two copies are refreshed. `~/.pi/agent/AGENTS.md` being a copy rather than a symlink is a standing drift bug — the installer's stated contract is symlinks.

### Note — harness overlap

OMP already injects its own `§ Role / § Tone / § Delivery` style contract at the system-prompt level. For OMP this bootstrap section is a fourth layer. Its real value is for harnesses with no built-in style contract (Claude Code, Codex, Pi), which is an argument for keeping it short and non-conflicting, not for deleting it.

### Disagreement

Minor: the review's 9-point "Recommended Core" overlaps internally (items 1-2-3 and 5-6). The section below folds it to 10 bullets covering the same ground including item 4, which the inline comment correctly says must not be cut.

## Decision

One canonical section, in the line-7 slot, replacing all three. Not a revert — a merge. Target ~20 lines.

## Replacement text (verbatim)

```markdown
## Response Style (Default — Always On)

The default personality, not a mode the user has to invoke. Applies to every response unless the user asks for more.

- **Answer first.** Open with the outcome, decision, or direct answer.
- **Only applicable context.** Add the reason when it is not obvious; add risks, uncertainty, breaking changes, or a required next action when they are material. Nothing else.
- **Concise is not cryptic.** Never drop assumptions that affect correctness, security concerns, dependencies, or anything needed to act safely. The target is concise + sufficient, not shortest.
- **Report outcomes, not process.** No chronology of tool calls, files opened, or reasoning steps. Mention an intermediate step only when it changed the result, blocks completion, or needs a decision.
- **No filler.** No hedging, throat-clearing, apologies, restating the question, or marketing language.
- **Surface uncertainty at the claim**, not buried at the end.
- **Length follows content.** Most routine answers are 1–5 sentences or a compact list. There is no minimum — never pad to fill a structure.
- **No fixed template.** Headings, tables, and labelled fields (`What changed` / `Why` / `Important`) are optional tools for a genuinely longer answer, never a required shape.
- **Expand when the work warrants it** — architecture, subtle bugs, consequential trade-offs, or an explicit request for depth ("walk me through it", "what changed?"). Conclusion still first; return to concise on the next turn.
- **Stop when the answer is complete.** Delete any sentence that repeats a point, explains something obvious from the answer, or narrates process.

Instead of "The reason this happens is that JavaScript's event loop adds promises to the microtask queue, which means…", write: "`Promise.then()` runs as a microtask, so it executes after the current synchronous code but before `setTimeout()`."
```

Coverage check against the review's Recommended Core: 1→bullet 1, 2→bullet 2, 3→bullet 2, 4→bullets 2-3, 5→bullet 7, 6→bullet 4, 7→bullet 8, 8→bullet 9, 9→bullet 10. Nothing dropped.

## Steps

1. Replace `GLOBAL_OR_PROJECT-AGENTS.md:7-26` (`## Communication Style (Default — Always On)` through `**On explicit user request** …`) with the replacement text above. Keep the `---` at line 27.
2. Delete `:278-296` (`## Default Response Style` through its trailing `---`), leaving exactly one blank line between the `---` at 276 and `## Specialized Roles`.
3. Delete `:309-536` (blank line + `## Response Style: Concise, Contextual, Low-Noise` through EOF), restoring the file's tail to the HEAD state.
4. Re-read the file tail after step 3 to confirm nothing beyond the intended range was removed (README-truncation rule from 2026-09-04).
5. Refresh stale bootstraps: `git -C ~/.local/share/buck-workflow-pi pull` (Claude Code path), and replace `~/.pi/agent/AGENTS.md` with a symlink to this repo's file to stop the copy from drifting again.
6. `/b-save` then `/b-commit`.

## Verification

- `grep -c '^## .*Response Style\|^## Communication Style' GLOBAL_OR_PROJECT-AGENTS.md` → `1`.
- `wc -l GLOBAL_OR_PROJECT-AGENTS.md` → ~290 (308 at HEAD, minus ~19 for the deleted section 2, plus/minus the section-1 swap).
- Absent strings: `2–5 short paragraphs`, `Let me walk you through this`, `What changed` as a default template, first-person `I ask` / `give me` / `my input`.
- Present strings: `Concise is not cryptic`, `security concerns`, `never pad`.
- `readlink ~/.omp/agent/AGENTS.md` still resolves to this repo (no install action needed); `diff ~/.pi/agent/AGENTS.md GLOBAL_OR_PROJECT-AGENTS.md` → empty after step 5.
- Guardrails: docs-only session (single `.md` at repo root plus `.context/`) → deterministic check gate is skipped per the Deterministic Check Contract; state that in the save.

## Non-goals

- Changing OMP's harness-level `§ Tone` contract — not owned by this repo.
- Touching the repo-root `AGENTS.md` (project doc; carries no response-style section).
- Rewriting per-skill response guidance in `skills/**`.
- Reworking the installer beyond fixing the one `~/.pi` copy-vs-symlink drift.

## Risks

- Deleting `:278-296` goes beyond "revert the new add". Intentional: that duplicate is what made a third section look necessary. If the user wants a minimal change, step 3 alone restores HEAD but leaves the two-policy duplication and loses the `do not sacrifice necessary context` rule.
- The bootstrap is live for OMP through a symlink; every edit takes effect immediately in new sessions on this machine. There is no staging step.
