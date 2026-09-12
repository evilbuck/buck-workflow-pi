---
date: 2026-09-11
domains: [agent-skills, workflow, audit]
topics: [overlap-audit, jz-skills, buck-workflow, methodology-comparison]
related: []
priority: high
status: active
subject: 2026-09-11.resumator-docker-orchestration-overlap
---

# Running notes — buck-workflow-pi vs resumator/docker-orchestration/.claude

## Pins
- LOCAL: buck-workflow-pi @ `f797174f8246aa20747be11e2de751fb099a8aac` (2026-09-09), 53 skills under `skills/`
- UPSTREAM: resumator/docker-orchestration @ `1fea15efc8a578aaf4e86f63c3b648a333307409` (2026-09-09), INTERNAL visibility, 24 skills under `.claude/skills/`, 105 files in `.claude/`
- Read-only on both. No file in either repo was modified.

## First-pass observations (parent agent, upstream read directly)

### Shared ancestry — the biggest single finding
Upstream ships `.claude/skills/ATTRIBUTION.md`: 7 of its 24 skills are declared
MIT-derivative ports of `obra/superpowers` v6.1.0 (`f268f7c`), with the full MIT
text inline and a port table:
| jz skill | upstream superpowers skill |
| jz-spec-writer | brainstorming |
| jz-plan-writer | writing-plans |
| jz-plan-executor | subagent-driven-development (modified: on-disk ledger) |
| jz-worktree | using-git-worktrees |
| jz-debug | systematic-debugging |
| jz-test-driven-development | test-driven-development |
| jz-skill-writer | writing-skills |

buck-workflow-pi has an OPEN defect (2026-09-10 audit) for exactly this class:
near-verbatim mattpocock/skills copies in `skills/b-grill-with-docs/CONTEXT-FORMAT.md`
and `ADR-FORMAT.md` with no attribution, while `package.json` `files:` publishes
`skills/` to npm. Upstream's ATTRIBUTION.md is the exact remediation pattern already
locked in `.context/2026-09-10.mattpocock-adoption/`.

### Methodology shape — high level
- Both are a **spine of markdown skills + thin command wrappers + a distribution story**.
- buck-workflow-pi: skills/ (canonical) + prompts/ (Pi wrappers) + extensions/ (TS runtime) — 3-layer.
- upstream: .claude/skills/ (canonical) + .claude/commands/ (4 thin wrappers) + config/RULES.md
  (global instruction block) + hooks + statusline + output-style + mcp docs — 6-surface.
- buck: `/b-*` prefix, 53 skills, ~everything is a workflow station.
- upstream: `jz-*` prefix, 24 skills, only 4 slash commands (`/pr`, `/autodev`, `/review`, `/humanize`).

### Upstream conventions that have no buck analogue (candidate adoptions)
1. **"Iteration is a mode, never a name."** A skill defaults to ONE read-only pass ending in
   a proposal; it converges only in `loop` mode, selected by an explicit greppable `loop`
   scope from a caller, or human prose. Never `-loop` in a skill name.
   (`.claude/skills/README.md:31`, root `CLAUDE.md:203`)
2. **Router + per-mode engine inlined.** `jz-adversarial-review` absorbed 4 leaf skills;
   routes spec/plan/cycle/implementation and runs `references/<mode>/engine.md` in the same
   execution context. Explicit statement that a dispatcher over thin leaf skills is worse.
3. **RETIRED file.** Renaming/deleting a skill requires appending the old name to
   `skills/RETIRED`, or the installer can never uninstall it. Never delete a line.
4. **Stable requirement ids across artifacts.** ticket `PR-NNN`/`AC-NNN` -> spec
   `FR-NNN`/`SC-NNN` -> cycle-doc `VP-NNN`, each carrying a `(source: ...)` tag. An
   untagged requirement is scope creep and gets CUT; an uncited ticket id is a dropped
   requirement. Traceability is machine-checkable by grep.
5. **Skill lint in CI.** `jz skill-lint check`: name==dirname, description present and
   <=1024 chars with no unquoted `:`, every cited file path resolves, every named sub-skill
   and slash-command target exists, hook scripts executable. `bats test/skill-lint.bats`
   + `test/skills-contract.bats`.
6. **Durable per-session state record maintained by a detached background process.**
   `jz-agent-session-state`: SessionStart hook injects
   `~/.jz-agent-session-state/<session-id>.state.md`; Stop hook launches a headless
   `claude -p --safe-mode --tools "Read,Edit" --model haiku` updater that edits the record
   out-of-band. Zero tokens, zero turns, nothing rendered. Explicitly replaced a design
   where the main agent authored the record.
7. **Two-phase PR topology.** Doc-only Plan PR on `plan-<slug>`, Implementation PR stacked
   on it (`impl-<slug>`), merge Plan PR first and let GitHub auto-retarget.
8. **Review runs on a DIFFERENT model family, off-harness.** `jz-adversarial-review` lenses
   run on an external harness CLI (Copilot CLI / opencode) across 4 providers
   (claude-opus-5, gpt-5.3-codex, gpt-5.6-terra, gemini-3-pro) at medium effort.
9. **Restraint lens as a required sub-skill of review.** `jz-senior-engineer`'s
   "Judging incoming feedback" runs over every synthesized finding before the report is
   emitted; Critical findings are never declinable; every decline is recorded with a reason.
10. **Untrusted-data posture, named and repeated.** CI logs, Copilot comment bodies,
    prereq documents, and review findings are all explicitly data-not-instructions;
    overrides read only from the human invocation channel.
11. **Non-blocking mandate.** RULES.md hard-caps inline waits at 30s; the conductor's
    "dispatch responsiveness mandate" requires background dispatch + poll for every job.
12. **Secret-scan carve-out.** Local pre-push secret scan is never routed through MCP and
    never made conditional on it.

### Where buck is materially deeper (first pass, to be confirmed by scouts)
- Durable git-portable session record + memory index + backlog (`.context/`), cross-harness.
- Presentation/communication artifacts (b-present, b-blueprint) — upstream has none.
- Doc taxonomy (b-docs / b-howto / Diataxis, CONTEXT.md, ADRs) — upstream explicitly
  says repo files carry current state, not history, and pushes rationale to the PR/ticket.
- Guardrails contract (`guardrails.json`, ratchet, patch coverage, complexity) — upstream
  has per-repo discovered quality/verification gates but no recorded thresholds file.
- Breadth: UX/styleguide/design-brief/product-tour, research/crawl, memory import.
