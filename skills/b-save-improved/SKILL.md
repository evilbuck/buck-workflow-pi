---
name: b-save-improved
description: Deterministic session-record checkpoint — code-driven counterpart to the b-save skill. Runs preflight, two model roles (scribe + auditor), and apply; leaves step 8 (retain/learn) as the one responsibility only the mainline agent can perform.
---

# b-save-improved: deterministic session-record checkpoint

Companion skill to `b-save`. The whole flow is orchestrated in code by
`extensions/b-save-improved/index.ts` (Pi/OMP) or via the cross-platform
fallback in `commands/b-save-improved.md`. This skill is the contract —
the extension is the deterministic implementation.

`/b-save` remains the portable fallback for harnesses without this extension;
this skill does not replace it.

## Inputs

- A `.context/` directory containing the subject folder, plan/spec/phase/iterate
  artifacts, memory files, and backlog items.
  If more than one is `active`, prompt the user to pick one **or create
  `<today>.<slug-from-branch>`**. Candidates are newest-first. If none is
  `active`, fall back to `status: draft`, otherwise synthesize that name.
- Additional user context (free-form text in the slash-command arguments).
- **`--dry-run`** — preview only; never mutate. Compute the apply payload,
  print the report, write nothing.
- **`--archive-inferred`** — also archive `complete_inferred` backlog items.
  Without this flag they are only staged in the apply report.
- **`--subject <name>`** — skip subject resolution and use this folder name.
  A missing folder is created (date prefix added if the name has none).
- **`--no-retain`** — skip the step-8 handoff to `retain`/`learn`.
- **`--model <provider/id>`** — override the default model for the scribe
  and auditor roles.

## Safety Rules

- `/b-save` stays as the portable fallback; this skill does not replace it.
  If the extension cannot run, follow `prompts/b-save.md` step-by-step instead.
- `.context/workflow/current-session.json` is **never** used to select the
  subject. It is reported for human context only. Nothing has written it
  since the 2026-06-05 extension slim-down.
- Never call the Hindsight HTTP API. Never run `b-memory-import` — that skill
  is bulk backfill only. The step-8 handoff is the only memory write path.
- Inferred backlog completions are staged (reported, not archived) unless
  `--archive-inferred` is set. Explicit completions always archive.
- A missing `## User Goal` section in a plan is a warning, never a block.
- `--dry-run` writes nothing — verify with `git status --porcelain` afterwards.
- Subject status is authoritative; "lexically latest folder wins" shortcuts
  that ignore status are forbidden.

## Procedure

The deterministic path lives in `extensions/b-save-improved/index.ts`. Run it
through Pi/OMP with `/b-save-improved [args]`, or under any agent that loads
this skill directly with `bun <skill_dir>/../extensions/b-save-improved/index.ts`
(loaded by the runtime — the skill itself does not orchestrate the file work).

For cross-platform usage without the extension, follow the procedure below
manually — it is the same twelve-step contract, deterministic where it can be,
and groups the judgement steps into two roles:

**scribe** (one model call, no tools): steps 3 + 5 — memory narrative +
backlog delta. Reads the session digest and the preflight facts; produces
the memory file body, frontmatter, index summary, and the explicit/inferred
completion list.

**auditor** (one model call, optional, with `read`/`grep` tools): steps 6 +
10 + 11 — spec/phase/iterate completion verdicts against the repo.

The remaining steps are deterministic and run in scripts:

1. Run `bun skills/b-save-improved/scripts/save-preflight.ts` (optional `--subject`).
   Exit codes: `0` ready, `1` filesystem broken, `2` ambiguous subject,
   `3` `.context/` missing.
2. On exit 2, prompt the user to pick from `subject_candidates` (newest
   first) **or "Create `<suggested_subject>`"**. Create uses the suggested
   name with no extra prompt. Re-run preflight with `--subject`. Cancel = stop.
3. **scribe** — draft the session narrative and backlog delta from the
   preflight digest + `backlog.open_items`. Produce the memory `frontmatter`,
   `title`, `body`, `index_entry.summary`, and `backlog.complete_explicit` /
   `complete_inferred` / `new_items`. Cite the session statement that
   marked each explicit completion; anything short of that goes in
   `complete_inferred`.
4. **auditor** — only when there are specs, phases needing adjudication, or
   active iterates. Verify claims against the repo. Produce per-artifact
   verdicts with `file:line` evidence. Only `complete` feeds the apply
   payload; `incomplete` and `uncertain` are reported and left alone.
   `phases.auto_completable` bypasses the auditor — all-`[x]` criteria is
   already proof.
5. Assemble the apply payload (preflight facts + scribe output + auditor
   verdicts) and pipe it to `bun skills/b-save-improved/scripts/save-apply.ts`
   on stdin. Use `--dry-run` to preview without writing, or
   `--archive-inferred` to also archive inferred backlog items.
6. If `memory_backend.expect_retain`, call `retain` (for `hindsight`/`mnemopi`)
   or `learn` (for `local`) with 1–N self-contained facts including artifact
   paths. Each fact is pre-drafted by the scribe. Skip if `backend` is null
   (no harness memory tool detected). Skip if `--no-retain`.
7. Non-OMP only: best-effort re-index the configured memory skill (run `qmd`
   on `.context/memory` if it resolves on `PATH`). Wrap in try/catch; failure
   is reported, never blocking.

The twelve responsibilities map as: step 1 preflight; step 2 subject
resolve; steps 3 + 5 scribe (memory narrative + backlog delta); step 4
cross-reference back-fill (deterministic, in apply); steps 6 + 10 + 11
auditor (spec/phase/iterate completion); step 7 memory index prepend
(deterministic, in apply); step 8 retain/learn (mainline agent handoff);
step 9 memory-skill re-index (best-effort subprocess); step 12 User Goal
check (deterministic regex, warning only).
