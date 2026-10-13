---
status: completed
date: 2026-09-10
updated: 2026-09-10
subject: 2026-09-10.mattpocock-adoption
topics: [review, phase-2, mattpocock-remediation]
addresses: phase-2-design-vocabulary-and-diagnose.md
from_review: b-review
verdict: pass-with-warnings
---

# Plan Path Review: Phase 2 — Design Vocabulary & b-diagnose (mattpocock remediation)

## Plan Source
- File: `.context/2026-09-10.mattpocock-adoption/phase-2-design-vocabulary-and-diagnose.md` (parent: `plan-mattpocock-findings-remediation.md`)
- Goal: Close the biggest capability hole — a design-vocabulary reference (`codebase-design`) and `/b-diagnose`, the debugging on-ramp the bootstrap's task-routing table points at with nothing behind it.
- Baseline: working tree vs HEAD `9f82a3d` (all Phase 2 work uncommitted). Upstream fidelity compared against `/tmp/mattpocock-ref/engineering/{codebase-design,diagnosing-bugs}/`.

## Evidence Sources
- Git status: 4 modified (README.md, docs/buck-workflow.md, THIRD-PARTY-NOTICES.md, phase file status flip), 4 untracked (skills/codebase-design/ ×3 files, skills/b-diagnose/SKILL.md, prompts/b-diagnose.md, commands/b-diagnose.md symlink).
- `git diff --numstat`: README +3/−0, THIRD-PARTY-NOTICES +8/−0, docs/buck-workflow.md +34/−0 — **insertions only, zero deletions**.
- Commands re-run independently by this review: `readlink commands/b-diagnose.md`; `diff` of both fan-out files and the Phase-1-gate sentence against the upstream reference copies; tail-5 byte-compare of README + docs vs `git show HEAD:`; grep hit counts; `node scripts/install.mjs --dry-run`; fixture-test transcript re-read (`agent://DiagnoseFixtureTest`).

## Completion Matrix

| Criterion | Status | Evidence |
|------|--------|----------|
| A1: seven terms + depth-as-leverage + deletion test + one-adapter rule | ✅ complete | `skills/codebase-design/SKILL.md` glossary: module :27, interface :31, depth :42 ("leverage at the interface"), seam :47, adapter :52, leverage :55, locality :59. Depth-as-leverage reinforced at :151-153 (Rejected framings explicitly rejects Ousterhout's line-ratio). Deletion test :100-102. "One adapter means a hypothetical seam. Two adapters means a real one." :106-107. |
| A1: DESIGN-IT-TWICE.md fan-out exists + referenced | ✅ complete | File exists (2808 B); referenced from SKILL.md :164-167 ("Going deeper"). Companion `DEEPENING.md` also ported and referenced :161-163; both are faithful to upstream (diff vs `/tmp/mattpocock-ref` shows only re-wrapping plus one intentional harness-portability rewrite of the sub-agent dispatch note). |
| A1: no prompts/ or commands/ wrapper | ✅ complete | `grep codebase-design prompts/ commands/` → zero hits. README mentions codebase-design exactly once (Skills table L269, tagged "skill-only, no slash wrapper"). docs primitives row L33 says the same; fix-pr precedent followed. |
| A2: 6 phases, Phase 1 blocking gate | ✅ complete | `skills/b-diagnose/SKILL.md` phase headings :38, :124, :154, :172, :192, :218. Gate: completion criterion checklist :103-116; "No red-capable command, no Phase 2." :122. |
| A2: refusal rule survives verbatim in intent | ✅ complete | Governing sentence :120-122 is byte-identical to upstream `diagnosing-bugs/SKILL.md` ("If you catch yourself reading code to build a theory before this command exists, stop… No red-capable command, no Phase 2."). "Do not proceed to hypothesise without a loop" (:99-101) also preserved. Behavioral proof: fixture test below. |
| A2: 10 ranked loops, 3–5 falsifiable hypotheses, instrument, regression test, tagged-log cleanup | ✅ complete | Ranked constructions 1–10 :48-72 (cheapest-first order preserved from upstream). "Generate **3–5 ranked hypotheses**" :156; falsifiability format :159-166. Phase 4 instrument :172-190 with `[DEBUG-a4f2]`-style tagging :184. Phase 5 regression test :192-216. Phase 6 cleanup checklist :218-228 incl. "All `[DEBUG-...]` instrumentation removed (grep the prefix)" :224. |
| A2: exits wired (b-iterate / b-plan / code-smells) | ✅ complete | `## Exits` :230-241: b-iterate (fix in place), b-plan (architectural), code-smells ("Phase 5's 'no correct seam exists' *is itself the finding*"). Phase 5 body :205-209 names the code-smells handoff trigger inline (upstream said only "Flag this for the next phase" — the port wires it as planned). |
| A2: seam language links to codebase-design, never restates | ✅ complete | Relative links at :24 and :196 (`../codebase-design/SKILL.md`); :22-25 states "use it, link to it, never restate it here". No glossary term is re-defined in b-diagnose (Phase 5's "correct seam" :198-203 is upstream's own test-placement criterion, not a seam definition). |
| Wiring: prompt + command symlink | ✅ complete | `readlink commands/b-diagnose.md` → `../prompts/b-diagnose.md` (matches b-build/b-iterate pattern). `prompts/b-diagnose.md` (397 B) matches the prompt convention exactly: description-only frontmatter, `$ARGUMENTS`, load-skill block (byte-shape of `prompts/b-iterate.md`). |
| Catalog: README rows | ✅ complete | `/b-diagnose` in `### Prompt Templates` L233; `b-diagnose` L268 + `codebase-design` L269 in `### Skills`. Hit counts: b-diagnose ×2, codebase-design ×1 — exactly per the phase's surface table. No row added to the `### OMP Command Mirror` prose (plan correction respected). |
| Catalog: docs/buck-workflow.md (primitives, quick-ref, section body) | ✅ complete | Primitives table rows L32-33; quick-reference rows L396-397; full section bodies `#### /b-diagnose — Diagnosing Hard Bugs` L1045-1060 (Build phase, before `### 4. Review Phase`) and `#### /skill:codebase-design — Deep-Module Vocabulary` L1156-1167 (after fix-pr, mirroring its skill-only framing). 5 hit-lines each across the file. |
| Both skills resolve BY NAME in a reloaded session | ⚠️ not-verifiable | Cannot reload the host session from this review, and running the installer mutates global state (out of read-only mandate). Structural evidence: frontmatter `name:` matches dir for both; `node scripts/install.mjs --dry-run` proves the registration path picks up all three new surfaces (`+ [claude:skills] b-diagnose`, `+ [claude:skills] codebase-design`, `+ [claude:commands] b-diagnose.md`). **Caveat that corrects the phase's recipe**: skills install as per-skill symlinks created at install time; `~/.claude/skills` currently lacks both, so *reload alone will not register them* — run `node scripts/install.mjs` first, then reload and probe by exact name. |
| Fixture blocks at Phase 1 with no red command | ✅ complete | Behavioral test (`/Users/buckleyrobinson/.omp/agent/sessions/-projects-development_tools-buck-workflow-pi/2026-09-10T21-35-29-444Z_01a08d3f-46a4-7654-9a03-aee8ed22914f/DiagnoseFixtureTest.md`, `/tmp/b-diagnose-fixture`, `average()` ZeroDivisionError): agent built `repro_red.py` FIRST, ran it red (`ZeroDivisionError: division by zero`, exit 1), stated **zero** hypotheses before red, stopped at the Phase-1 completion criterion, and quoted the governing line (SKILL.md:120-122). It even corrected its first loop when it hit the wrong symptom — exercising Phase 2's "user's failure mode, not a nearby one" check. Scope note: the test followed `skills/b-diagnose/SKILL.md` directly; the slash command is a thin loader wrapper for that same body, but loader-invoked behavior shares criterion 12's ⚠️. |
| README + docs tails intact (byte-compare vs HEAD) | ✅ complete | `git diff --numstat` shows 0 deletions in all three catalog files; `diff <(git show HEAD:README.md | tail -5) <(tail -5 README.md)` → identical (MIT license tail); same for docs/buck-workflow.md (Version section tail). The two earlier clobbered edit attempts left no residue. |

## Verification Status
- Goal achieved: **yes** (for this phase's slice) — the routing-table pointer now has a skill behind it, with the refusal gate intact and behaviorally proven; the design vocabulary A2 and Phase 3's C2 depend on exists and is linked, not restated.
- User goal: **met for this slice** — pending only loader registration (install + reload), which is an environment step, not a content gap.
- Scope adhered: **yes**. Extras beyond the phase's `files:` list, all intent-consistent: `skills/codebase-design/DEEPENING.md` (upstream companion; SKILL.md links to it; omitting it would dangle), `THIRD-PARTY-NOTICES.md` extension (mandated by the phase body: "extend it rather than adding a second notice mechanism" — done, one new block in the existing derived-files section, upstream license text untouched), phase-file `status: pending → in-progress` (loop bookkeeping).
- Out-of-scope changes: none adverse.
- Port fidelity: upstream → port diffs are line-wrapping plus deliberate, planned deltas only: `scripts/hitl-loop.template.sh` → guarded reference to `skills/b-wizard/template.sh` ("When … is present") — b-wizard is this plan's own Phase 4/N5 deliverable, so the forward reference is intentional and degrades gracefully until then; Phase 5 "flag for next phase" → wired code-smells handoff; added Origin/notice block and seam-vocabulary links.

## Guardrails Verdict
- Contract: durable
- Contract version: 2
- Status: — (docs-only skip)
- Gates: skipped — the diff touches only `.md` files and one symlink; no `scripts/` or `package.json` changes (verified from `git status`/diff), so the deterministic check contract is skipped per GLOBAL_OR_PROJECT-AGENTS.md § Deterministic Check Contract. (Note: the branch-level patch-gate fail recorded in review-phase-1.md is unaffected by this phase and still pending its own follow-up.)

## User Goal Analysis
- Goal: a debugging on-ramp that does not exist today (`/b-diagnose`) behind the bootstrap's systematic-debugger routing; design vocabulary as shared prerequisite.
- Met: skill + prompt + command + all five catalog surfaces; refusal gate proven behaviorally; vocabulary reference shipped with both fan-outs; compliance notice extended.
- Partial: loader-native, by-name resolution in a live session (criterion 12) — awaits `node scripts/install.mjs` + reload probe by the mainline session.
- Missing: nothing else.
- Verdict: met (pending the one environment probe above)

## Documentation Impact
- No documentation impact beyond the in-plan catalog updates, which are themselves this phase's deliverable and have landed (README, docs/buck-workflow.md, THIRD-PARTY-NOTICES.md).
- Recommended: none (no separate `/b-docs` pass needed).

## How-to Impact
- No how-to impact — the repo has no `docs/howto/` corpus and no sibling command ships one; `/b-diagnose` usage is documented at README L233 and docs/buck-workflow.md L1045-1060, proportionate to every other b-* command.
- Recommended: none.

## Issue Classification
- In-plan issues (implementation defects → `/b-iterate`): **none blocking**. One cosmetic warning, no iterate artifact:
  - **W1 (cosmetic)**: the quick-reference link `#codebase-design--deep-module-vocabulary` (docs/buck-workflow.md:397) does not match the GitHub slug of its heading `#### /skill:codebase-design — Deep-Module Vocabulary` (:1156), which slugs to `#skillcodebase-design--deep-module-vocabulary` (the `/skill:` prefix is stripped without a separator). This exactly replicates the pre-existing fix-pr pattern (:406 → :1124) that the plan itself names as the precedent, so it is convention-consistent — but on GitHub the TOC jump will not land. Fix (optional, one line): rename the heading to `#### codebase-design — Deep-Module Vocabulary` or update the anchor.
- Out-of-plan issues (scope discoveries → fresh `/b-plan`): 
  - Pre-existing: the fix-pr quick-ref anchor (docs/buck-workflow.md:406 → :1124) has the same slug mismatch. Fold into any future docs pass; does not block this phase.

## Verdict
**Pass with warnings** — 13 of 14 acceptance criteria ✅ with direct current-state evidence; criterion 12 (loader resolution by name) is ⚠️ not-verifiable from a read-only review and carries a concrete unblock recipe; W1 is cosmetic and precedent-consistent. No in-plan defects requiring `/b-iterate`; no iterate artifact written.

## Recommended Next Step
1. Mainline session: run `node scripts/install.mjs`, reload, and probe `/skill:b-diagnose` and `/skill:codebase-design` by exact name (+ `/b-diagnose` command expansion) — this closes criterion 12. Note for the phase record: the phase's "reload and probe" verification recipe under-specifies; the per-skill symlink installer must re-run first.
2. Optionally fix the W1 anchor (and the matching pre-existing fix-pr anchor) in the same touch — cosmetic, one line each.
3. Then `/b-save` → `/b-commit`. No `/b-docs` needed (catalog wiring was the phase).

