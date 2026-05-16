---
name: pi-rpc
description: Drive a pi-coding-agent subprocess via its JSON RPC protocol over stdin/stdout. Use to delegate a coding task to a sub-agent, run pi headlessly from a script or another agent, embed pi in a tool, or test pi behavior programmatically. Spawns `pi --mode rpc` and exchanges JSONL commands and events.
---

# pi-rpc: Drive a pi subprocess via JSON RPC

Use this skill when you need to invoke the [pi coding agent](https://pi.dev) headlessly from a script or another agent. The transport is JSONL over stdin/stdout (`pi --mode rpc`).

## When to use

- Delegate a self-contained sub-task to a fresh pi session ("ask pi to refactor X and report back").
- Run pi from a non-interactive context (CI, scripts, another agent's tool).
- Build a multi-agent pipeline where pi is one stage.
- Probe pi's behavior for testing or research.

If you are already inside pi and just want to invoke a skill or prompt template, use `/skill:name` or `/template` directly — do not spawn a subprocess.

## Quick start: one-shot prompt

For the common case (send one prompt, get one reply), use the helper script:

```bash
python3 <skill_dir>/scripts/pi-prompt.py "Summarize what this repo does" \
    --cwd /path/to/repo \
    --no-session
```

Resolve `<skill_dir>` to the directory containing this `SKILL.md` and use that absolute path. The script:
- spawns `pi --mode rpc`
- sends the prompt
- streams assistant text to stdout
- exits 0 on `agent_end`, non-zero on error

Useful flags:
- `--model <pattern>` — e.g. `anthropic/claude-sonnet-4-5` or `openai/gpt-5:high`
- `--provider <name>` — anthropic, openai, google, …
- `--cwd <path>` — run pi in a specific directory (default: current)
- `--no-session` — don't persist a session file
- `--session-dir <path>` — custom session storage
- `--timeout <seconds>` — hard cap; sends `abort` and exits if exceeded
- `--show-tools` — also print `tool_execution_*` events to stderr
- `--json` — emit raw events to stdout instead of just text (for piping/parsing)

Read stdin if no prompt arg is given:

```bash
echo "Write a haiku about JSONL" | python3 <skill_dir>/scripts/pi-prompt.py --no-session
```

## When the helper is not enough

For multi-turn conversations, steering, model switching, tool result inspection, or extension UI handling, drive the protocol directly. Load the full reference:

→ Read `<skill_dir>/reference.md` for the complete command/event/type catalog.

Minimal protocol shape:

1. Spawn: `pi --mode rpc [--provider X] [--model Y] [--no-session]`
2. Send commands as JSON, **one per line, LF-terminated**: `{"type":"prompt","message":"..."}\n`
3. Read events from stdout, **one JSON object per LF-terminated line**.
4. Each command may include `"id": "..."` to correlate the matching `response`.

### Critical framing rules

- Use **LF (`\n`) only** as the record delimiter. Strip a trailing `\r` if present.
- **Do not use Node's `readline`** — it splits on `U+2028`/`U+2029` which can appear inside JSON strings. Use a manual buffer split on `\n` (see `scripts/pi-prompt.py` or the Node example in `reference.md`).
- Every line of stdout is a JSON object. There are no partial JSON lines.

### Core commands you'll likely need

| Command | Purpose |
|---|---|
| `prompt` | Send a user message. Most common entry point. |
| `steer` / `follow_up` | Queue messages while the agent is streaming. |
| `abort` | Stop the current run. |
| `get_state` | Read streaming state, model, session info. |
| `get_messages` | Read full conversation. |
| `get_last_assistant_text` | Quick way to grab the final reply text. |
| `get_available_models` | List **all configured** models (full `Model` objects). |
| `set_model` / `cycle_model` | Switch models mid-session. `cycle_model` walks the *scoped* set. |
| `new_session` / `switch_session` | Manage session files. |

### Discovering models

There are two model populations and the distinction matters:

- **Available (all configured):** every model pi knows about from providers, settings, and CLI. Enumerate with `get_available_models` — returns an array of full `Model` objects (`id`, `name`, `provider`, `contextWindow`, `cost`, etc.).
- **Scoped / preferred (cycle set):** the subset pi cycles through with Ctrl+P, defined by the `enabledModels` setting (glob patterns like `["claude-*", "gpt-4o"]`). RPC has **no dedicated `get_scoped_models` command**. To probe the scoped set:
  1. Call `cycle_model` and inspect `data.isScoped` in the response. `true` means a scoped list is active; `false` means it's cycling the full available list.
  2. Optionally loop `cycle_model` until `data.model.id` returns to the start to enumerate the scoped ring. Then call `set_model` to restore the original.
  3. Or read the user's `~/.pi/settings.json` `enabledModels` directly if you have filesystem access.

The current model is also available from `get_state` (`data.model`).

### Key events to watch

- `agent_start` / `agent_end` — turn boundaries for a single prompt run.
- `message_update` with `assistantMessageEvent.type == "text_delta"` — streaming text.
- `tool_execution_start` / `_end` — what pi is doing.
- `extension_ui_request` — pi needs a user decision. See "Extension UI" in `reference.md`. If you don't handle these, dialogs time out or hang. Pass `--no-extensions` or use a controlled environment to avoid them.

### Termination

- A single prompt is done when you see `agent_end` (or `auto_retry_end` with `success: false`).
- Close stdin to gracefully shut pi down. Send `abort` first if a run is in progress.

## Failure modes to anticipate

- **Hanging on dialog**: an extension calls `confirm`/`select` and waits for your response. Either respond with `extension_ui_response`, set a timeout, or run with `--no-extensions`.
- **Wrong working directory**: pi reads files relative to its cwd. Pass `cwd=` to your subprocess spawner.
- **Auth not configured**: pi needs provider credentials in its environment. Inherit env or set `ANTHROPIC_API_KEY` etc. explicitly.
- **Session pollution**: omit `--no-session` only if you intentionally want persistence. Otherwise each invocation appends to a session file.
- **Cost**: every prompt is a real LLM call. Use `--no-session` and short prompts when scripting tests.

## Files in this skill

- `SKILL.md` — this entry point
- `scripts/pi-prompt.py` — one-shot prompt helper (Python, stdlib only)
- `reference.md` — full RPC protocol reference, copy of upstream `docs/rpc.md` topics with notes
