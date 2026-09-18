---
description: Deterministic session-record checkpoint — code-driven counterpart to b-save. Runs preflight, two model roles (scribe + auditor), and apply; hands step 8 (retain/learn) back to the mainline agent.
---

# B-Save-Improved

$ARGUMENTS

Under Pi/OMP with the `b-save-improved` extension loaded, this slash command
runs the deterministic code path (`extensions/b-save-improved/index.ts`).
Without it, load the `b-save-improved` skill and follow it manually:

```
../skills/b-save-improved/SKILL.md
```

The skill encodes the same contract: preflight → scribe (memory narrative +
backlog delta) → auditor (spec/phase/iterate verdicts) → apply → retain/learn
handoff. Args mirror the extension: `--dry-run`, `--archive-inferred`,
`--subject <name>`, `--no-retain`, `--model <provider/id>`.
