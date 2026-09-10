---
status: complete
date: 2026-09-10
subject: 2026-09-10.mattpocock-adoption
topics: [review, phase-4, re-review]
addresses: phase-4-independent-new-members.md
from_review: b-review
supersedes: first-pass review-phase-4.md (verdict "Needs work", 3 in-plan issues)
---

# Plan Path Review: Phase 4 — Independent New Members (RE-REVIEW after fixes)

## Verdict
**Pass** — all three in-plan issues from the first-pass review are resolved, plus both
standards-axis P3 nits (set_var stdin, key escaping). One residual P3 informational note
below; it does not block.

## Scope of this re-review
Baseline unchanged: commit `e33b0a8` + uncommitted working tree on `feat/matt-pocock-adapt`.
Re-verified only the 3 in-plan defects plus regression guards (`bash -n`, `shellcheck`,
notices scope). The first-pass acceptance-criteria matrix (13/13 ✅) is not re-litigated —
the fixes touch prose, notices, and library internals only, none of which alter any
verified criterion.

## Fix verification

### Issue 1 — THIRD-PARTY-NOTICES.md enumeration ✅ RESOLVED
- `grep -c 'b-handoff\|writing-for-agents\|b-wizard' THIRD-PARTY-NOTICES.md` → **4** (non-zero).
- Entries and upstream paths are accurate and match the shipped origin notes:
  - `skills/b-handoff/SKILL.md` ← upstream `skills/productivity/handoff/SKILL.md`
  - `skills/writing-for-agents/SKILL.md`, `SKILL-MECHANICS.md` ← upstream `skills/productivity/writing-for-agents/`
  - `skills/b-wizard/SKILL.md`, `template.sh` ← upstream `skills/engineering/wizard/`
- Negative scope check: `grep -c 'b-init-tracker\|b-triage'` → **0**. The notices do NOT
  pre-list the sibling workstream's not-yet-committed skills — no dangling-reference
  regression introduced by the fix.

### Issue 2 — SKILL.md "confirms at every stage" overclaim ✅ RESOLVED
- Current prose (skills/b-wizard/SKILL.md): intro now says the wizard "offers confirmation
  gates before irreversible actions"; the template list describes "a `confirm` helper for
  gating irreversible actions (yours to call in each stage you author)"; Process step 3
  instructs: "call `confirm` yourself before any irreversible action in the stage you
  author — the library provides the helper, it does not gate for you."
- `template.sh` `stage()` (L56-62) still only clears the screen and prints a progress
  header — and the prose no longer claims otherwise. The chosen remedy was prose-softening
  (option A of the two offered in the first pass); the example stage remains confirm-free,
  which is consistent with the softened prose (its `write_env`/`set_secret` writes are
  idempotent upserts, not irreversible actions).

### Issue 3 — template.sh write_env hardening ✅ RESOLVED (one residual P3 note below)
- **Same-directory mktemp**: `tmp=$(mktemp "${ENV_FILE}.XXXXXX")` (L135). `mv` is now an
  atomic same-filesystem rename — no cross-FS copy+unlink truncation window on a
  credentials-bearing `.env`.
- **Literal key matching in BOTH grep sites**: `_existing` (L95-96) and `write_env`
  (L136-137) both escape the key first: `esc_key=$(printf '%s' "$key" | sed 's/[.[\*^$]/\\&/g')`,
  then match `^${esc_key}=`. No raw regex interpolation remains.
- **Escaped-key idempotency smoke test** (scratch dir, library sourced up to the STAGES
  marker, `ENV_FILE` pre-seeded with `FOOXBAR=survivor` and `OTHER=untouched`):

```
=== seed ===
FOOXBAR=survivor
OTHER=untouched
  ✓ wrote FOO.BAR → $TMPDIR/tmp.VnyQPJyIED/.env
=== after write 1 (FOO.BAR=first) ===
FOOXBAR=survivor
OTHER=untouched
FOO.BAR=first
  ✓ wrote FOO.BAR → $TMPDIR/tmp.VnyQPJyIED/.env
=== after write 2 (FOO.BAR=second) ===
FOOXBAR=survivor
OTHER=untouched
FOO.BAR=second
FOO.BAR= line count: 1
FOOXBAR survivor count: 1
OTHER survivor count: 1
_existing FOO.BAR -> second
leftover same-dir tmp files: 0
```

  - (a) **No cross-contamination**: `FOOXBAR=survivor` and `OTHER=untouched` survive both
    writes of key `FOO.BAR`. (Pre-fix, the unescaped pattern `^FOO.BAR=` matched and
    deleted `FOOXBAR=…`.)
  - (b) **Replace-in-place on second write**: exactly 1 `FOO.BAR=` line remains, holding
    the new value; `_existing FOO.BAR` returns `second`; zero leftover `.env.XXXXXX` temp
    files in the target directory.

### Standards-axis P3 nits from first pass — both also fixed
- **set_var stdin**: `set_var` now pipes the value via stdin
  (`printf '%s' "$value" | gh variable set "$name"`), matching `set_secret` — the value no
  longer appears in argv/ps.
- **Key escaping**: covered under Issue 3 above.

## Residual note (P3, informational, non-blocking)
The escape class `[.[\*^$]` covers the BRE metacharacters, but both greps run with `-E`
(ERE), where `+ ? ( ) { } |` are also special. Probed behavior:
- key `FOO+BAR`: `^FOO+BAR=` never matches the literal line → duplicates accumulate
  (2 lines after 2 writes) — idempotency loss.
- key `FOO(BAR`: invalid ERE → grep exits 2; with `|| true` the empty tmp file replaces
  `.env`, wiping unrelated keys (demonstrated: pre-seeded `KEEP=1` destroyed).

Both failure modes pre-existed the fix (raw interpolation behaved identically) and require
pathological key names — POSIX env names are `[A-Za-z_][A-Za-z0-9_]*`, so even `.` was an
edge case. Flagged as info only. One-line hardening if desired:
`sed 's/[][\.|$(){}?+*^]/\\&/g'` in both sites.

## Regression checks
- `bash -n skills/b-wizard/template.sh` → exit 0.
- `shellcheck -S warning skills/b-wizard/template.sh` → exactly the one pre-existing
  SC2034 warning (`RED` unused, L19); **no new findings** from the edits.

## First-pass matrix status
All 13 acceptance criteria remain ✅ complete (unchanged since the first pass). The
guardrails verdict recorded there stands: `fail` (complexity_gate) attributed 100% to
pre-existing code at `e33b0a8` — out-of-plan; route via `/b-init-guardrails` refresh.

## Recommended next step
Phase 4 is clear to commit. Out-of-plan follow-ups unchanged from first pass: guardrails
baseline refresh (`/b-init-guardrails`) and installing `diff-cover` for the patch gate.

