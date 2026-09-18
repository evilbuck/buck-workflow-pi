---
description: Design and ship a first-run guided product tour over real UI (stack-agnostic)
---

# Product tour

$ARGUMENTS

Load and follow the `product-tour` skill:

```
skills/product-tour/SKILL.md
```

**Start in interview mode.** Question the user (one at a time) about intent,
audience, verbs to teach, gate, advance rules, dismiss/resume, finale, and
replay until you can echo a short brief and get confirmation.

Stay stack-agnostic: lock the step table and product rules first, then map onto
this repo's existing UI patterns. Do not introduce a tour library unless the
project already has one. Push back if a tour is the wrong tool.
