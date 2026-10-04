---
title: initialLabel does not narrow the profile command, so index.ts fails tsc
status: active
priority: low
created: 2026-10-03
updated: 2026-10-03
completed: null
related:
  - extensions/buck-loop/index.ts
  - extensions/buck-loop/phase-difficulty.md
---

# initialLabel does not narrow the profile command, so index.ts fails tsc

`initialLabel(parsed)` at `extensions/buck-loop/index.ts:184` is called with a
`ParsedArgs` union that still includes the `profile` variant, but the function
accepts only `{ command: "start" } | { command: "resume" | "status" | "stop" }`.
tsc reports TS2345 at that call site.

Verified 2026-10-03:

```
extensions/buck-loop/index.ts(184,26): error TS2345: Argument of type
  '{ ok: true; command: "start"; path: string; } | { ok: true; command: "resume" | "stop" | "status"; } |
   { ok: true; command: "profile"; profile: Profile; }'
  is not assignable to parameter of type
  '{ ok: true; command: "start"; path: string; } | { ok: true; command: "resume" | "stop" | "status"; }'
```

Pre-existing: present at `289c6d4` and at its parent, and this change did not
modify `index.ts`. The project's `tsconfig.json` covers `extensions/**/*` with
no test exclusion and the lint gate is disabled, so `tsc` is the only static
check — which is how it went unnoticed. The repository baseline is 198
diagnostics project-wide, most of them the same family in test files.

The runtime is safe: `supervisorFailure()` is only reached on the throw path
after argument parsing, and `dispatchCommand()` returns before
`executeCommand()` for the `profile` command, so the variant is dead in
practice. This is a typing gap, not a live defect.

## Fix

Either narrow at the call site by handling `profile` explicitly, or widen
`initialLabel` to accept the full union and return a profile-appropriate label.
The first is smaller if `supervisorFailure` is genuinely unreachable for
`profile`; the second if a future caller might route one through.
