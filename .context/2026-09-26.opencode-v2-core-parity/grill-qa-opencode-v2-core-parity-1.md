# OpenCode V2 core parity — grill questions

---

## Question 5

The full command catalog includes entries without an OpenCode implementation. For example, `/b-kamal-release` has no skill fallback, while `/omp-*` commands are OMP-only no-ops on other harnesses. Should the first release keep these commands visible but make them **explicitly refuse or clearly no-op** outside their supported runtime, rather than pretending they provide equivalent behavior?

**Recommended:** Yes. Full catalog means discoverable, not false runtime parity. Preserve the Pi/OMP behavior and document each unsupported OpenCode case clearly.

### Answer
I'd like a list of what works and what doesn't before deciding. What do you think is OMP only?

Follow-up: Get rid of the `/code-review` skill and `/b-kamal-release` skill. Agreed that optional OMP-only enhancements in portable skills should be skipped outside OMP.

---

## Question 6

Should those removals be **OpenCode V2-only** (leave Pi/OMP untouched), or **repository-wide** (also remove the Pi/OMP runtime commands and their extension code)? `code-review` currently names both a portable skill/command and a separate Pi/OMP extension-backed local review loop. `b-kamal-release` is a prompt command plus a Pi/OMP extension; there is no `skills/b-kamal-release/` directory.

**Recommended:** OpenCode V2-only in this compatibility milestone. Preserve existing Pi/OMP behavior; omit the two commands from the OpenCode installer using an explicit, narrow exclusion with a test. If you meant to retire these features everywhere, say repository-wide instead.

### Answer
Repository-wide. They're not useful and I don't use them.

---

## Question 7

OpenCode V2's Plan agent can discuss plans, but it may restrict writing to `.context/`, whereas Buck `/b-plan` requires a durable `.context/<subject>/plan-*.md` and subject lifecycle changes. When someone invokes `/b-plan` while in OpenCode's Plan mode, should it **stop and ask them to switch to Build** before writing, or **provide a read-only plan in chat** and defer durable artifact creation until Build mode?

**Recommended:** Read-only plan in chat with an explicit handoff to Build mode to save the Buck artifact, never silently write outside Plan mode's permitted paths and never claim `/b-plan` created a durable plan when it did not.

### Answer
Answered inline: plan in chat under OpenCode V2 Plan mode, then hand off to Build to save the durable `.context/` artifact. Subsequent grill questions will be asked inline at the user's request.

---
