---
name: manage-herdr-panes
description: >
  Split, start, prompt, and read Herdr panes — especially omp in a sibling
  pane. Use when the user asks to manage Herdr panes, run omp in another pane,
  drive a Herdr agent, or loop work across panes. Requires HERDR_ENV=1.
  Complements the herdr CLI-reference skill; this is the operational cookbook.
---

# Manage Herdr Panes

Operational cookbook. Full CLI syntax lives in the `herdr` skill — load it if a flag is unknown. Installed `herdr` is the authority.

## Gate

```bash
test "${HERDR_ENV:-}" = 1
```

If unset: stop. Do not inspect or control the focused Herdr session from outside.

## Discover (every time)

```bash
herdr pane layout --pane "$HERDR_PANE_ID"
herdr pane list --workspace "$HERDR_WORKSPACE_ID"
herdr agent list
```

Parse IDs and live agent names from JSON. Rediscover before every send. Prefer `--current` or an explicit pane ID / unique name. Never target another client's focused pane.

## Split a sibling

Default: current tab, caller cwd, `--no-focus`. Wide pane → `--direction right`. Tall/narrow → `down`. Do not create a workspace, tab, or Herdr worktree unless the user asked.

```bash
herdr pane split --current --direction right --cwd "$PWD" --no-focus
```

New pane ID: `.result.pane.pane_id`. The pane must be an interactive shell with no foreground command or agent.

## Start omp (or requested kind)

Name: `[a-z][a-z0-9_-]{0,31}`, unique among live agents.

```bash
herdr agent start <name> --kind omp --pane <pane-id> --timeout 120000
```

`agent start` never splits. Success = detected and ready for input. `agent_not_ready` with blocked UI: wait until idle before prompting. Pass native args only after `--`.

## Prompt, wait, read

```bash
herdr agent prompt <name> "<text>" --wait
herdr agent get <name>
herdr pane read <pane-id> --source recent-unwrapped --lines 120
```

`--wait` without `--timeout` waits indefinitely after observed `working`/`blocked`. On `blocked`, inspect and ask the user before answering dialogs. Stall/timeout ≠ undelivered — read first; do not blindly resubmit.

OMP often stays `agent_status: idle` with unchanged `state_change_seq` while the TUI shows Working (title updates, "Working…"). `agent prompt --wait` then returns `agent_prompt_stalled`. Treat pane text as truth: if the prompt is visible and Working, do not resubmit. Finish with `herdr pane wait-output <pane-id> --match <closeout-token> --source recent-unwrapped` using a token **not** present in the prompt.

OMP never transitions Herdr `agent_status` to `done` (stays `idle`, `state_change_seq` unchanged). Automatic Done badges/toasts will not fire. After each completed pass, notify yourself:

```bash
herdr notification show "<title>" --body "<one-line result>" --sound done --position top-right
```

Use `--sound request` only when the pane is blocked and needs the user.

If a larger `--lines` does not recover the reply, the agent is on the alternate screen. Fallback: ask it to write markdown to a temp path and reply with that path only.

Shell vs agent: `pane run` for commands; `agent prompt` for turns.

## Safety

- Do not close panes, tabs, or workspaces you did not create.
- Do not run `herdr server stop` or kill the Herdr process.
- `--trust-repository` only after the user verified the repo.
- Git worktrees for PR loops are fine; Herdr `worktree create` only when asked.
