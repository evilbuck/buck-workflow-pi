---
status: draft
date: 2026-09-02
subject: 2026-09-02.herdr-omp-agent-driver
topics: [omp, extension, herdr, orchestration, multi-agent]
---

# Subject: Herdr OMP Agent Driver

**Subject**: herdr-omp-agent-driver
**Date**: 2026-09-02
**Status**: draft

## User Goal

You, in a live OMP session, dispatch work to other agents in **visible Herdr panes** (one control pane + runners) so you can see what is running and what each produced. You remain the consensus — not a locked hidden aggregator.

## Goal

Intake for an OMP plugin that drives other agents through Herdr panes — one control pane plus visible task-runner panes — with an as-yet-unsettled consensus method.

## Artifacts

| File | Type | Description |
|------|------|-------------|
| `brainstorm-herdr-omp-agent-driver.md` | brainstorm | First-draft plan + User Goal |
| `research-multi-agent-distillation.md` | research | Canonical summary: VERIFY / SELECT / SYNTHESIZE / DEBATE / VOTE |
| `research/notes-multi-agent-distillation.md` | notes | Rolling notes |
| `research/sources-multi-agent-distillation.md` | sources | Primary paper quotes |
| `research/notes-frameworks.md` | notes | AutoGen / LangGraph / Anthropic |
| `research/sources-frameworks.md` | sources | Framework URLs |
| `research/notes-critiques.md` | notes | Self-MoA, debate harms, judge bias |
| `research/sources-critiques.md` | sources | Critique paper URLs |

## Inputs Used

- User: **OMP plugin** (Oh My Pi extension/plugin surface). Not a portable skill, not a Pi-only package, not a generic plugin.
- Layout: one control window/pane + a collection of task runners (possibly specialized).
- Visibility: see what is running and the output each runner gets.
- Open: how to bring results together / get consensus; orchestrator-distills-findings is a candidate, not a decision. Research wanted.
- Related constraint to surface later: `.context/2026-06-01.deprecate-b-flow/` — no new extension-based orchestration; this idea may conflict or may be a different kind of driver (visible panes vs hidden XState).

## Herdr prior art (not this repo)

Source: `~/projects/partypix/.context/discussions/herdr-skill.md` (2026-07-03). External-controller design against the real herdr CLI (Hermes driving an already-running session), not Herdr's upstream inside-pane skill (`HERDR_ENV=1`).

Control plane: `controller → herdr CLI → local socket API → session/workspace/pane/agent`.

Hard constraints to carry into the draft:
- Named session must already exist (no auto-create).
- Pane ids are ephemeral — rediscover before every send.
- Prefer `pane read --source recent-unwrapped` over `agent read` (empty `text` observed).
- `agent send` does **not** press Enter; follow with `pane send-keys <id> enter`.
- Shell vs prompt: `pane run` vs `agent send` + Enter.
- Wait with `wait output` / `wait agent-status`, not sleeps.
- Conservative safety: read before write; do not guess target; prefer blocked/idle; verify after write.

Proven loop: named session → list panes → `agent start … --split --no-focus` → `wait output` → `agent send` + Enter → pane read.

## Related Subjects

- `2026-06-01.deprecate-b-flow` (active) — lesson against opaque extension orchestration
- `2026-05-08.b-orchestration-extension` — original b-flow
- `2026-06-06.omp-integration-buck-workflow` — goal/orchestrate/workflow keywords (prompt-level, not extension)
