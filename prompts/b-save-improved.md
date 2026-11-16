---
description: Deterministic session-record checkpoint — code-driven counterpart to b-save. Runs preflight, two model roles (scribe + auditor), and apply; hands step 8 (retain/learn) back to the mainline agent.
---

# B-Save-Improved

$ARGUMENTS

Under Pi/OMP with the `b-save` extension loaded (`extensions/b-save/index.ts`), `/b-save` runs the deterministic code path directly. For `/b-save-improved` or cross-platform usage without the extension, load the canonical `b-save` skill and follow its deterministic script/prompt procedure:

```
../skills/b-save/SKILL.md
```

The skill encodes the same contract: preflight → scribe (memory narrative +
backlog delta) → auditor (spec/phase/iterate verdicts) → apply → retain/learn
handoff. Args mirror the extension: `--dry-run`, `--archive-inferred`,
`--subject <name>`, `--no-retain`, `--model <provider/id>`, `--run-id <id>`.
