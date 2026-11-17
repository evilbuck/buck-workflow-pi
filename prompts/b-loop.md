---
description: Run unattended Buck phase loops in OMP via hot-reloadable TypeScript eval runner
---

# B-Loop

$ARGUMENTS

Run the autonomous Buck phase loop runner in OMP's Bun `eval` kernel (`language: "js"`):

1. Set `globalThis.BUCK_LOOP_ARGS = "$ARGUMENTS"`.
2. Execute the runner via `%load`:

```javascript
eval({
  language: "js",
  code: "%load skills/b-loop/scripts/eval-buck-loop.ts",
  timeout: 0
});
```

Do not modify or paraphrase the runner script source. Execute the `%load` statement directly.
