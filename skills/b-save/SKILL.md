---
name: b-save
description: Deterministic OMP session checkpoint — snapshot, bounded roles, journaled apply, post-apply effects
triggers:
  - /b-save
---

# b-save: Deterministic session checkpoint

OMP state-machine engine at `extensions/b-save`. Prompt-driven fallback: `/deprecated-b-save`.

## Flags

| Flag | Meaning |
|---|---|
| `--dry-run` | Snapshot and report; write nothing |
| `--subject <name>` | Skip subject resolution |
| `--no-retain` | Skip native-memory effect |
| `--model <provider/id>` | Override every engine role |
| `--archive-inferred` | Archive inferred backlog completions |
| `--run-id <id>` | Resume a non-terminal run |

Unknown flags fail closed. Headless subject/policy waits print `run_id` and a recovery command; they do not guess.

## Native memory

Hindsight is `unsupported` on OMP 18.1.17. Local/Mnemopi use `ctx.memory.status()/save()` with stored-count validation and one retry. Effect failure never invalidates a durable `.context` apply.

## Related

- `extensions/b-save/index.ts` — command adapter
- `prompts/b-save.md` — slash-command description
- `skills/deprecated-b-save/SKILL.md` — prompt-driven fallback
