# Session: 2026-05-16 — pi-rpc skill

## Context
- User asked to build a pi-coding-agent RPC skill for other agents to use.
- Targets per repo AGENTS.md: pi, claude, opencode, codex. This skill is portable (canonical layer).

## Decisions Made
- Skill name: `pi-rpc` (concise; clear it's about the RPC protocol, not pi in general).
- Three-file layout to keep SKILL.md short and load progressively:
  - `SKILL.md` — task-oriented entry point, when-to-use, quick-start, failure modes.
  - `scripts/pi-prompt.py` — stdlib-only one-shot helper. Spawns `pi --mode rpc`, sends one prompt, streams text deltas to stdout, exits on `agent_end`. Auto-cancels extension UI dialogs to avoid hangs.
  - `reference.md` — full RPC command/event/type catalog, loaded on demand.
- Helper auto-cancels `extension_ui_request` dialog methods (select/confirm/input/editor) with `{cancelled: true}` to prevent hangs in non-interactive use.
- Used Python stdlib only (subprocess + threading) so the script works wherever Python 3 is available; no extra deps for consuming agents.
- Implemented manual `\n`-split JSONL reader (per RPC framing rules) — NOT Python's `readline`-equivalent on bytes either, since we want strict LF-only semantics.

## Gotchas / Notes
- Pi RPC docs are firm: split records on `\n` only, accept `\r\n`, never use Node `readline` (splits on U+2028/U+2029 too — which appear in JSON strings legally).
- `bash` RPC command emits NO event; output is folded into the next `prompt`'s LLM context as a synthetic user message.
- A `prompt` response (`success: true`) only means "accepted/queued". Final outcome arrives via `agent_end` / `auto_retry_end`.
- Scoped models: no dedicated RPC command. `cycle_model` returns `isScoped: bool`. The scoped set is the `enabledModels` glob list in settings. Documented this explicitly in both SKILL.md and reference.md after user follow-up.

## Changed Files
- `skills/pi-rpc/SKILL.md` (new)
- `skills/pi-rpc/scripts/pi-prompt.py` (new, executable)
- `skills/pi-rpc/reference.md` (new)

## Next Steps
- [ ] Test the helper end-to-end with a real `pi --mode rpc` invocation (need pi installed in a sandbox-safe way; user can run `python3 skills/pi-rpc/scripts/pi-prompt.py "say hi" --no-session --timeout 60`).
- [ ] Consider adding a Node.js variant of the helper (some agents prefer JS).
- [ ] Consider a multi-turn helper that exposes a REPL-style interface for agents that need conversational delegation.
- [ ] If/when pi gets a `get_scoped_models` RPC, simplify the model-discovery section.
