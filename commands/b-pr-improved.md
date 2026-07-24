---
description: Deterministic PR creation (cached base, auto-rebase, auto-push, inline conflict resolution + description) — extension flow
---

# B-PR-Improved

$ARGUMENTS

> `/b-pr-improved` is the **extension** version of `b-pr` — the whole flow (base cache, fetch + rebase, conditional remote push, inline conflict resolution, description synthesis, `gh pr create`) runs as deterministic code in `extensions/b-pr-improved/`, reusing `skills/b-pr/scripts/pr-preflight.ts` and invoking the model inline for the two intelligence steps.
>
> **Cross-platform note:** this code path runs under Pi/OMP **when the extension is loaded**. If the extension is not active in your runtime, fall back to the `b-pr` skill — it encodes the identical deterministic procedure against the same script:

```
../skills/b-pr/SKILL.md
```
